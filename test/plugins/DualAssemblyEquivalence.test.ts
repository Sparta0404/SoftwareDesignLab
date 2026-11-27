import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Writable } from 'node:stream';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createCli } from '../../src/main';

class Memory {
  text = '';
  write(chunk: string): void {
    this.text += chunk;
  }
}

const REPO = resolve(__dirname, '../..');
const TRANSCRIPTS = join(REPO, 'doc/transcript');
const ENTRY = join(REPO, 'dist/src/main.js');
const REPO_CONFIG = join(REPO, 'plugins.config.json');

type Source = Parameters<typeof createCli>[2];

interface Session {
  readonly title: string;
  readonly input: string;
  readonly expected: string;
  /** dir 命令要求当前目录内容固定，这类会话在预置好的目录里跑。 */
  readonly fixedDirectory?: boolean;
}

const SESSIONS: readonly Session[] = [
  { title: '基础会话（Phase 1 CLI）', input: 'cli-1.txt', expected: 'cli-1.expected.txt' },
  {
    title: 'box 会话（流程图）',
    input: 'box-flowchart.txt',
    expected: 'box-flowchart.full.expected.txt',
  },
  {
    title: 'stats + dir 会话',
    input: 'stats-dir.txt',
    expected: 'stats-dir.expected.txt',
    fixedDirectory: true,
  },
];

let original: string;
let root: string;

beforeAll(() => {
  // 进程级对照与配置装配都走编译产物，需要先 `tsc`（npm test 的 pretest 会做）。
  if (!existsSync(ENTRY) || !existsSync(join(REPO, 'dist/plugins/tree-star/index.js'))) {
    throw new Error('dist is missing: run `npm run build` before this test');
  }
});

beforeEach(() => {
  original = process.cwd();
  root = mkdtempSync(join(tmpdir(), 'svg-equiv-'));
});

afterEach(() => {
  process.chdir(original);
  rmSync(root, { recursive: true, force: true });
});

/** 新建一个会话工作目录；固定目录里放 sub/、.hidden、a.txt、b.txt，日志与配置都不写进来。 */
function freshDirectory(session: Session): string {
  const directory = mkdtempSync(join(root, 'work-'));
  if (session.fixedDirectory) {
    mkdirSync(join(directory, 'sub'));
    for (const name of ['b.txt', 'a.txt', '.hidden']) writeFileSync(join(directory, name), '');
  }
  return directory;
}

const read = (name: string) => readFileSync(join(TRANSCRIPTS, name), 'utf8').replace(/\r\n/g, '\n');
const commandsOf = (name: string) =>
  read(name)
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.trim().startsWith('#'));

/** 进程内回放：每条命令按“svg> 命令 + 输出”记录，与单独保存的预期输出比较。 */
function replay(session: Session, source: Source): string {
  process.chdir(freshDirectory(session));
  const stdout = new Memory();
  const stderr = new Memory();
  const cli = createCli(stdout as unknown as Writable, stderr as unknown as Writable, source);
  const log: string[] = [];
  for (const line of commandsOf(session.input)) {
    stdout.text = '';
    stderr.text = '';
    cli.executeLine(line);
    log.push(`svg> ${line}\n${stdout.text}${stderr.text}`);
  }
  process.chdir(original);
  return log.join('');
}

/** 进程级回放：`<入口> [参数] < 输入`，stdout 与 stderr 分开保留原始字节。 */
function runProcess(session: Session, args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [ENTRY, ...args], {
    cwd: freshDirectory(session),
    input: readFileSync(join(TRANSCRIPTS, session.input)),
    encoding: 'buffer',
  });
  return {
    status: result.status,
    stdout: result.stdout.toString('utf8'),
    stderr: result.stderr.toString('utf8'),
  };
}

const stripStars = (text: string) => text.replace(/ \*$/gm, '');

