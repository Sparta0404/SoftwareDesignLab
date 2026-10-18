import { beforeEach, describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/app/EditorSession';
import type { DocumentReader } from '../../src/app/port/DocumentReader';
import type { DocumentWriter } from '../../src/app/port/DocumentWriter';
import type { WarningSink } from '../../src/app/port/WarningSink';
import { MoveCommand } from '../../src/command/edit/MoveCommand';
import { UndoNotAllowedError } from '../../src/command/error/UndoNotAllowedError';
import { SvgDocument } from '../../src/model/document/SvgDocument';
import { RectShape } from '../../src/shapes/rect/RectShape';

class ReaderStub implements DocumentReader {
  readonly documents = new Map<string, SvgDocument>();
  readonly warnings = new Map<string, string[]>();
  failure: Error | undefined;
  calls: string[] = [];

  read(path: string, warningSink: WarningSink): SvgDocument {
    this.calls.push(path);
    if (this.failure !== undefined) throw this.failure;
    for (const warning of this.warnings.get(path) ?? []) warningSink.warn(warning);
    const document = this.documents.get(path);
    if (document === undefined) throw new Error(`no stub document: ${path}`);
    return document;
  }
}

class WriterStub implements DocumentWriter {
  failure: Error | undefined;
  calls: Array<{ path: string; document: SvgDocument }> = [];

  write(path: string, document: SvgDocument): void {
    if (this.failure !== undefined) throw this.failure;
    this.calls.push({ path, document });
  }
}

class WarningSinkSpy implements WarningSink {
  readonly messages: string[] = [];

  warn(message: string): void {
    this.messages.push(message);
  }
}

describe('EditorSession', () => {
  let reader: ReaderStub;
  let writer: WriterStub;
  let warnings: WarningSinkSpy;
  let session: EditorSession;

  beforeEach(() => {
    reader = new ReaderStub();
    writer = new WriterStub();
    warnings = new WarningSinkSpy();
    session = new EditorSession(reader, writer, warnings);
  });

  describe('无当前文档', () => {
    it('除 init/read 外的操作统一报 no document', () => {
      expect(() => session.canvas()).toThrow("no document. use 'init' or 'read' first");
      expect(() => session.save('a.svg')).toThrow("no document. use 'init' or 'read' first");
      expect(() => session.inspect(() => 'never')).toThrow(
        "no document. use 'init' or 'read' first",
      );
      expect(() => session.execute(() => {
        throw new Error('不应构造命令');
      })).toThrow("no document. use 'init' or 'read' first");
      expect(() => session.undo()).toThrow("no document. use 'init' or 'read' first");
      expect(() => session.redo()).toThrow("no document. use 'init' or 'read' first");
    });
  });

  describe('init 与 canvas', () => {
    it('init 使用默认或指定尺寸创建新文档', () => {
      expect(session.init()).toBe('canvas 800x600 created');
      expect(session.inspect((doc) => [doc.width, doc.height])).toEqual([800, 600]);

      expect(session.init(400, 300)).toBe('canvas 400x300 created');
      expect(session.inspect((doc) => [doc.width, doc.height])).toEqual([400, 300]);
    });

    it('init 后禁止 undo，下一条成功编辑重新解禁', () => {
      session.init();
      expect(() => session.undo()).toThrow(UndoNotAllowedError);

      session.inspect((doc) => doc.insert(new RectShape('r1', 0, 0, 10, 10), doc.root));
      session.execute((doc) => new MoveCommand(doc, 'r1', 5, 0));
      expect(session.undo()).toBe('rect#r1 moved back to (0,0)');
    });

    it('canvas 无参数只显示尺寸且不锁定历史，带参数修改尺寸并锁定', () => {
      session.init(800, 600);
      session.inspect((doc) => doc.insert(new RectShape('r1', 0, 0, 10, 10), doc.root));
      session.execute((doc) => new MoveCommand(doc, 'r1', 5, 0));

      expect(session.canvas()).toBe('canvas 800x600');
      expect(session.undo()).toBe('rect#r1 moved back to (0,0)');
      session.execute((doc) => new MoveCommand(doc, 'r1', 5, 0));

      expect(session.canvas(400, 300)).toBe('canvas resized to 400x300');
      expect(session.inspect((doc) => [doc.width, doc.height])).toEqual([400, 300]);
      expect(() => session.undo()).toThrow(UndoNotAllowedError);
    });

    it('非法 init/canvas 不替换文档、不锁定已有历史', () => {
      session.init();
      session.inspect((doc) => doc.insert(new RectShape('r1', 0, 0, 10, 10), doc.root));
      session.execute((doc) => new MoveCommand(doc, 'r1', 5, 0));

      expect(() => session.init(0, 100)).toThrow('canvas size must be positive');
      expect(() => session.canvas(-1, 100)).toThrow('canvas size must be positive');
      expect(session.inspect((doc) => [doc.width, doc.height])).toEqual([800, 600]);
      expect(session.undo()).toBe('rect#r1 moved back to (0,0)');
    });
  });

  describe('read', () => {
    it('通过端口读入文档，转发缺 id 警告，并记住路径', () => {
      const imported = new SvgDocument(400, 300);
      imported.insert(new RectShape('rect1', 0, 0, 10, 10), imported.root);
      reader.documents.set('other.svg', imported);
      reader.warnings.set('other.svg', ['assigned id rect1 to unnamed <rect>']);

      expect(session.read('other.svg')).toBe('read other.svg (1 elements)');
      expect(reader.calls).toEqual(['other.svg']);
      expect(warnings.messages).toEqual(['assigned id rect1 to unnamed <rect>']);
      expect(session.inspect((doc) => doc)).toBe(imported);

      expect(session.save()).toBe('saved to other.svg (1 elements)');
      expect(writer.calls[0]).toEqual({ path: 'other.svg', document: imported });
    });

    it('成功 read 替换文档并锁定历史', () => {
      session.init();
      const imported = new SvgDocument();
      reader.documents.set('new.svg', imported);

      session.read('new.svg');
      expect(() => session.undo()).toThrow(UndoNotAllowedError);
      expect(session.inspect((doc) => doc)).toBe(imported);
    });

    it('read 失败时保留旧文档、路径与历史', () => {
      session.init();
      session.inspect((doc) => doc.insert(new RectShape('r1', 0, 0, 10, 10), doc.root));
      session.execute((doc) => new MoveCommand(doc, 'r1', 5, 0));
      reader.failure = new Error('cannot read file: bad.svg');

      expect(() => session.read('bad.svg')).toThrow('cannot read file: bad.svg');
      expect(session.inspect((doc) => doc.find('r1').anchor())).toEqual([5, 0]);
      expect(session.undo()).toBe('rect#r1 moved back to (0,0)');
    });
  });

  describe('save', () => {
    it('显式路径保存后成为后续无参数 save 的默认路径', () => {
      session.init();
      expect(session.save('first.svg')).toBe('saved to first.svg (0 elements)');
      expect(session.save()).toBe('saved to first.svg (0 elements)');
      expect(writer.calls.map((call) => call.path)).toEqual(['first.svg', 'first.svg']);
    });

    it('init 后无路径可用时给出明确错误', () => {
      session.init();
      expect(() => session.save()).toThrow("no file path. use 'save <file.svg>' first");
      expect(writer.calls).toEqual([]);
    });

    it('成功 save 锁定历史；失败 save 不更新路径且不锁定历史', () => {
      session.init();
      session.inspect((doc) => doc.insert(new RectShape('r1', 0, 0, 10, 10), doc.root));
      session.execute((doc) => new MoveCommand(doc, 'r1', 5, 0));
      writer.failure = new Error('cannot write file: bad.svg');

      expect(() => session.save('bad.svg')).toThrow('cannot write file: bad.svg');
      expect(session.undo()).toBe('rect#r1 moved back to (0,0)');

      writer.failure = undefined;
      session.execute((doc) => new MoveCommand(doc, 'r1', 5, 0));
      session.save('good.svg');
      expect(() => session.undo()).toThrow(UndoNotAllowedError);
      expect(session.save()).toBe('saved to good.svg (1 elements)');
    });
  });

  describe('编辑与只读访问', () => {
    it('execute 在当前文档上构造命令；失败命令不进入历史', () => {
      session.init();
      session.inspect((doc) => doc.insert(new RectShape('r1', 0, 0, 10, 10), doc.root));

      expect(session.execute((doc) => new MoveCommand(doc, 'r1', 3, 4))).toBe(
        'rect#r1 moved to (3,4)',
      );
      expect(() => session.execute((doc) => new MoveCommand(doc, 'missing', 1, 1))).toThrow(
        'no such shape: missing',
      );
      expect(session.undo()).toBe('rect#r1 moved back to (0,0)');
    });

    it('inspect 只返回回调结果，不改变历史边界', () => {
      session.init(20, 30);
      expect(session.inspect((doc) => `${doc.width}x${doc.height}`)).toBe('20x30');
      expect(() => session.undo()).toThrow(UndoNotAllowedError);
    });
  });
});
