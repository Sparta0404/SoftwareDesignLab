import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Writable } from 'node:stream';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createCli, type PluginEntry } from '../../src/main';
import boxPlugin, { manifest } from '../../plugins/shape-box/index';

class Memory {
  text = '';
  write(chunk: string): void {
    this.text += chunk;
  }
}

const REPO = resolve(__dirname, '../..');
const BOX = join(REPO, 'plugins/shape-box');
const TRANSCRIPT = join(REPO, 'doc/transcript/box-flowchart.txt');
const EXPECTED = join(REPO, 'doc/transcript/box-flowchart.expected.txt');

type Source = Parameters<typeof createCli>[2];

let original: string;
let workdir: string;
let configDir: string;

beforeAll(() => {
  // 方式 B 经由 package.json 的 main 加载编译产物，需要先 `tsc`（npm test 的 pretest 会做）。
  if (!existsSync(join(REPO, 'dist/plugins/shape-box/index.js'))) {
    throw new Error('dist/plugins/shape-box is missing: run `npm run build` before this test');
  }
});

beforeEach(() => {
  original = process.cwd();
  workdir = mkdtempSync(join(tmpdir(), 'svg-boxasm-'));
  configDir = mkdtempSync(join(tmpdir(), 'svg-boxcfg-')); // 配置文件放在会话目录之外
  process.chdir(workdir); // 会话里的 `save flowchart-box.svg` 写到这个临时目录
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

/** 回放只含命令与注释的输入：每条命令按“svg> 命令 + 输出”记录，与单独保存的预期输出比较。 */
function replay(source: Source): { log: string; svg: string } {
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
  const svgPath = join(workdir, 'flowchart-box.svg');
  return { log: log.join(''), svg: existsSync(svgPath) ? readFileSync(svgPath, 'utf8') : '' };
}

const expected = () => readFileSync(EXPECTED, 'utf8').replace(/\r\n/g, '\n');

describe('box 插件的两种装配：Phase 1 §6.1 版本 B 会话', () => {
  const asCode: PluginEntry[] = [{ plugin: boxPlugin, manifest }];

  it('方式 A（代码装配）完整复现会话', () => {
    const { log, svg } = replay(asCode);
    expect(log).toBe(expected());
    expect(svg).toContain('<g id="n2" data-kind="box">');
  });

  it('方式 B（配置装配）完整复现会话', () => {
    const { log, svg } = replay({ kind: 'config', configPath: writeConfig([{ module: BOX }]) });
    expect(log).toBe(expected());
    expect(svg).toContain('<g id="n2" data-kind="box">');
  });

  it('A 与 B 的会话输出与保存的 SVG 文件逐字节一致', () => {
    const viaCode = replay(asCode);
    rmSync(join(workdir, 'flowchart-box.svg'), { force: true });
    const viaConfig = replay({ kind: 'config', configPath: writeConfig([{ module: BOX }]) });
    expect(viaConfig.log).toBe(viaCode.log);
    expect(viaConfig.svg).toBe(viaCode.svg);
    expect(viaCode.svg).not.toBe('');
  });

  it('禁用 box（enabled:false 或没有任何外部插件）时，会话在 create box 处报未知类型', () => {
    const disabled = replay({
      kind: 'config',
      configPath: writeConfig([{ module: BOX, enabled: false }]),
    });
    const none = replay({ kind: 'none' });
    expect(disabled.log).toBe(none.log);
    expect(none.log).toContain(
      'svg> create box n1 120 100 160 60 "开始"\nerror: unknown shape type: box (is the plugin loaded?)\n',
    );
  });
});
