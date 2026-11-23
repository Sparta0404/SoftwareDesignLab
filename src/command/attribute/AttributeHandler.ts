import type { Shape } from '../../model/shape/Shape';

/** 处理器应用一次 `set` 后给出的回显文案。 */
export interface AttributeOutcome {
  /** 执行（以及 redo）时的回显。 */
  readonly message: string;
  /** undo 时的回显。 */
  readonly undoMessage: string;
}

/**
 * `set <id> <attr> <value>` 的扩展点：让某类图形接管若干属性。
 *
 * 契约：
 * - `handles` 必须是纯函数（不改变任何状态），只依据目标和属性名判断；
 * - 同一次 set 恰有一个处理器命中时才会调用 `apply`；两个及以上命中是冲突，
 *   内核拒绝执行而不是按优先级挑一个；
 * - `apply` 只可以修改 target 子树内**已有节点**的状态，不得增删节点；
 *   抛错表示失败，内核会把整棵子树恢复到调用前的状态，错误原样抛出，且不会回落到默认路径；
 * - 内核对 `target.walk()` 做备忘录，因此 undo / redo 整体是一个单元，
 *   处理器无需自己实现撤销，只需提供 undo 时的回显。
 */
export interface AttributeHandler {
  /** 处理器名，注册表内唯一；用于冲突与契约违反的报错。 */
  readonly name: string;
  handles(target: Shape, attr: string): boolean;
  apply(target: Shape, attr: string, value: string): AttributeOutcome;
}
