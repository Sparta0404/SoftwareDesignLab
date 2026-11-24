import type { DocumentEvent } from '../model/document/DocumentEvent';
import type { SvgDocument } from '../model/document/SvgDocument';
import type { Shape } from '../model/shape/Shape';

/** 渲染 `tree` 的一行时交给装饰器的信息。 */
export interface TreeNodeInfo {
  readonly shape: Shape;
  readonly document: SvgDocument;
  /** 是否是文档根（`svg (WxH)` 那一行）；`tree <id>` 的首行不是。 */
  readonly isDocumentRoot: boolean;
}

/**
 * `tree` 输出的扩展点：为某些行追加行尾标签（如 `(box)`、`*`）。
 *
 * 契约：
 * - `decorate` 是只读的：不得修改文档或图形；返回 undefined 或空串表示这一行不加标签；
 * - 多个装饰器按注册顺序用一个空格拼接，追加在行尾；不影响属性摘要的对齐列；
 * - `decorate` 抛错时整条 tree 命令失败，错误为 `tree decorator failed: <name> (<reason>)`；
 * - 有状态的装饰器可实现 `onDocumentEvent`，由会话在文档打开 / 保存 / 编辑后通知。
 */
export interface TreeDecorator {
  /** 装饰器名，注册表内唯一；用于报错。 */
  readonly name: string;
  decorate(node: TreeNodeInfo): string | undefined;
  onDocumentEvent?(event: DocumentEvent, document: SvgDocument): void;
}
