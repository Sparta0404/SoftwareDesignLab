import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCli } from '../../src/main';
import type { PluginEntry } from '../../src/main';

class Memory {
  text = '';
  write(chunk: string): void {
    this.text += chunk;
  }
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'svg-main-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function build(...args: [Parameters<typeof createCli>[2]?, Parameters<typeof createCli>[3]?]) {
  const stdout = new Memory();
  const stderr = new Memory();
  const cli = createCli(stdout as unknown as Writable, stderr as unknown as Writable, ...args);
  const run = (line: string) => {
    stdout.text = '';
    stderr.text = '';
    cli.executeLine(line);
    return { out: stdout.text, err: stderr.text };
  };
  return { run, stderr, stdout };
}

function writePlugin(): string {
  mkdirSync(join(root, 'plugins/ping'), { recursive: true });
  writeFileSync(
    join(root, 'plugins/ping/package.json'),
    JSON.stringify({ name: 'ping', main: 'index.js', contributes: { commands: ['ping'] } }),
  );
  writeFileSync(
    join(root, 'plugins/ping/index.js'),
    `exports.default = { activate(ctx, options) {
      ctx.registerCommand({ name: 'ping', usage: 'ping', execute(a, c) { c.output.write('pong ' + (options && options.word)); } });
    } };`,
  );
  return join(root, 'plugins.config.json');
}

const codeEntry: PluginEntry = {
  manifest: { name: 'ping', contributes: { commands: ['ping'] } },
  options: { word: 'code' },
  plugin: {
    activate: (ctx, options) =>
      ctx.registerCommand({
        name: 'ping',
        usage: 'ping',
        execute: (_args, c) => c.output.write(`pong ${(options as { word: string }).word}`),
      }),
  },
};

describe('createCli 的插件来源', () => {
  it('--config：加载配置里的插件，options 生效', () => {
    const config = writePlugin();
    writeFileSync(
      config,
      JSON.stringify({ plugins: [{ module: './plugins/ping', options: { word: 'config' } }] }),
    );
    const { run, stderr } = build({ kind: 'config', configPath: config });

    expect(run('ping')).toEqual({ out: 'pong config\n', err: '' });
    expect(stderr.text).toBe('');
  });

  it('--config 非法：输出 invalid plugin config，仍以内置能力启动', () => {
    const config = join(root, 'plugins.config.json');
    writeFileSync(config, '{ broken');
    const { run, stderr } = build({ kind: 'config', configPath: config });

    expect(stderr.text).toMatch(/^error: invalid plugin config: .*plugins\.config\.json \(not valid JSON/);
    expect(run('ping').err).toBe('error: unknown command: ping\n');
    expect(run('init 10 10').err).toBe('');
    expect(run('help').out).toContain('create');
  });

  it('--config 指向不存在的文件：同样以内置能力启动', () => {
    const { run, stderr } = build({ kind: 'config', configPath: join(root, 'nope.json') });

    expect(stderr.text).toMatch(/^error: invalid plugin config: .* \(cannot read file/);
    expect(run('init 10 10').err).toBe('');
  });

  it('--config 中单个插件失败：输出该错误，其余插件照常', () => {
    const config = writePlugin();
    writeFileSync(
      config,
      JSON.stringify({
        plugins: [{ module: './plugins/missing' }, { module: './plugins/ping', options: { word: 'x' } }],
      }),
    );
    const { run, stderr } = build({ kind: 'config', configPath: config });

    expect(stderr.text).toBe('error: plugin not found: ./plugins/missing\n');
    expect(run('ping').out).toBe('pong x\n');
  });

  it('--no-plugins：忽略代码装配列表，只留内置能力', () => {
    const { run } = build({ kind: 'none' }, [codeEntry]);

    expect(run('ping').err).toBe('error: unknown command: ping\n');
  });

  it('默认（code）：使用代码装配列表；也可直接传入条目数组', () => {
    expect(build({ kind: 'code' }, [codeEntry]).run('ping').out).toBe('pong code\n');
    expect(build([codeEntry]).run('ping').out).toBe('pong code\n');
  });

  it('A、B 两种装配对同一插件的输出一致', () => {
    const config = writePlugin();
    writeFileSync(
      config,
      JSON.stringify({ plugins: [{ module: './plugins/ping', options: { word: 'code' } }] }),
    );
    const viaCode = build({ kind: 'code' }, [codeEntry]);
    const viaConfig = build({ kind: 'config', configPath: config });

    expect(viaConfig.run('ping')).toEqual(viaCode.run('ping'));
    expect(viaConfig.run('help')).toEqual(viaCode.run('help'));
  });
});
