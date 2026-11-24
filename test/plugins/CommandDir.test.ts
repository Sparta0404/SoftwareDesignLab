import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/app/EditorSession';
import type { CommandContext } from '../../src/cli/Command';
import type { TextOutput } from '../../src/cli/TextOutput';
import { buildBuiltinCli } from '../support/BuiltinCli';
import dirPlugin, {
  DirCommand,
  DirPlugin,
  manifest,
  type DirectoryEntry,
  type DirectoryLister,
} from '../../plugins/command-dir/index';
import packageJson from '../../plugins/command-dir/package.json';

class Recorder implements TextOutput {
  lines: string[] = [];
  errors: string[] = [];
  write(text: string): void {
    this.lines.push(text);
  }
  writeError(message: string): void {
    this.errors.push(message);
  }
  warn(): void {}
}

/** 测试替身（Stub）：返回固定条目，或抛错；记录被询问的路径。 */
class StubLister implements DirectoryLister {
  readonly requested: string[] = [];
  constructor(private readonly result: readonly DirectoryEntry[] | Error) {}
  list(path: string): readonly DirectoryEntry[] {
    this.requested.push(path);
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

const dir = (name: string): DirectoryEntry => ({ name, kind: 'directory' });
const file = (name: string): DirectoryEntry => ({ name, kind: 'file' });

/** 任何对 session 的访问都会失败：证明 dir 完全不碰文档会话。 */
function untouchableContext(output: TextOutput): CommandContext {
  const session = new Proxy({}, {
    get: (_target, property) => {
      throw new Error(`dir must not touch session.${String(property)}`);
    },
  }) as EditorSession;
  return { session, output };
}

function runDir(entries: readonly DirectoryEntry[] | Error, args: string[] = [], cwd = '/work') {
  const output = new Recorder();
  const lister = new StubLister(entries);
  const command = new DirCommand(lister, () => cwd);
  let error: Error | undefined;
  try {
    command.execute(args, untouchableContext(output));
  } catch (caught) {
    error = caught as Error;
  }
  return { out: output.lines, error: error?.message, lister };
}

describe('dir 命令（测试替身）', () => {
  it('清单与插件包 package.json 一致，且只贡献 dir 命令', () => {
    expect(manifest).toEqual({ name: packageJson.name, contributes: packageJson.contributes });
    expect(manifest.contributes).toEqual({ commands: ['dir'] });
  });

  it('混合文件与子目录：目录在前，标记后跟两个空格（[DIR]）或一个空格（[FILE]）', () => {
    const { out, lister } = runDir([file('demo.svg'), dir('plugins'), file('package.json'), dir('docs')]);
    expect(out).toEqual([
      '[DIR]  docs\n[DIR]  plugins\n[FILE] demo.svg\n[FILE] package.json',
    ]);
    expect(lister.requested).toEqual(['/work']);
  });

  it('空目录', () => {
    expect(runDir([]).out).toEqual(['(empty directory)']);
  });

  it('包含以 . 开头的隐藏项', () => {
    const { out } = runDir([file('.env'), dir('.git'), file('a.txt')]);
    expect(out).toEqual(['[DIR]  .git\n[FILE] .env\n[FILE] a.txt']);
  });

  it('读取失败：error 带目标路径，原始错误细节不外泄', () => {
    const { out, error } = runDir(new Error('EACCES: secret detail'), [], 'C:\\locked');
    expect(out).toEqual([]);
    expect(error).toBe('cannot read directory: C:\\locked');
  });

  it('排序稳定：与输入顺序无关，按码点升序（大写在小写前，补充平面字符在 BMP 之后）', () => {
    const entries = [file('b'), file('B'), file('a'), file('\u{1F600}'), file('\uFFFD'), file('ab'), file('_')];
    const reversed = [...entries].reverse();
    const expected = ['B', '_', 'a', 'ab', 'b', '\uFFFD', '\u{1F600}']
      .map((name) => `[FILE] ${name}`)
      .join('\n');
    expect(runDir(entries).out).toEqual([expected]);
    expect(runDir(reversed).out).toEqual([expected]);
  });

  it('各组分别排序，目录与文件同名时目录在前', () => {
    const { out } = runDir([file('x'), dir('z'), dir('x'), file('a')]);
    expect(out).toEqual(['[DIR]  x\n[DIR]  z\n[FILE] a\n[FILE] x']);
  });

  it('不改动传入的条目数组', () => {
    const entries = Object.freeze([file('b'), dir('a')]);
    expect(runDir(entries).error).toBeUndefined();
  });

  it('不接收参数', () => {
    const { out, error, lister } = runDir([file('a')], ['x']);
    expect(error).toBe('usage: dir');
    expect(out).toEqual([]);
    expect(lister.requested).toEqual([]);
  });

  it('每次执行都重新读取当前目录', () => {
    let cwd = '/one';
    const lister = new StubLister([]);
    const command = new DirCommand(lister, () => cwd);
    const output = new Recorder();
    command.execute([], untouchableContext(output));
    cwd = '/two';
    command.execute([], untouchableContext(output));
    expect(lister.requested).toEqual(['/one', '/two']);
  });
});

describe('dir 与文档会话', () => {
  function build(lister: DirectoryLister) {
    const output = new Recorder();
    const session = new EditorSession(
      { read: () => { throw new Error('unused'); } },
      { write: () => { throw new Error('unused'); } },
      output,
    );
    const cli = buildBuiltinCli(session, output, [
      { plugin: new DirPlugin(lister, () => '/work'), manifest },
    ]);
    const run = (...lines: string[]) => {
      output.lines = [];
      output.errors = [];
      lines.forEach((line) => cli.executeLine(line));
      return { out: [...output.lines], err: [...output.errors] };
    };
    return { run };
  }

  it('已加载时出现在 help 中', () => {
    expect(build(new StubLister([])).run('help').out[0]).toContain('  dir');
  });

  it('未执行 init 或 read 时可用', () => {
    const { run } = build(new StubLister([dir('d'), file('f')]));
    expect(run('dir')).toEqual({ out: ['[DIR]  d\n[FILE] f'], err: [] });
    expect(run('tree').err).toEqual(["no document. use 'init' or 'read' first"]);
  });

  it('有文档时成功或失败都不改变文档与 undo/redo 历史', () => {
    const ok = build(new StubLister([file('a')]));
    ok.run('init', 'create rect r1 0 0 10 10', 'create rect r2 0 0 10 10');
    ok.run('undo');
    const before = ok.run('tree').out;
    ok.run('dir', 'dir');
    expect(ok.run('tree').out).toEqual(before);
    // redo 栈还在，undo 栈也没被 dir 顶替
    expect(ok.run('redo').out).toEqual(['rect#r2 created']);
    expect(ok.run('undo', 'undo').out).toEqual(['rect#r2 deleted', 'rect#r1 deleted']);

    const failing = build(new StubLister(new Error('boom')));
    failing.run('init', 'create rect r1 0 0 10 10');
    const treeBefore = failing.run('tree').out;
    expect(failing.run('dir').err).toEqual(['cannot read directory: /work']);
    expect(failing.run('tree').out).toEqual(treeBefore);
    expect(failing.run('undo').out).toEqual(['rect#r1 deleted']);
    expect(failing.run('undo').err).toEqual(['nothing to undo']);
  });

  it('默认插件实例使用真实适配器（同一个 DirectoryLister 接口）', () => {
    expect(dirPlugin).toBeInstanceOf(DirPlugin);
  });
});
