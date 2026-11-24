import type { Writable } from 'node:stream';
import { EditorSession } from './app/EditorSession';
import { installBuiltins } from './builtin';
import type { Cli } from './cli/Cli';
import { ConsoleOutput } from './cli/ConsoleOutput';
import { Repl } from './cli/Repl';
import { ShapeFactory } from './factory/ShapeFactory';
import { FileDocumentStore } from './io/FileDocumentStore';
import { SvgParser } from './io/SvgParser';
import { SvgSerializer } from './io/SvgSerializer';
import { parseLaunchArguments, PluginLoader, type PluginSource } from './loader';
import type { Plugin, PluginManifest } from './plugin/Plugin';
import { PluginHost } from './plugin/PluginHost';
import dirPlugin, { manifest as dirManifest } from '../plugins/command-dir/index';
import statsPlugin, { manifest as statsManifest } from '../plugins/command-stats/index';
import boxPlugin, { manifest as boxManifest } from '../plugins/shape-box/index';

/** 方式 A（代码装配）的一项：插件对象 + 它的清单 + 可选的激活参数。 */
export interface PluginEntry {
  readonly plugin: Plugin;
  readonly manifest: PluginManifest;
  readonly options?: unknown;
}

/**
 * 代码装配的外部插件列表。新增插件时只需在这里加一项；
 * 内置图形与 Phase 1 命令由 `installBuiltins` 装入，不在此列。
 */
export const CODE_PLUGINS: readonly PluginEntry[] = [
  { plugin: statsPlugin, manifest: statsManifest },
  { plugin: dirPlugin, manifest: dirManifest },
  { plugin: boxPlugin, manifest: boxManifest },
];

/**
 * 组装全部模块（Composition Root）。内核各模块互不认识具体图形、命令与插件，
 * 全部通过 PluginHost 注册：先内置插件，再外部插件。
 *
 * 外部插件的来源由 `source` 决定：
 * - `code`（默认）：代码装配列表 `codePlugins`（也可以直接传入一个 `PluginEntry[]`）；
 * - `config`：由 PluginLoader 读配置文件逐个加载；配置整体非法时只输出
 *   `error: invalid plugin config: ...`，以内置能力启动；
 * - `none`：只有内置能力。
 * 外部插件装配失败只输出错误并跳过该插件，其余照常启动。
 */
export function createCli(
  stdout: Writable,
  stderr: Writable,
  source: PluginSource | readonly PluginEntry[] = { kind: 'code' },
  codePlugins: readonly PluginEntry[] = CODE_PLUGINS,
): Cli {
  const output = new ConsoleOutput(stdout, stderr);
  const factory = new ShapeFactory();
  const store = new FileDocumentStore(new SvgParser(factory), new SvgSerializer());
  const session = new EditorSession(store, store, output);
  const host = new PluginHost({ session, factory });
  installBuiltins(host);
  const report = (error: unknown): void =>
    output.writeError(error instanceof Error ? error.message : String(error));

  if (Array.isArray(source)) {
    installEntries(host, source, report);
  } else {
    const chosen = source as PluginSource;
    if (chosen.kind === 'code') {
      installEntries(host, codePlugins, report);
    } else if (chosen.kind === 'config') {
      try {
        new PluginLoader(host, report).loadFromConfig(chosen.configPath);
      } catch (error) {
        report(error);
      }
    }
  }
  return host.createCli(output);
}

function installEntries(
  host: PluginHost,
  entries: readonly PluginEntry[],
  report: (error: unknown) => void,
): void {
  for (const { plugin, manifest, options } of entries) {
    try {
      host.install(plugin, manifest, options);
    } catch (error) {
      report(error);
    }
  }
}

/** 入口参数：`--config <file>` 配置装配，`--no-plugins` 只留内置能力，缺省为代码装配。 */
export function main(argv: readonly string[] = process.argv.slice(2)): void {
  const output = new ConsoleOutput(process.stdout, process.stderr);
  let source: PluginSource;
  try {
    source = parseLaunchArguments(argv);
  } catch (error) {
    output.writeError(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }
  const repl = new Repl(
    createCli(process.stdout, process.stderr, source),
    process.stdin,
    process.stdout,
    output,
  );
  repl.start();
}

if (require.main === module) {
  main();
}
