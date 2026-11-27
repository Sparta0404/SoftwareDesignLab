import { EditorSession } from '../../src/app/EditorSession';
import { installBuiltins } from '../../src/builtin';
import type { Cli } from '../../src/cli/Cli';
import type { Command } from '../../src/cli/Command';
import type { TextOutput } from '../../src/cli/TextOutput';
import type { AttributeHandler } from '../../src/command/attribute/AttributeHandler';
import { ShapeFactory } from '../../src/factory/ShapeFactory';
import type { Plugin, PluginManifest } from '../../src/plugin/Plugin';
import { PluginHost } from '../../src/plugin/PluginHost';
import type { TreeDecorator } from '../../src/view/TreeDecorator';

/** 一个只含 session 与空工厂的宿主（尚未装入内置插件）。 */
export function emptyHost(session: EditorSession, factory = new ShapeFactory()): PluginHost {
  return new PluginHost({ session, factory });
}

/** 内置插件 + 额外插件，装配出的 Cli，等价于 main.ts 的装配路径。 */
export function buildBuiltinCli(
  session: EditorSession,
  output: TextOutput,
  extras: ReadonlyArray<{ plugin: Plugin; manifest: PluginManifest }> = [],
  factory = new ShapeFactory(),
): Cli {
  const host = emptyHost(session, factory);
  installBuiltins(host);
  for (const { plugin, manifest } of extras) {
    host.install(plugin, manifest);
  }
  return host.createCli(output);
}

export interface Extensions {
  readonly commands?: readonly Command[];
  readonly attributeHandlers?: readonly AttributeHandler[];
  readonly treeDecorators?: readonly TreeDecorator[];
}

/** 把一组扩展项包成插件，清单由内容自动生成。 */
export function extensionPlugin(
  name: string,
  extensions: Extensions,
): { plugin: Plugin; manifest: PluginManifest } {
  return {
    manifest: {
      name,
      contributes: {
        commands: (extensions.commands ?? []).map((item) => item.name),
        attributeHandlers: (extensions.attributeHandlers ?? []).map((item) => item.name),
        treeDecorators: (extensions.treeDecorators ?? []).map((item) => item.name),
      },
    },
    plugin: {
      activate(context) {
        extensions.commands?.forEach((item) => context.registerCommand(item));
        extensions.attributeHandlers?.forEach((item) => context.registerAttributeHandler(item));
        extensions.treeDecorators?.forEach((item) => context.registerTreeDecorator(item));
      },
    },
  };
}
