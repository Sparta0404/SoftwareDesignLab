/**
 * 一个可撤销的编辑操作（Command 模式中的 Command）。
 *
 * 命令只操作领域模型，不负责输出；返回值是给上层展示的成功摘要。
 * execute 失败时必须保证模型不变，且不会进入历史栈。
 */
export interface EditCommand {
  execute(): string;
  undo(): string;
  redo(): string;
}
