import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error 脚本是 .mjs，没有类型声明
import { formatReport, verifyDiff } from '../../scripts/verify-diff.mjs';

let repo: string;

function git(...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args],
    { cwd: repo, encoding: 'utf8' },
  );
}

function write(file: string, content: string): void {
  const target = join(repo, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

/** 在基础提交上应用一组改动并提交，返回新提交的 sha。 */
function commit(changes: Record<string, string | null>): string {
  for (const [file, content] of Object.entries(changes)) {
    if (content === null) rmSync(join(repo, file));
    else write(file, content);
  }
  git('add', '-A');
  git('commit', '-m', 'change');
  return git('rev-parse', 'HEAD').trim();
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'svg-verify-'));
  git('init', '-q');
  write('src/main.ts', 'main v1\n');
  write('src/kernel/Core.ts', 'core v1\n');
  write('src/loader/Loader.ts', 'import fs from "fs"; // generic loader\n');
  write('plugins/old/index.ts', 'old v1\n');
  write('plugins.config.json', '{"plugins":[]}\n');
  write('package.json', '{}\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

const A = { mode: 'a', plugin: 'plugins/new' };
const B = { mode: 'b', plugin: 'plugins/new' };

function verify(sha: string, options: typeof A) {
  return verifyDiff({ repo, commit: sha, ...options });
}

function failed(result: ReturnType<typeof verify>): string[] {
  return result.checks.filter((check: { ok: boolean }) => !check.ok).map((check: { name: string }) => check.name);
}

describe('verify-diff：方式 A（改装配代码）', () => {
  it('只新增插件并修改装配文件时通过，测试与文档列为辅助变化', () => {
    const sha = commit({
      'plugins/new/index.ts': 'new\n',
      'plugins/new/package.json': '{}\n',
      'src/main.ts': 'main v2\n',
      'test/plugins/New.test.ts': 'test\n',
      'doc/transcript/new.txt': 'doc\n',
    });
    const result = verify(sha, A);
    expect(failed(result)).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.supporting).toEqual(['A\tdoc/transcript/new.txt', 'A\ttest/plugins/New.test.ts']);
    expect(formatReport(result)).toContain('RESULT: PASS');
  });

  it.each([
    ['修改内核', { 'src/kernel/Core.ts': 'core v2\n' }],
    ['修改加载器', { 'src/loader/Loader.ts': 'changed\n' }],
    ['修改既有插件', { 'plugins/old/index.ts': 'old v2\n' }],
    ['同时改了配置文件', { 'plugins.config.json': '{"plugins":[1]}\n' }],
    ['改了其他运行文件', { 'tsconfig.json': '{}\n' }],
  ])('%s 时失败', (_name, extra) => {
    const sha = commit({ 'plugins/new/index.ts': 'new\n', 'src/main.ts': 'main v2\n', ...extra });
    const result = verify(sha, A);
    expect(result.ok).toBe(false);
  });

  it('没有修改装配文件时失败（插件没有被接入）', () => {
    const sha = commit({ 'plugins/new/index.ts': 'new\n' });
    expect(verify(sha, A).ok).toBe(false);
  });

  it('把装配文件之外的 src 改动算作内核差异', () => {
    const sha = commit({
      'plugins/new/index.ts': 'new\n',
      'src/main.ts': 'main v2\n',
      'src/kernel/Core.ts': 'core v2\n',
    });
    const result = verify(sha, A);
    expect(failed(result)).toEqual(
      expect.arrayContaining([expect.stringContaining('kernel, loader and existing plugins unchanged')]),
    );
    expect(result.checks.find((check: { ok: boolean }) => !check.ok && check.details.length > 0)).toBeDefined();
  });
});

describe('verify-diff：方式 B（改配置）', () => {
  it('只新增插件并修改配置文件时通过', () => {
    const sha = commit({
      'plugins/new/index.ts': 'new\n',
      'plugins.config.json': '{"plugins":[{"module":"./plugins/new"}]}\n',
      'package.json': '{"workspaces":[]}\n',
    });
    const result = verify(sha, B);
    expect(failed(result)).toEqual([]);
    expect(result.supporting).toEqual(['M\tpackage.json']);
  });

  it('修改了装配代码 main.ts 时失败', () => {
    const sha = commit({
      'plugins/new/index.ts': 'new\n',
      'plugins.config.json': '{"plugins":[1]}\n',
      'src/main.ts': 'main v2\n',
    });
    expect(verify(sha, B).ok).toBe(false);
  });

  it('没有修改配置文件时失败', () => {
    const sha = commit({ 'plugins/new/index.ts': 'new\n' });
    expect(verify(sha, B).ok).toBe(false);
  });
});

describe('verify-diff：防止“空输出”蒙混过关', () => {
  it('新插件目录在 C^ 中已存在时失败（不是新增）', () => {
    commit({ 'plugins/new/index.ts': 'new\n', 'src/main.ts': 'main v2\n' });
    const sha = commit({ 'plugins/new/index.ts': 'new 2\n', 'src/main.ts': 'main v3\n' });
    expect(verify(sha, A).ok).toBe(false);
  });

  it('指定的插件路径写错（C 中不存在）时失败', () => {
    const sha = commit({ 'plugins/new/index.ts': 'new\n', 'src/main.ts': 'main v2\n' });
    const result = verify(sha, { mode: 'a', plugin: 'plugins/typo' });
    expect(result.ok).toBe(false);
    expect(result.checks[0].details.join('\n')).toContain('plugins/typo does not exist in C');
  });

  it('装配文件路径写错时失败，而不是得到空差异', () => {
    const sha = commit({ 'plugins/new/index.ts': 'new\n', 'src/main.ts': 'main v2\n' });
    const result = verifyDiff({ repo, commit: sha, ...A, assembly: 'src/mian.ts' });
    expect(result.ok).toBe(false);
    expect(result.checks[0].details.join('\n')).toContain('missing in C^: src/mian.ts');
  });

  it('加载器目录出现新插件名字时失败', () => {
    const sha = commit({
      'plugins/new/index.ts': 'new\n',
      'src/main.ts': 'main v2\n',
      'src/loader/Loader.ts': 'import "../../plugins/new";\n',
    });
    const result = verify(sha, A);
    expect(failed(result).join('\n')).toContain('loader does not mention the new plugin');
  });
});
