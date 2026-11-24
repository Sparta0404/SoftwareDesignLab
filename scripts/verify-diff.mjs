#!/usr/bin/env node
/**
 * 插件接入提交的“差异判据”检查（phase_cli_2.md 第 6 节）。设 C 为接入新插件的那次提交：
 *
 *   方式 A（--mode a）：git diff --name-status C^ C
 *     只新增插件包，并且只修改一个顶层装配文件（默认 src/main.ts）；
 *     不得修改内核、加载器与既有插件，也不得改配置文件。
 *   方式 B（--mode b）：git diff --name-status C^ C
 *     既有运行代码（src/ 全部，含 main.ts）一行不动；新增插件包并修改配置文件（默认 plugins.config.json）。
 *   两种方式共同：
 *     git diff C^ C -- src plugins ':(exclude)<新插件包>'  必须为空
 *     （方式 A 额外排除装配文件本身——它是组合根，不是内核）。
 *
 * 允许的辅助变化（测试 test/、文档 doc/ 与 docs/、package.json、package-lock.json）会逐项列出，
 * 供人工逐项说明；任何其他路径都算违反。
 *
 * 空差异不等于通过：本脚本会先确认每个被比较的路径在 C^ 中实际存在（路径写错时 git 会静默返回空），
 * 并确认新插件包在 C^ 中不存在、在 C 中存在。
 * 加载器独立性的搜索只是辅助：脚本只查加载器目录中是否出现新插件的名字，仍须人工复核 import / require / switch。
 *
 * 用法：
 *   node scripts/verify-diff.mjs --commit <C> --mode a|b --plugin plugins/shape-box
 *        [--assembly src/main.ts] [--config plugins.config.json] [--repo <dir>]
 * 退出码：全部通过为 0，否则为 1。
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KERNEL_DIR = 'src';
const PLUGINS_DIR = 'plugins';
const LOADER_DIR = 'src/loader';
const SUPPORTING_FILES = ['package.json', 'package-lock.json'];
const SUPPORTING_DIRS = ['test/', 'doc/', 'docs/'];

function git(repo, args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    if (allowFailure) return undefined;
    throw new Error(`git ${args.join(' ')} failed: ${error.stderr?.toString().trim() || error.message}`);
  }
}

const exists = (repo, rev, file) => git(repo, ['cat-file', '-e', `${rev}:${file}`], { allowFailure: true }) !== undefined;
const normalize = (file) => file.replace(/\\/g, '/').replace(/\/+$/, '');

/** 解析 `git diff --name-status --no-renames` 的输出为 {status, path}。 */
function parseNameStatus(text) {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const [status, ...rest] = line.split('\t');
      return { status: status.trim(), path: rest.join('\t') };
    });
}

function classify(entry, { plugin, assembly, config, mode }) {
  const file = entry.path;
  if (file === plugin || file.startsWith(`${plugin}/`)) {
    return entry.status === 'A'
      ? { kind: 'plugin' }
      : { kind: 'violation', reason: `new plugin package file must be added (A), found ${entry.status}` };
  }
  if (mode === 'a' && file === assembly) {
    return entry.status === 'M'
      ? { kind: 'assembly' }
      : { kind: 'violation', reason: `assembly file must be modified (M), found ${entry.status}` };
  }
  if (mode === 'b' && file === config) {
    return entry.status === 'M'
      ? { kind: 'assembly' }
      : { kind: 'violation', reason: `config file must be modified (M), found ${entry.status}` };
  }
  if (SUPPORTING_FILES.includes(file) || SUPPORTING_DIRS.some((dir) => file.startsWith(dir))) {
    return { kind: 'supporting' };
  }
  return { kind: 'violation', reason: 'not part of the allowed change set' };
}

/**
 * 检查提交 `commit` 是否满足方式 `mode` 的差异判据。
 * @returns {{ ok: boolean, checks: Array<{name: string, ok: boolean, details: string[]}>, supporting: string[] }}
 */