describe('双装配等价：代码装配与配置装配对同一份输入的输出逐字节一致', () => {
  it('每个会话都有输入与单独保存的期望输出', () => {
    for (const session of SESSIONS) {
      expect(commandsOf(session.input).length, session.input).toBeGreaterThan(5);
      expect(read(session.expected).length, session.expected).toBeGreaterThan(0);
      // 输入文件只含命令与注释，不含输出
      expect(read(session.input), session.input).not.toMatch(/^svg> /m);
    }
  });

  describe.each(SESSIONS)('$title', (session) => {
    it('进程内：代码装配复现期望输出', () => {
      expect(replay(session, { kind: 'code' })).toBe(read(session.expected));
    });

    it('进程内：配置装配（plugins.config.json）复现期望输出', () => {
      expect(replay(session, { kind: 'config', configPath: REPO_CONFIG })).toBe(
        read(session.expected),
      );
    });

    it('进程内：代码装配与配置装配的输出逐字节一致', () => {
      expect(replay(session, { kind: 'config', configPath: REPO_CONFIG })).toBe(
        replay(session, { kind: 'code' }),
      );
    });

    it('进程级：`<入口> < 输入` 与 `<入口> --config plugins.config.json < 输入` 的 stdout/stderr 逐字节一致', () => {
      const viaCode = runProcess(session, []);
      const viaConfig = runProcess(session, ['--config', REPO_CONFIG]);
      expect(viaCode.status).toBe(0);
      expect(viaConfig.status).toBe(0);
      expect(viaCode.stdout).toContain('svg> ');
      expect(viaConfig.stdout).toBe(viaCode.stdout);
      expect(viaConfig.stderr).toBe(viaCode.stderr);
    });

    it('进程级：输出里的命令回显与进程内回放一致（stdout 去掉提示符后是期望输出 stdout 部分的子序列）', () => {
      const viaCode = runProcess(session, []);
      const outLines = viaCode.stdout.replace(/svg> /g, '').split(/\r?\n/);
      // 期望输出里没有 error:/warning: 前缀的行都应按顺序出现在进程 stdout 中。
      const wanted = read(session.expected)
        .split('\n')
        .filter((line) => line !== '' && !line.startsWith('svg> ') && !/^(error|warning): /.test(line));
      let cursor = 0;
      for (const line of wanted) {
        const found = outLines.indexOf(line, cursor);
        expect(found, `missing in process output: ${line}`).toBeGreaterThanOrEqual(0);
        cursor = found + 1;
      }
    });
  });

  it('基础会话与 --no-plugins 基线一致：差别只有行尾的 " *" 与 help 里插件贡献的行', () => {
    const session = SESSIONS[0];
    const full = replay(session, { kind: 'code' });
    const baseline = replay(session, { kind: 'none' });
    const helpAt = (text: string) => text.indexOf('svg> help\n');
    expect(helpAt(full)).toBeGreaterThan(0);
    // help 之前的全部输出：去掉 tree-star 的标记后与基线逐字节相同
    expect(stripStars(full.slice(0, helpAt(full)))).toBe(baseline.slice(0, helpAt(baseline)));
    // help：插件只多出 stats / dir / create box 三行
    const extra = full
      .slice(helpAt(full))
      .split('\n')
      .filter((line) => !baseline.slice(helpAt(baseline)).split('\n').includes(line));
    expect(extra).toEqual(['  stats', '  dir', '  create box <id> <x> <y> <w> <h> "<title>"']);
  });

  it('box 会话：去掉 " *" 后与只装 box 时保存的期望输出一致', () => {
    expect(stripStars(read('box-flowchart.full.expected.txt'))).toBe(
      read('box-flowchart.expected.txt'),
    );
  });

  it('stats + dir 会话：dir 与 stats 不改变 undo 历史，undo 依次撤销的是 b1 与 t1', () => {
    const log = read('stats-dir.expected.txt');
    expect(log).toContain('svg> undo\nbox#b1 deleted\n');
    expect(log).toContain('svg> undo\ntext#t1 deleted\n');
  });
});
