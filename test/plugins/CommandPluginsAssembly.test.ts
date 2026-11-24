import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Writable } from 'node:stream';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CODE_PLUGINS, createCli } from '../../src/main';

class Memory {
  text = '';
  write(chunk: string): void {
    this.text += chunk;
  }
}

const REPO = resolve(__dirname, '../..');
const STATS = join(REPO, 'plugins/command-stats');
const DIR = join(REPO, 'plugins/command-dir');

let root: string;
let workdir: string;

beforeAll(() => {
  // 方式 B 经由 package.json 的 main 加载编译产物，需要先 `tsc`（npm test 的 pretest 会做）。
  for (const plugin of ['command-stats', 'command-dir']) {
    if (!existsSync(join(REPO, 'dist/plugins', plugin, 'index.js'))) {
      throw new Error('dist/plugins is missing: run `npm run build` before this test');
    }
  }
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'svg-cmdplugins-'));
  // 内容固定的“当前目录”；配置文件放在它之外，避免改变目录列表。
  workdir = join(root, 'work');
  mkdirSync(join(workdir, 'sub'), { recursive: true });
  writeFileSync(join(workdir, 'b.txt'), '');
  writeFileSync(join(workdir, 'a.txt'), '');
  writeFileSync(join(workdir, '.hidden'), '');
  vi.spyOn(process, 'cwd').mockReturnValue(workdir);
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

function writeConfig(plugins: unknown[]): string {
  const path = join(root, 'plugins.config.json');
  writeFileSync(path, JSON.stringify({ plugins }));
  return path;
}

function build(source: Parameters<typeof createCli>[2]) {
  const stdout = new Memory();
  const stderr = new Memory();
  const cli = createCli(stdout as unknown as Writable, stderr as unknown as Writable, source);
  return (line: string) => {
    stdout.text = '';
    stderr.text = '';
    cli.executeLine(line);
    return { out: stdout.text, err: stderr.text };
  };
}

// 这组测试只关心 stats 与 dir：代码装配一侧固定为这两个插件，不随后续新增的插件（如 box）变化。
const COMMAND_ENTRIES = CODE_PLUGINS.filter((entry) =>
  ['command-stats', 'command-dir'].includes(entry.manifest.name),
);

/** 后续插件（如 box）可能让 help 多出别的 shapes 用法行，比较命令表时忽略它。 */
const withoutBoxUsage = (result: { out: string; err: string }) => ({
  ...result,
  out: result.out
    .split('\n')
    .filter((line) => !line.includes('create box '))
    .join('\n'),
});

const SESSION = [
  'dir',
  'stats',
  'init 100 100',
  'create rect r1 0 0 10 10',
  'create circle c1 5 5 3',
  'create g g1',
  'create text t1 1 1 "x" in g1',
  'stats',
  'dir',
  'undo',
  'stats',
  'help',
];

describe('stats 与 dir 的两种装配', () => {
  it('默认的代码装配列表包含这两个插件', () => {
    expect(CODE_PLUGINS.map((entry) => entry.manifest.name).slice(0, 2)).toEqual([
      'command-stats',
      'command-dir',
    ]);
  });

  it('A（代码装配）与 B（配置装配）对同一会话的输出逐字节一致', () => {
    const viaCode = build(COMMAND_ENTRIES);
    const viaConfig = build({
      kind: 'config',
      configPath: writeConfig([{ module: STATS }, { module: DIR }]),
    });
    const outputs = SESSION.map((line) => [viaCode(line), viaConfig(line)]);
    for (const [code, config] of outputs) expect(config).toEqual(code);

    const dir = viaConfig('dir');
    expect(dir).toEqual({
      out: '[DIR]  sub\n[FILE] .hidden\n[FILE] a.txt\n[FILE] b.txt\n',
      err: '',
    });
    // 会话最后一次 undo 撤销了 t1，所以只剩 r1、c1 与空容器 g1
    expect(viaConfig('stats').out).toBe('rect: 1  circle: 1  (total 2, containers 1)\n');
  });

  it('相对路径的配置项与绝对路径加载同一个实现', () => {
    const config = join(REPO, 'plugins.config.json');
    const viaRepoConfig = build({ kind: 'config', configPath: config });
    const viaCode = build({ kind: 'code' });
    expect(viaRepoConfig('dir')).toEqual(viaCode('dir'));
    expect(withoutBoxUsage(viaRepoConfig('help'))).toEqual(withoutBoxUsage(viaCode('help')));
  });

  it('两个插件可单独启用或禁用；未加载时报 unknown command', () => {
    const onlyStats = build({ kind: 'config', configPath: writeConfig([{ module: STATS }]) });
    expect(onlyStats('dir').err).toBe('error: unknown command: dir\n');
    expect(onlyStats('help').out).toContain('  stats');
    expect(onlyStats('help').out).not.toContain('  dir');

    const onlyDir = build({
      kind: 'config',
      configPath: writeConfig([{ module: STATS, enabled: false }, { module: DIR }]),
    });
    expect(onlyDir('stats').err).toBe('error: unknown command: stats\n');
    expect(onlyDir('help').out).toContain('  dir');

    const none = build({ kind: 'none' });
    expect(none('stats').err).toBe('error: unknown command: stats\n');
    expect(none('dir').err).toBe('error: unknown command: dir\n');
    expect(none('help').out).not.toMatch(/ {2}(stats|dir)\n/);
  });

  it('dir 读取失败的错误输出在两种装配下一致', () => {
    vi.spyOn(process, 'cwd').mockReturnValue(join(root, 'missing'));
    const viaCode = build({ kind: 'code' });
    const viaConfig = build({ kind: 'config', configPath: writeConfig([{ module: DIR }]) });
    expect(viaConfig('dir')).toEqual(viaCode('dir'));
    expect(viaCode('dir').err).toBe(`error: cannot read directory: ${join(root, 'missing')}\n`);
  });
});