export function verifyDiff({ repo = process.cwd(), commit, mode, plugin, assembly = 'src/main.ts', config = 'plugins.config.json' }) {
  if (mode !== 'a' && mode !== 'b') throw new Error(`mode must be "a" or "b", got: ${mode}`);
  if (!commit) throw new Error('missing --commit');
  if (!plugin) throw new Error('missing --plugin');
  plugin = normalize(plugin);
  assembly = normalize(assembly);
  config = normalize(config);

  const head = git(repo, ['rev-parse', '--verify', `${commit}^{commit}`]).trim();
  const parent = git(repo, ['rev-parse', '--verify', `${commit}^`]).trim();
  const checks = [];
  const add = (name, ok, details = []) => checks.push({ name, ok, details });

  // 1. 路径必须真实存在，空差异才有意义。
  const existing = (git(repo, ['ls-tree', '-d', '--name-only', parent, `${PLUGINS_DIR}/`]) ?? '')
    .split('\n')
    .map((line) => normalize(line.trim()))
    .filter((line) => line !== '' && line !== plugin);
  const mustExistBefore = [KERNEL_DIR, LOADER_DIR, mode === 'a' ? assembly : config, ...existing];
  const missingBefore = mustExistBefore.filter((file) => !exists(repo, parent, file));
  const pluginBefore = exists(repo, parent, plugin);
  const pluginAfter = exists(repo, head, plugin);
  const pathProblems = [
    ...missingBefore.map((file) => `missing in C^: ${file}`),
    ...(pluginBefore ? [`${plugin} already exists in C^ (not a new plugin)`] : []),
    ...(pluginAfter ? [] : [`${plugin} does not exist in C`]),
    ...(existing.length === 0 ? [`no existing plugin package under ${PLUGINS_DIR}/ in C^ (nothing to compare against)`] : []),
  ];
  add(
    'paths exist (C^ has kernel/loader/assembly/existing plugins; only C has the new plugin)',
    pathProblems.length === 0,
    pathProblems.length === 0 ? [`existing plugins: ${existing.join(', ')}`] : pathProblems,
  );

  // 2. git diff --name-status C^ C
  const entries = parseNameStatus(git(repo, ['diff', '--name-status', '--no-renames', parent, head]));
  const context = { plugin, assembly, config, mode };
  const classified = entries.map((entry) => ({ entry, ...classify(entry, context) }));
  const violations = classified.filter((item) => item.kind === 'violation');
  const hasAssembly = classified.some((item) => item.kind === 'assembly');
  const hasPlugin = classified.some((item) => item.kind === 'plugin');
  const shape = [
    ...violations.map((item) => `${item.entry.status}\t${item.entry.path}  (${item.reason})`),
    ...(hasPlugin ? [] : [`no file added under ${plugin}/`]),
    ...(hasAssembly ? [] : [`${mode === 'a' ? assembly : config} was not modified`]),
  ];
  add(
    mode === 'a'
      ? `method A: only adds ${plugin}/ and modifies the single assembly file ${assembly}`
      : `method B: no src/ change; only adds ${plugin}/ and modifies ${config}`,
    shape.length === 0,
    shape,
  );

  // 3. 内核、加载器与既有插件的差异必须为空（新插件包排除；方式 A 另排除装配文件本身）。
  const excludes = [`:(exclude)${plugin}`, ...(mode === 'a' ? [`:(exclude)${assembly}`] : [])];
  const pathspec = [KERNEL_DIR, PLUGINS_DIR, ...excludes];
  const kernelDiff = git(repo, ['diff', '--name-status', '--no-renames', parent, head, '--', ...pathspec]).trim();
  add(
    `kernel, loader and existing plugins unchanged: git diff C^ C -- ${KERNEL_DIR} ${PLUGINS_DIR} ${excludes.map((item) => `'${item}'`).join(' ')}`,
    kernelDiff === '',
    kernelDiff === '' ? [] : kernelDiff.split('\n'),
  );

  // 4. 加载器独立性（辅助）：加载器目录中不得出现新插件的名字或路径。
  const pluginName = plugin.split('/').pop();
  const loaderHits = (
    git(repo, ['grep', '-n', '-F', '-e', pluginName, head, '--', LOADER_DIR], { allowFailure: true }) ?? ''
  )
    .split('\n')
    .filter((line) => line.trim() !== '');
  add(
    `loader does not mention the new plugin ("${pluginName}" not found in ${LOADER_DIR}; still review import/require/switch by hand)`,
    loaderHits.length === 0,
    loaderHits,
  );

  const supporting = classified.filter((item) => item.kind === 'supporting').map((item) => `${item.entry.status}\t${item.entry.path}`);
  return { ok: checks.every((check) => check.ok), checks, supporting, commits: { parent, head } };
}

function parseArguments(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
    const [key, inline] = arg.slice(2).split('=');
    const value = inline ?? argv[++i];
    if (value === undefined) throw new Error(`--${key} requires a value`);
    options[key] = value;
  }
  return options;
}

export function formatReport(result) {
  const lines = [`C^ = ${result.commits.parent}`, `C  = ${result.commits.head}`, ''];
  for (const check of result.checks) {
    lines.push(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}`);
    for (const detail of check.details) lines.push(`        ${detail}`);
  }
  if (result.supporting.length > 0) {
    lines.push('', 'supporting changes (explain each one in the commit message or docs):');
    for (const item of result.supporting) lines.push(`        ${item}`);
  }
  lines.push('', result.ok ? 'RESULT: PASS' : 'RESULT: FAIL');
  return lines.join('\n');
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const repo = path.resolve(options.repo ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
    const result = verifyDiff({
      repo,
      commit: options.commit ?? 'HEAD',
      mode: options.mode,
      plugin: options.plugin,
      assembly: options.assembly,
      config: options.config,
    });
    console.log(formatReport(result));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 2;
  }
}
