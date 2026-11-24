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
import type { Plugin, PluginManifest } from './plugin/Plugin';
import { PluginHost } from './plugin/PluginHost';

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
export const CODE_PLUGINS: readonly PluginEntry[] = [];

/**
 * 组装全部模块（Composition Root）。内核各模块互不认识具体图形、命令与插件，
 * 全部通过 PluginHost 注册：先内置插件，再外部插件。
 * 外部插件装配失败只输出错误并跳过该插件，其余照常启动。
 */
export function createCli(
  stdout: Writable,
  stderr: Writable,
  plugins: readonly PluginEntry[] = CODE_PLUGINS,
): Cli {
  const output = new ConsoleOutput(stdout, stderr);
  const factory = new ShapeFactory();
  const store = new FileDocumentStore(new SvgParser(factory), new SvgSerializer());
  const session = new EditorSession(store, store, output);
  const host = new PluginHost({ session, factory });
  installBuiltins(host);
  for (const { plugin, manifest, options } of plugins) {
    try {
      host.install(plugin, manifest, options);
    } catch (error) {
      output.writeError(error instanceof Error ? error.message : String(error));
    }
  }
  return host.createCli(output);
}

export function main(): void {
  const output = new ConsoleOutput(process.stdout, process.stderr);
  const repl = new Repl(
    createCli(process.stdout, process.stderr),
    process.stdin,
    process.stdout,
    output,
  );
  repl.start();
}

if (require.main === module) {
  main();
}
