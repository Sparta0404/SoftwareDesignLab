import { EmptyHistoryError } from '../error/EmptyHistoryError';
import { UndoNotAllowedError } from '../error/UndoNotAllowedError';
import type { EditCommand } from './EditCommand';

/** 管理 undo / redo 两个栈；自身不认识任何具体命令。 */
export class CommandHistory {
  private readonly undoStack: EditCommand[] = [];
  private readonly redoStack: EditCommand[] = [];
  private lockedByIo = false;

  execute(command: EditCommand): string {
    // 先执行；失败时历史、锁定状态和 redo 栈均保持不变。
    const result = command.execute();
    this.undoStack.push(command);
    this.redoStack.length = 0;
    this.lockedByIo = false;
    return result;
  }

  undo(): string {
    this.ensureAllowed();
    const command = this.undoStack.pop();
    if (command === undefined) {
      throw new EmptyHistoryError('undo');
    }
    const result = command.undo();
    this.redoStack.push(command);
    return result;
  }

  redo(): string {
    this.ensureAllowed();
    const command = this.redoStack.pop();
    if (command === undefined) {
      throw new EmptyHistoryError('redo');
    }
    const result = command.redo();
    this.undoStack.push(command);
    return result;
  }

  /**
   * init / read / save / canvas 修改后禁止跨越该边界撤销。
   * 下一条成功的编辑命令会自动解禁，并成为新的历史起点。
   */
  lockByIo(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.lockedByIo = true;
  }

  private ensureAllowed(): void {
    if (this.lockedByIo) {
      throw new UndoNotAllowedError();
    }
  }
}
