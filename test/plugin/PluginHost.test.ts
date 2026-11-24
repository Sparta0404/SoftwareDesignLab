import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/app/EditorSession';
import type { Command } from '../../src/cli/Command';
import { ShapeFactory } from '../../src/factory/ShapeFactory';
import type { Plugin, PluginContext, PluginManifest } from '../../src/plugin/Plugin';
import type { TreeDecorator } from '../../src/view/TreeDecorator';
import { installBuiltins } from '../../src/builtin';
import { emptyHost, extensionPlugin } from '../support/BuiltinCli';
import {
  FAKE_BOX_MANIFEST,
  FakeBoxAttributeHandler,
  FakeBoxPlugin,
  FakeBoxProvider,
} from '../support/FakeBox';

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

function newSession(output: Output): EditorSession {
  return new EditorSession(
    { read: () => { throw new Error('unused'); } },
    { write: () => { throw new Error('unused'); } },
    output,
  );
}

function setup() {
  const output = new Output();
  const session = newSession(output);
  const host = emptyHost(session);
  installBuiltins(host);
  const run = (...lines: string[]) => {
    const cli = host.createCli(output);
    output.lines.length = 0;
    output.errors.length = 0;
    lines.forEach((line) => cli.executeLine(line));
    return { out: [...output.lines], err: [...output.errors] };
  };
  return { host, run, factory: host.services.factory, session };
}

const noop = (name: string): Command => ({ name, usage: name, execute: () => undefined });

function plugin(
  manifest: PluginManifest,
  activate: (context: PluginContext, options?: unknown) => void,
): { plugin: Plugin; manifest: PluginManifest } {
  return { plugin: { activate }, manifest };
}

describe('内置插件装配', () => {
  it('help 的命令与图形顺序与重构前一致', () => {
    const { run } = setup();
    const help = run('help').out[0].split('\n');
    expect(help[0]).toBe('commands:');
    const commandUsages = help.slice(1, help.indexOf(''));
    expect(commandUsages.map((line) => line.trim().split(' ')[0])).toEqual([
      'init', 'read', 'save', 'canvas', 'create', 'delete', 'move', 'scale', 'set', 'group',
      'ungroup', 'addto', 'front', 'back', 'tree', 'show', 'undo', 'redo', 'help',
    ]);
    const shapeUsages = help.slice(help.indexOf('shapes:') + 1);
    expect(shapeUsages.map((line) => line.trim().split(' ')[1])).toEqual([
      'rect', 'circle', 'ellipse', 'line', 'text', 'g',
    ]);
  });

  it('内置能力同样登记为已安装插件，不能再装一次', () => {
    const { host } = setup();
    expect(host.installed()).toEqual(['builtin-shapes', 'builtin-commands']);
    expect(() => installBuiltins(host)).toThrow('duplicate registration: plugins/builtin-shapes');
  });
});

describe('PluginHost.install 提交', () => {
  it('提交后图形、命令、属性处理器、树装饰器全部生效', () => {
    const { host, run } = setup();
    const hello = { ...noop('hello'), execute: (_a: readonly string[], c: { output: { write(t: string): void } }) => c.output.write('hi') };
    const decorator: TreeDecorator = { name: 'composite', decorate: (n) => (n.shape.isComposite() ? '(c)' : undefined) };
    host.install(new FakeBoxPlugin(), FAKE_BOX_MANIFEST);
    const extension = extensionPlugin('ext', {
      commands: [hello],
      attributeHandlers: [new FakeBoxAttributeHandler()],
      treeDecorators: [decorator],
    });
    host.install(extension.plugin, extension.manifest);

    expect(run('hello').out).toEqual(['hi']);
    run('init', 'create box n1 0 0 100 40 "Hi"');
    expect(run('set n1 fill red').out).toEqual(['fill propagated to n1-rect']);
    expect(run('tree').out[0].split('\n')[1]).toBe('└── g#n1 (c)');
    expect(run('help').out[0]).toContain('create box <id>');
  });

  it('options 作为 activate 的第二个参数传入', () => {
    const { host } = setup();
    let seen: unknown;
    const p = plugin({ name: 'opt', contributes: {} }, (_c, options) => {
      seen = options;
    });
    host.install(p.plugin, p.manifest, { level: 3 });
    expect(seen).toEqual({ level: 3 });
  });

  it('带 onDocumentEvent 的装饰器被自动订阅会话事件', () => {
    const { host, run } = setup();
    const events: string[] = [];
    const stateful: TreeDecorator = {
      name: 'stateful',
      decorate: () => undefined,
      onDocumentEvent: (event) => events.push(event),
    };
    const ext = extensionPlugin('stateful-plugin', { treeDecorators: [stateful] });
    host.install(ext.plugin, ext.manifest);
    run('init', 'create rect r1 0 0 1 1', 'undo');
    expect(events).toEqual(['opened', 'edited', 'edited']);
  });
});

