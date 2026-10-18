import type { Shape } from '../model/shape/Shape';

/**
 * 某一种图形类型的创建器：负责从 CLI 参数或 SVG 属性构造图形。
 * 后续插件化阶段的 ShapeProvider 即由这一接口演化而来。
 */
export interface ShapeCreator {
  /** `create <type>` 中的类型名，同时也是对应的 SVG 标签名。 */
  readonly typeName: string;

  /** 参数用法，如 `create rect <id> <x> <y> <w> <h> [fill]`，用于参数错误提示与 help。 */
  readonly usage: string;

  /** 从 `create` 命令的参数（不含 type、id 与 `in` 子句）构造图形。 */
  fromArgs(id: string, args: readonly string[]): Shape;

  /** 从读入的 SVG 元素构造图形（不含子元素）。attrs 不含 id；text 为元素的文本内容。 */
  fromSvg(id: string, attrs: ReadonlyMap<string, string>, text: string): Shape;
}
