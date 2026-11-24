import type { EditorSession } from '../app/EditorSession';
import type { TextOutput } from './TextOutput';

/**
 * 一条 CLI 命令执行时可以使用的协作对象。
 * 刻意保持最小：只有会话（读文档用 `inspect`，改文档用 `execute`）和输出。
 */
export interface CommandContext {
  readonly session: EditorSession;
  readonly output: TextOutput;
}

/**
 * CLI 命令的扩展点：`name` 是用户敲入的命令名，注册表内唯一。
 *
 * 契约：
 * - 失败时抛出 Error，由 Cli 统一输出 `error: <message>`，不要自己写错误；
 * - 成功信息通过 `context.output.write` 输出；
 * - 只读命令（如 stats、dir）不应调用 `session.execute`，因而不进入 undo 栈。
 */
export interface Command {
  readonly name: string;
  readonly usage: string;
  execute(args: readonly string[], context: CommandContext): void;
}
