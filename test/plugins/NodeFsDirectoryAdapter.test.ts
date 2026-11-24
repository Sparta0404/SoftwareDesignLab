import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/app/EditorSession';
import type { TextOutput } from '../../src/cli/TextOutput';
import { buildBuiltinCli } from '../support/BuiltinCli';
import { DirPlugin, manifest, NodeFsDirectoryAdapter } from '../../plugins/command-dir/index';

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

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'svg-dir-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** 命令 + 真实文件系统适配器 + 固定“当前目录”的组合。 */
function cliIn(cwd: string) {
  const output = new Recorder();
  const session = new EditorSession(
    { read: () => { throw new Error('unused'); } },
    { write: () => { throw new Error('unused'); } },
    output,
  );
  const cli = buildBuiltinCli(session, output, [
    { plugin: new DirPlugin(new NodeFsDirectoryAdapter(), () => cwd), manifest },
  ]);
  return (line: string) => {
    output.lines = [];
    output.errors = [];
    cli.executeLine(line);
    return { out: [...output.lines], err: [...output.errors] };
  };
}

function populate(): void {
  mkdirSync(join(root, 'plugins'));
  mkdirSync(join(root, 'docs'));
  mkdirSync(join(root, '.git'));
  writeFileSync(join(root, 'package.json'), '{}');
  writeFileSync(join(root, 'demo.svg'), '<svg/>');
  writeFileSync(join(root, '.env'), '');
  // 子目录里的内容不应被递归列出
  writeFileSync(join(root, 'docs', 'nested.md'), '');
}

describe('NodeFsDirectoryAdapter（真实文件系统）', () => {
  it('列出直接子项的名称与种类，含隐藏项，不递归', () => {
    populate();
    const entries = [...new NodeFsDirectoryAdapter().list(root)];
    const sorted = entries.sort((a, b) => a.name.localeCompare(b.name));
    expect(sorted).toEqual(
      [
        { name: '.env', kind: 'file' },
        { name: '.git', kind: 'directory' },
        { name: 'demo.svg', kind: 'file' },
        { name: 'docs', kind: 'directory' },
        { name: 'package.json', kind: 'file' },
        { name: 'plugins', kind: 'directory' },
      ].sort((a, b) => a.name.localeCompare(b.name)),
    );
  });

  it('空目录返回空列表；不存在的目录抛错', () => {
    expect(new NodeFsDirectoryAdapter().list(root)).toEqual([]);
    expect(() => new NodeFsDirectoryAdapter().list(join(root, 'missing'))).toThrow();
  });

  it('路径是文件而不是目录时抛错', () => {
    writeFileSync(join(root, 'f.txt'), '');
    expect(() => new NodeFsDirectoryAdapter().list(join(root, 'f.txt'))).toThrow();
  });

  it('符号链接不跟随：指向目录的链接也显示为文件（无权限创建链接时跳过）', () => {
    mkdirSync(join(root, 'real'));
    try {
      symlinkSync(join(root, 'real'), join(root, 'link'), 'dir');
    } catch {
      return;
    }
    const kinds = new Map(new NodeFsDirectoryAdapter().list(root).map((e) => [e.name, e.kind]));
    expect(kinds.get('real')).toBe('directory');
    expect(kinds.get('link')).toBe('file');
  });
});

describe('dir 命令 + 真实适配器', () => {
  it('输出目录在前、文件在后，各组升序，含隐藏项', () => {
    populate();
    expect(cliIn(root)('dir')).toEqual({
      out: [
        [
          '[DIR]  .git',
          '[DIR]  docs',
          '[DIR]  plugins',
          '[FILE] .env',
          '[FILE] demo.svg',
          '[FILE] package.json',
        ].join('\n'),
      ],
      err: [],
    });
  });

  it('空目录输出 (empty directory)', () => {
    expect(cliIn(root)('dir')).toEqual({ out: ['(empty directory)'], err: [] });
  });

  it('读取失败输出带路径的错误，之后仍可执行其他命令', () => {
    const missing = join(root, 'gone');
    const run = cliIn(missing);
    expect(run('dir')).toEqual({ out: [], err: [`cannot read directory: ${missing}`] });
    expect(run('init').err).toEqual([]);
    expect(run('stats').err).toEqual(["unknown command: stats"]);
  });

  it('重复执行输出一致', () => {
    populate();
    const run = cliIn(root);
    expect(run('dir')).toEqual(run('dir'));
  });
});