describe('PluginHost.install 失败与回滚', () => {
  function expectUntouched(host: ReturnType<typeof setup>['host'], names: string[]): void {
    expect(host.installed()).toEqual(['builtin-shapes', 'builtin-commands', ...names]);
  }

  it('activate 抛错：全部暂存登记被撤销，错误文案固定', () => {
    const { host, factory, run } = setup();
    const p = plugin(
      { name: 'boom', contributes: { shapes: ['box'], commands: ['x'] } },
      (context) => {
        context.registerShape(new FakeBoxProvider());
        context.registerCommand(noop('x'));
        throw new Error('kaboom');
      },
    );
    expect(() => host.install(p.plugin, p.manifest)).toThrow('plugin failed to activate: boom (kaboom)');
    expect(factory.typeNames()).not.toContain('box');
    expect(run('x').err).toEqual(['unknown command: x']);
    expectUntouched(host, []);
  });

  it('缺少 activate 同样按激活失败处理', () => {
    const { host } = setup();
    expect(() => host.install({} as Plugin, { name: 'empty', contributes: {} })).toThrow(
      'plugin failed to activate: empty (missing activate)',
    );
  });

  it('清单声明与实际登记不一致：整个插件被拒绝，且不影响内核', () => {
    const { host, factory } = setup();
    const extra = plugin({ name: 'liar', contributes: { shapes: ['box'] } }, (context) => {
      context.registerShape(new FakeBoxProvider());
      context.registerCommand(noop('sneaky'));
    });
    expect(() => host.install(extra.plugin, extra.manifest)).toThrow(
      'plugin manifest mismatch: liar (registered but not declared: commands/sneaky)',
    );
    const missing = plugin({ name: 'shy', contributes: { commands: ['a', 'b'] } }, (context) =>
      context.registerCommand(noop('a')),
    );
    expect(() => host.install(missing.plugin, missing.manifest)).toThrow(
      'plugin manifest mismatch: shy (declared but not registered: commands/b)',
    );
    expect(factory.typeNames()).not.toContain('box');
    expectUntouched(host, []);
  });

  it('非法清单在激活前被拒绝（不会调用 activate）', () => {
    const { host } = setup();
    let called = false;
    const activate = () => {
      called = true;
    };
    expect(() => host.install({ activate }, { name: '', contributes: {} })).toThrow(
      'plugin manifest mismatch: <unnamed> (manifest has no name)',
    );
    expect(() =>
      host.install({ activate }, { name: 'bad', contributes: { shapes: 'box' as never } }),
    ).toThrow('plugin manifest mismatch: bad (contributes.shapes must be a string array)');
    expect(called).toBe(false);
  });

  it('与已装插件重名：duplicate registration，已有插件不受影响', () => {
    const { host, factory, run } = setup();
    host.install(new FakeBoxPlugin(), FAKE_BOX_MANIFEST);
    const clash = plugin(
      { name: 'box-again', contributes: { shapes: ['box'], commands: ['fresh'] } },
      (context) => {
        context.registerCommand(noop('fresh'));
        context.registerShape(new FakeBoxProvider());
      },
    );
    expect(() => host.install(clash.plugin, clash.manifest)).toThrow('duplicate registration: shapes/box');
    expect(run('fresh').err).toEqual(['unknown command: fresh']);
    expect(factory.typeNames().filter((name) => name === 'box')).toHaveLength(1);
    expect(() => host.install(new FakeBoxPlugin(), FAKE_BOX_MANIFEST)).toThrow(
      'duplicate registration: plugins/fake-box',
    );
  });

  it('与内置命令、help 重名；插件内部重名也检测', () => {
    const { host } = setup();
    const tree = extensionPlugin('t', { commands: [noop('tree')] });
    expect(() => host.install(tree.plugin, tree.manifest)).toThrow('duplicate registration: commands/tree');
    const help = extensionPlugin('h', { commands: [noop('help')] });
    expect(() => host.install(help.plugin, help.manifest)).toThrow('duplicate registration: commands/help');
    const twice = plugin({ name: 'twice', contributes: { commands: ['dup'] } }, (context) => {
      context.registerCommand(noop('dup'));
      context.registerCommand(noop('dup'));
    });
    expect(() => host.install(twice.plugin, twice.manifest)).toThrow('duplicate registration: commands/dup');
    expectUntouched(host, []);
  });

  it('重名的属性处理器与树装饰器同样被拒绝，且不留下半个插件', () => {
    const { host } = setup();
    const first = extensionPlugin('first', {
      attributeHandlers: [new FakeBoxAttributeHandler()],
      treeDecorators: [{ name: 'tag', decorate: () => undefined }],
    });
    host.install(first.plugin, first.manifest);
    const second = extensionPlugin('second', {
      commands: [noop('late')],
      treeDecorators: [{ name: 'tag', decorate: () => undefined }],
    });
    expect(() => host.install(second.plugin, second.manifest)).toThrow(
      'duplicate registration: treeDecorators/tag',
    );
    const third = extensionPlugin('third', { attributeHandlers: [new FakeBoxAttributeHandler()] });
    expect(() => host.install(third.plugin, third.manifest)).toThrow(
      'duplicate registration: attributeHandlers/fake-box-attributes',
    );
    expectUntouched(host, ['first']);
  });

  it('activate 返回后上下文失效', () => {
    const { host } = setup();
    let captured: PluginContext | undefined;
    const p = plugin({ name: 'late', contributes: {} }, (context) => {
      captured = context;
    });
    host.install(p.plugin, p.manifest);
    expect(() => captured?.registerCommand(noop('too-late'))).toThrow('plugin context is closed');
  });

  it('没有名字的登记项在激活期被拒绝', () => {
    const { host } = setup();
    const p = plugin({ name: 'nameless', contributes: {} }, (context) =>
      context.registerCommand({ name: '', usage: '', execute: () => undefined }),
    );
    expect(() => host.install(p.plugin, p.manifest)).toThrow(
      'plugin failed to activate: nameless (commands registration without a name)',
    );
  });

  it('一个插件安装失败后，宿主仍可继续安装其他插件', () => {
    const { host, run } = setup();
    const bad = plugin({ name: 'bad', contributes: {} }, () => {
      throw new Error('x');
    });
    expect(() => host.install(bad.plugin, bad.manifest)).toThrow();
    host.install(new FakeBoxPlugin(), FAKE_BOX_MANIFEST);
    expect(run('init', 'create box n1 0 0 10 10 "T"').out.at(-1)).toContain('box#n1 created');
    expect(host.services.factory).toBeInstanceOf(ShapeFactory);
  });
});
