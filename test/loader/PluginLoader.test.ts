import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/app/EditorSession';
import { installBuiltins } from '../../src/builtin';
import { InvalidPluginConfigError, PluginLoader } from '../../src/loader';
import type { PluginModuleLoader } from '../../src/loader';
import { emptyHost } from '../support/BuiltinCli';

class Output {
  readonly lines: string[] = [];
  readonly errors: string[] = [];
  write(text: string): void {
    this.lines.push(text);
  }
  writeError(message: string): void {
    this.errors.push(message);
  }
  warn(): void {}
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'svg-loader-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function file(relative: string, content: string): string {
  const path = join(root, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return path;
}

function writeConfig(plugins: unknown, relative = 'plugins.config.json'): string {
  return file(relative, JSON.stringify({ plugins }));
}

/** 一个会注册同名命令的插件包：`<dir>/package.json` + `<dir>/dist/index.js`（main 指向编译产物）。 */
function pluginPackage(
  dir: string,
  options: { name: string; command?: string; contributes?: object; body?: string },
): void {
  const command = options.command ?? options.name;
  const contributes = options.contributes ?? { commands: [command] };
  file(
    `${dir}/package.json`,
    JSON.stringify({ name: options.name, main: 'dist/index.js', contributes }),
  );
  file(
    `${dir}/dist/index.js`,
    options.body ??
      `exports.default = { activate(ctx, options) {
        ctx.registerCommand({
          name: ${JSON.stringify(command)},
          usage: ${JSON.stringify(command)},
          execute(args, c) { c.output.write(${JSON.stringify(command)} + ':' + JSON.stringify(options ?? null)); },
        });
      } };`,
  );
}

function setup() {
  const output = new Output();
  const session = new EditorSession(
    { read: () => { throw new Error('unused'); } },
    { write: () => { throw new Error('unused'); } },
    output,
  );
  const host = emptyHost(session);
  installBuiltins(host);
  const errors: string[] = [];
  const loader = new PluginLoader(host, (message) => errors.push(message));
  const run = (line: string) => {
    output.lines.length = 0;
    output.errors.length = 0;
    host.createCli(output).executeLine(line);
    return { out: [...output.lines], err: [...output.errors] };
  };
  return { host, loader, errors, run };
}

describe('PluginLoader 成功路径', () => {
  it('按配置顺序加载，清单取自插件包 package.json，options 传给 activate', () => {
    pluginPackage('plugins/alpha', { name: 'alpha' });
    pluginPackage('plugins/beta', { name: 'beta' });
    const config = writeConfig([
      { module: './plugins/alpha', options: { greeting: 'hi' } },
      { module: './plugins/beta' },
    ]);
    const { host, loader, errors, run } = setup();

    const report = loader.loadFromConfig(config);

    expect(errors).toEqual([]);
    expect(report.installed).toEqual(['./plugins/alpha', './plugins/beta']);
    expect(host.installed().slice(-2)).toEqual(['alpha', 'beta']);
    expect(run('alpha').out).toEqual(['alpha:{"greeting":"hi"}']);
    expect(run('beta').out).toEqual(['beta:null']);
  });

  it('enabled:false 的项整项跳过：不加载也不校验模块', () => {
    const config = writeConfig([{ module: './plugins/does-not-exist', enabled: false }]);
    const { loader, errors, run } = setup();

    const report = loader.loadFromConfig(config);

    expect(errors).toEqual([]);
    expect(report.installed).toEqual([]);
    expect(report.skipped).toEqual(['./plugins/does-not-exist']);
    expect(run('does-not-exist').err).toEqual(['unknown command: does-not-exist']);
  });

  it('相对路径以配置文件所在目录为基准，而不是进程工作目录', () => {
    pluginPackage('plugins/alpha', { name: 'alpha' });
    const config = writeConfig([{ module: '../plugins/alpha' }], 'conf/nested/plugins.config.json');
    // conf/nested/../plugins/alpha 即 conf/plugins/alpha：不存在，必须报 not found
    const first = setup();
    first.loader.loadFromConfig(config);
    expect(first.errors).toEqual(['plugin not found: ../plugins/alpha']);

    pluginPackage('conf/plugins/alpha', { name: 'alpha' });
    const second = setup();
    second.loader.loadFromConfig(config);
    expect(second.errors).toEqual([]);
    expect(second.run('alpha').out).toEqual(['alpha:null']);
  });

  it('包名走 Node 解析（从配置文件目录向上找 node_modules）', () => {
    pluginPackage('node_modules/svg-plugin-pkg', { name: 'svg-plugin-pkg', command: 'pkgcmd' });
    const config = writeConfig([{ module: 'svg-plugin-pkg' }], 'conf/plugins.config.json');
    const { host, loader, errors, run } = setup();

    loader.loadFromConfig(config);

    expect(errors).toEqual([]);
    expect(host.installed()).toContain('svg-plugin-pkg');
    expect(run('pkgcmd').out).toEqual(['pkgcmd:null']);
  });

  it('指向单个文件的模块：优先用模块自己导出的 manifest', () => {
    file(
      'solo.js',
      `exports.manifest = { name: 'solo', contributes: { commands: ['solo'] } };
       exports.default = { activate(ctx) {
         ctx.registerCommand({ name: 'solo', usage: 'solo', execute(a, c) { c.output.write('solo!'); } });
       } };`,
    );
    const config = writeConfig([{ module: './solo.js' }]);
    const { loader, errors, run } = setup();

    loader.loadFromConfig(config);

    expect(errors).toEqual([]);
    expect(run('solo').out).toEqual(['solo!']);
  });
});

describe('PluginLoader 失败路径：单个插件失败只影响它自己，后续插件继续', () => {
  function expectOthersStillLoad(
    failing: { module: string },
    expectedError: string | RegExp,
  ): void {
    pluginPackage('plugins/good', { name: 'good' });
    const config = writeConfig([failing, { module: './plugins/good' }]);
    const { loader, errors, run } = setup();

    const report = loader.loadFromConfig(config);

    expect(errors).toHaveLength(1);
    if (typeof expectedError === 'string') {
      expect(errors[0]).toBe(expectedError);
    } else {
      expect(errors[0]).toMatch(expectedError);
    }
    expect(report.installed).toEqual(['./plugins/good']);
    expect(run('good').out).toEqual(['good:null']);
  }

  it('1. 找不到：plugin not found（相对路径与包名两种写法）', () => {
    expectOthersStillLoad({ module: './plugins/missing' }, 'plugin not found: ./plugins/missing');
    expectOthersStillLoad({ module: 'no-such-pkg-xyz' }, 'plugin not found: no-such-pkg-xyz');
  });

  it('2. 求值失败不误报 not found：模块自身抛错、缺少它自己的依赖都是 failed to activate', () => {
    file('boom.js', `throw new Error('top-level boom');`);
    file('needs-dep.js', `require('definitely-not-installed-dep'); exports.default = {};`);
    expectOthersStillLoad(
      { module: './boom.js' },
      'plugin failed to activate: ./boom.js (top-level boom)',
    );
    expectOthersStillLoad(
      { module: './needs-dep.js' },
      /^plugin failed to activate: \.\/needs-dep\.js \(Cannot find module 'definitely-not-installed-dep'/,
    );
  });

  it('3. 没有默认导出', () => {
    file('nodefault.js', `exports.something = 1;`);
    expectOthersStillLoad(
      { module: './nodefault.js' },
      'plugin has no default export: ./nodefault.js',
    );
  });

  it('3b. 默认导出不是插件（缺 activate）按 failed to activate 报告', () => {
    pluginPackage('plugins/bad', {
      name: 'bad',
      contributes: {},
      body: `exports.default = { notActivate() {} };`,
    });
    expectOthersStillLoad(
      { module: './plugins/bad' },
      'plugin failed to activate: bad (missing activate)',
    );
  });

  it('4. 清单与实际注册不一致：整个插件被拒绝，暂存注册全部撤销', () => {
    pluginPackage('plugins/liar', {
      name: 'liar',
      command: 'liarcmd',
      contributes: { commands: ['declared-only'] },
    });
    const config = writeConfig([{ module: './plugins/liar' }]);
    const { host, loader, errors, run } = setup();

    loader.loadFromConfig(config);

    expect(errors).toEqual([
      'plugin manifest mismatch: liar (registered but not declared: commands/liarcmd; declared but not registered: commands/declared-only)',
    ]);
    expect(host.installed()).not.toContain('liar');
    expect(run('liarcmd').err).toEqual(['unknown command: liarcmd']);
  });

  it('4b. 找不到清单：报 manifest mismatch', () => {
    file('nomanifest.js', `exports.default = { activate() {} };`);
    expectOthersStillLoad(
      { module: './nomanifest.js' },
      'plugin manifest mismatch: ./nomanifest.js (no package.json with contributes found)',
    );
  });

  it('5. activate 抛错：撤销该插件已暂存的注册，不留半个插件', () => {
    pluginPackage('plugins/half', {
      name: 'half',
      command: 'halfcmd',
      body: `exports.default = { activate(ctx) {
        ctx.registerCommand({ name: 'halfcmd', usage: 'halfcmd', execute() {} });
        throw new Error('exploded');
      } };`,
    });
    const config = writeConfig([{ module: './plugins/half' }]);
    const { host, loader, errors, run } = setup();

    loader.loadFromConfig(config);

    expect(errors).toEqual(['plugin failed to activate: half (exploded)']);
    expect(host.installed()).not.toContain('half');
    expect(run('halfcmd').err).toEqual(['unknown command: halfcmd']);
  });

  it('6. 重复注册：后者整体被拒绝，先装的保持原样', () => {
    pluginPackage('plugins/first', { name: 'first', command: 'shared' });
    pluginPackage('plugins/second', { name: 'second', command: 'shared' });
    pluginPackage('plugins/third', { name: 'third' });
    const config = writeConfig([
      { module: './plugins/first' },
      { module: './plugins/second' },
      { module: './plugins/third' },
    ]);
    const { host, loader, errors, run } = setup();

    const report = loader.loadFromConfig(config);

    expect(errors).toEqual(['duplicate registration: commands/shared']);
    expect(report.installed).toEqual(['./plugins/first', './plugins/third']);
    expect(host.installed()).not.toContain('second');
    expect(run('shared').out).toEqual(['shared:null']);
    expect(run('third').out).toEqual(['third:null']);
  });

  it('6b. 同一个插件写了两次：第二次报 duplicate registration: plugins/<name>', () => {
    pluginPackage('plugins/once', { name: 'once' });
    const config = writeConfig([{ module: './plugins/once' }, { module: './plugins/once' }]);
    const { loader, errors } = setup();

    const report = loader.loadFromConfig(config);

    expect(errors).toEqual(['duplicate registration: plugins/once']);
    expect(report.installed).toEqual(['./plugins/once']);
  });

  it('不能占用内置命令名', () => {
    pluginPackage('plugins/thief', { name: 'thief', command: 'create' });
    const config = writeConfig([{ module: './plugins/thief' }]);
    const { loader, errors } = setup();

    loader.loadFromConfig(config);

    expect(errors).toEqual(['duplicate registration: commands/create']);
  });
});

describe('PluginLoader：配置整体非法 → invalid plugin config，一个插件都不装', () => {
  function expectInvalid(content: string | undefined, reason: RegExp): void {
    const path = join(root, 'plugins.config.json');
    if (content !== undefined) writeFileSync(path, content);
    pluginPackage('plugins/alpha', { name: 'alpha' });
    const { host, loader, errors } = setup();
    const before = host.installed();

    expect(() => loader.loadFromConfig(path)).toThrow(InvalidPluginConfigError);
    try {
      loader.loadFromConfig(path);
    } catch (error) {
      expect((error as Error).message).toMatch(
        new RegExp(`^invalid plugin config: .*plugins\\.config\\.json \\(${reason.source}`),
      );
    }
    expect(errors).toEqual([]);
    expect(host.installed()).toEqual(before);
  }

  it('文件不存在', () => {
    expectInvalid(undefined, /cannot read file/);
  });

  it('不是合法 JSON', () => {
    expectInvalid('{ not json', /not valid JSON/);
  });

  it('结构错误：顶层、plugins、项、module、enabled', () => {
    expectInvalid('[]', /top level must be an object/);
    expectInvalid('{}', /"plugins" must be an array/);
    expectInvalid('{"plugins": [1]}', /plugins\[0\] must be an object/);
    expectInvalid('{"plugins": [{}]}', /plugins\[0\]\.module must be a non-empty string/);
    expectInvalid(
      '{"plugins": [{"module": "./a", "enabled": "yes"}]}',
      /plugins\[0\]\.enabled must be a boolean/,
    );
  });

  it('结构错误发生在任何插件加载之前：前面合法的项也不会被装入', () => {
    pluginPackage('plugins/alpha', { name: 'alpha' });
    const path = file(
      'plugins.config.json',
      '{"plugins": [{"module": "./plugins/alpha"}, {"module": 5}]}',
    );
    const { host, loader } = setup();

    expect(() => loader.loadFromConfig(path)).toThrow(/plugins\[1\]\.module/);
    expect(host.installed()).not.toContain('alpha');
  });
});

describe('PluginLoader 与模块加载器的接缝', () => {
  it('加载器只通过 PluginModuleLoader 把字符串换成模块，不认识任何具体插件', () => {
    const calls: Array<[string, string]> = [];
    const stub: PluginModuleLoader = {
      load(moduleName, baseDir) {
        calls.push([moduleName, baseDir]);
        return {
          manifest: { name: moduleName, contributes: { commands: [moduleName] } },
          plugin: {
            activate: (ctx) =>
              ctx.registerCommand({ name: moduleName, usage: moduleName, execute: () => undefined }),
          },
        };
      },
    };
    const config = writeConfig([{ module: 'x' }, { module: 'y', enabled: false }, { module: 'z' }]);
    const { host } = setup();
    const errors: string[] = [];

    new PluginLoader(host, (m) => errors.push(m), stub).loadFromConfig(config);

    expect(errors).toEqual([]);
    expect(calls).toEqual([['x', root], ['z', root]]);
  });
});
