import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Writable } from 'node:stream';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CODE_PLUGINS, createCli, type PluginEntry } from '../../src/main';
import boxPlugin, { manifest as boxManifest } from '../../plugins/shape-box/index';
import starPlugin, { manifest as starManifest } from '../../plugins/tree-star/index';

class Memory {
  text = '';
  write(chunk: string): void {
    this.text += chunk;
  }
}

const REPO = resolve(__dirname, '../..');
const BOX = join(REPO, 'plugins/shape-box');
const STAR = join(REPO, 'plugins/tree-star');
const TRANSCRIPT = join(REPO, 'doc/transcript/tree-star.txt');
const EXPECTED = join(REPO, 'doc/transcript/tree-star.expected.txt');

type Source = Parameters<typeof createCli>[2];

let original: string;
let workdir: string;
let configDir: string;

beforeAll(() => {
  // 方式 B 经由 package.json 的 main 加载编译产物，需要先 `tsc`（npm test 的 pretest 会做）。
  for (const plugin of ['shape-box', 'tree-star']) {
    if (!existsSync(join(REPO, `dist/plugins/${plugin}/index.js`))) {
      throw new Error(`dist/plugins/${plugin} is missing: run \`npm run build\` before this test`);
    }
  }
});

beforeEach(() => {
  original = process.cwd();
  workdir = mkdtempSync(join(tmpdir(), 'svg-starasm-'));
  configDir = mkdtempSync(join(tmpdir(), 'svg-starcfg-')); // 配置文件放在会话目录之外
  process.chdir(workdir); // 会话里的 `save star-demo.svg` 写到这个临时目录
});

afterEach(() => {
  process.chdir(original);
  rmSync(workdir, { recursive: true, force: true });
  rmSync(configDir, { recursive: true, force: true });
});

function writeConfig(plugins: unknown[]): string {
  const path = join(configDir, 'plugins.config.json');
  writeFileSync(path, JSON.stringify({ plugins }));
  return path;
}

/** 回放只含命令与注释的输入：每条命令按“svg> 命令 + 输出”记录。 */
function replay(source: Source): string {
  const stdout = new Memory();
  const stderr = new Memory();
  const cli = createCli(stdout as unknown as Writable, stderr as unknown as Writable, source);
  const log: string[] = [];
  for (const line of readFileSync(TRANSCRIPT, 'utf8').split(/\r?\n/)) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    stdout.text = '';
    stderr.text = '';
    cli.executeLine(line);
    log.push(`svg> ${line}\n${stdout.text}${stderr.text}`);
  }
  return log.join('');
}

const expected = () => readFileSync(EXPECTED, 'utf8').replace(/\r\n/g, '\n');
const stripStars = (text: string) => text.replace(/ \*$/gm, '');

describe('tree-star 插件的两种装配：与 box 的 (box) 标签并存的会话', () => {
  const asCode: PluginEntry[] = [
    { plugin: boxPlugin, manifest: boxManifest },
    { plugin: starPlugin, manifest: starManifest },
  ];
  const viaConfig = (extra: unknown[] = []): Source => ({
    kind: 'config',
    configPath: writeConfig([{ module: BOX }, { module: STAR }, ...extra]),
  });

  it('方式 A（代码装配）完整复现会话', () => {
    expect(replay(asCode)).toBe(expected());
  });

  it('方式 B（配置装配）完整复现会话', () => {
    expect(replay(viaConfig())).toBe(expected());
  });

  it('A 与 B 的会话输出逐字节一致', () => {
    expect(replay(viaConfig())).toBe(replay(asCode));
  });

  it('仓库自带的装配（main.ts 的代码列表与 plugins.config.json）都包含 tree-star，且输出一致', () => {
    expect(CODE_PLUGINS.map((entry) => entry.manifest.name)).toContain('tree-star');
    const repoConfig: Source = { kind: 'config', configPath: join(REPO, 'plugins.config.json') };
    expect(replay(repoConfig)).toBe(replay({ kind: 'code' }));
    expect(replay({ kind: 'code' })).toBe(expected());
  });

  it('禁用 tree-star（enabled:false）：整个会话没有 *，且与有 star 的输出只差行尾 " *"', () => {
    const disabled = replay({
      kind: 'config',
      configPath: writeConfig([{ module: BOX }, { module: STAR, enabled: false }]),
    });
    expect(disabled).not.toContain('*');
    expect(disabled).toBe(stripStars(expected()));
  });

  it('不装 box 只装 tree-star：星号仍然工作，box 命令报未知类型', () => {
    const log = replay({
      kind: 'config',
      configPath: writeConfig([{ module: STAR }]),
    });
    expect(log).toContain('error: unknown shape type: box (is the plugin loaded?)');
    expect(log).toContain('svg> create line arrow1 280 130 520 130 black\nline#arrow1 created');
    expect(log).toContain('svg (800x600) *');
  });
});
