import type { AttributeHandler } from '../command/attribute/AttributeHandler';
import type { Command } from '../cli/Command';
import type { ShapeProvider } from '../factory/ShapeProvider';
import type { TreeDecorator } from '../view/TreeDecorator';

/**
 * 插件在 `activate` 期间用来登记自己贡献的扩展项。
 *
 * 登记只是“暂存”：只有 `activate` 正常返回、清单校验与重复检测通过之后，
 * 内核才会一次性提交；任何一步失败，该插件的全部暂存登记都被丢弃。
 * `activate` 返回后上下文失效，再调用任何 register 方法都会抛错。
 */
export interface PluginContext {
  registerShape(provider: ShapeProvider): void;
  registerCommand(command: Command): void;
  registerAttributeHandler(handler: AttributeHandler): void;
  registerTreeDecorator(decorator: TreeDecorator): void;
}

/** 插件入口：除 `activate` 外不需要实现任何东西。 */
export interface Plugin {
  /** options 来自配置文件的 `options`（代码装配时来自调用方），可能为 undefined。 */
  activate(context: PluginContext, options?: unknown): void;
}

/** 清单中 `contributes` 的四类扩展项，各自列出名字。缺省视为空。 */
export interface PluginContributions {
  readonly shapes?: readonly string[];
  readonly commands?: readonly string[];
  readonly attributeHandlers?: readonly string[];
  readonly treeDecorators?: readonly string[];
}

/**
 * 插件清单（对应插件包 package.json 里的 `name` 与 `contributes`）。
 * 声明必须与 `activate` 实际登记的内容完全一致，否则整个插件被拒绝。
 */
export interface PluginManifest {
  readonly name: string;
  readonly contributes: PluginContributions;
}

/** 扩展点的种类，同时也是 `contributes` 的键与重复登记报错中的前缀。 */
export type ContributionKind = keyof PluginContributions;

export const CONTRIBUTION_KINDS: readonly ContributionKind[] = [
  'shapes',
  'commands',
  'attributeHandlers',
  'treeDecorators',
];
