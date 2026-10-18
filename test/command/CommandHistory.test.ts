import { describe, expect, it } from 'vitest';
import { MoveCommand } from '../../src/command/edit/MoveCommand';
import type { EditCommand } from '../../src/command/history/EditCommand';
import { CommandHistory } from '../../src/command/history/CommandHistory';
import { EmptyHistoryError } from '../../src/command/error/EmptyHistoryError';
import { UndoNotAllowedError } from '../../src/command/error/UndoNotAllowedError';
import { SvgDocument } from '../../src/model/document/SvgDocument';
import { RectShape } from '../../src/shapes/rect/RectShape';

describe('CommandHistory', () => {
  it('一条编辑命令是一个 undo 单元', () => {
    const doc = new SvgDocument();
    const shape = new RectShape('r1', 0, 0, 10, 10);
    doc.insert(shape, doc.root);
    const history = new CommandHistory();

    expect(history.execute(new MoveCommand(doc, 'r1', 10, 20))).toBe(
      'rect#r1 moved to (10,20)',
    );
    expect(history.undo()).toBe('rect#r1 moved back to (0,0)');
    expect(history.redo()).toBe('rect#r1 moved to (10,20)');
  });

  it('undo 后执行新编辑会清空 redo 栈', () => {
    const doc = new SvgDocument();
    const shape = new RectShape('r1', 0, 0, 10, 10);
    doc.insert(shape, doc.root);
    const history = new CommandHistory();
    history.execute(new MoveCommand(doc, 'r1', 1, 0));
    history.undo();
    history.execute(new MoveCommand(doc, 'r1', 2, 0));

    expect(() => history.redo()).toThrow(EmptyHistoryError);
    expect(shape.anchor()).toEqual([2, 0]);
  });

  it('命令执行失败时不入栈，也不清空已有 redo', () => {
    class FailingCommand implements EditCommand {
      execute(): string {
        throw new Error('failed');
      }
      undo(): string {
        return 'should not happen';
      }
      redo(): string {
        return 'should not happen';
      }
    }
    const doc = new SvgDocument();
    const shape = new RectShape('r1', 0, 0, 10, 10);
    doc.insert(shape, doc.root);
    const history = new CommandHistory();
    history.execute(new MoveCommand(doc, 'r1', 1, 0));
    history.undo();

    expect(() => history.execute(new FailingCommand())).toThrow('failed');
    expect(history.redo()).toBe('rect#r1 moved to (1,0)');
  });

  it('空历史的 undo / redo 分别报错', () => {
    const history = new CommandHistory();
    expect(() => history.undo()).toThrow('nothing to undo');
    expect(() => history.redo()).toThrow('nothing to redo');
  });

  it('IO 命令锁定 undo/redo，下一条成功编辑命令重新解禁', () => {
    const doc = new SvgDocument();
    const shape = new RectShape('r1', 0, 0, 10, 10);
    doc.insert(shape, doc.root);
    const history = new CommandHistory();
    history.execute(new MoveCommand(doc, 'r1', 1, 0));
    history.lockByIo();

    expect(() => history.undo()).toThrow(UndoNotAllowedError);
    expect(() => history.redo()).toThrow(UndoNotAllowedError);

    history.execute(new MoveCommand(doc, 'r1', 2, 0));
    expect(history.undo()).toBe('rect#r1 moved back to (1,0)');
  });

  it('锁定后失败的编辑不能解禁或改变历史', () => {
    const history = new CommandHistory();
    history.lockByIo();
    const failing: EditCommand = {
      execute: () => {
        throw new Error('failed');
      },
      undo: () => '',
      redo: () => '',
    };

    expect(() => history.execute(failing)).toThrow('failed');
    expect(() => history.undo()).toThrow(UndoNotAllowedError);
  });
});
