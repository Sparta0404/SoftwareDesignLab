import type { Shape } from '../model/shape/Shape';

/**
 * 提供者创建内部部件时使用的构造入口（由 ShapeFactory 实现）。
 * 复合图形插件据此用已注册的类型（如 rect / text）造部件，而不必 import 内置图形。
 */
export interface ShapeBuilder {
  create(typeName: string, id: string, args: readonly string[]): Shape;
}

/**
 * 某一种图形类型的提供者：负责从 CLI 参数或 SVG 元素构造图形。
 *
 * 契约：
 * - `fromArgs` / `fromSvgTree` 返回的图形 id 必须等于传入的 id，
 *   后者返回的 `tagName` 还必须等于被匹配的 SVG 标签；否则内核报契约违反；
 * - 失败时抛出 `EditorError`（或其子类），不得留下半成品；
 * - 多个提供者同时 `matches` 同一个元素时，后注册者优先
 *   （更具体的插件覆盖内置的 `g`）；都不匹配则回落到 `unknown shape type`，
 *   因此“带 data-kind 的 g”在对应插件未安装时自然降级为普通 `g`。
 */
export interface ShapeProvider {
  /** `create <type>` 中的类型名，注册表内唯一。 */
  readonly typeName: string;

  /** 参数用法，如 `create rect <id> <x> <y> <w> <h> [fill]`，用于参数错误提示与 help。 */
  readonly usage: string;

  /** 从 `create` 命令的参数（不含 type、id 与 `in` 子句）构造图形。 */
  fromArgs(id: string, args: readonly string[], builder: ShapeBuilder): Shape;

  /** 读入 SVG 时，该提供者是否接管这个元素。attrs 不含 id。必须是纯函数。 */
  matches(tag: string, attrs: ReadonlyMap<string, string>): boolean;

  /**
   * 从读入的 SVG 元素构造图形。children 是已经构造好的子树（按文档顺序），
   * 提供者决定接管（校验并装入内部部件）还是原样挂入；叶子类型收到非空 children 时
   * 应抛出 NotContainerError。text 为元素直属的文本内容；attrs 不含 id。
   */
  fromSvgTree(
    id: string,
    attrs: ReadonlyMap<string, string>,
    text: string,
    children: readonly Shape[],
    builder: ShapeBuilder,
  ): Shape;
}
