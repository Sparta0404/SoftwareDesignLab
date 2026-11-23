import { beforeEach, describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/app/EditorSession';
import type { WarningSink } from '../../src/app/port/WarningSink';
import { MoveCommand } from '../../src/command/edit/MoveCommand';
import { SvgDocument } from '../../src/model/document/SvgDocument';
import type { DocumentEvent } from '../../src/model/document/DocumentEvent';
import { RectShape } from '../../src/shapes/rect/RectShape';

class WarningSinkSpy implements WarningSink {
  readonly messages: string[] = [];

  warn(message: string): void {
    this.messages.push(message);
  }
}

describe('EditorSession 事件订阅', () => {
  let warnings: WarningSinkSpy;
  let written: string[];
  let readDocument: SvgDocument;
  let session: EditorSession;
  let events: DocumentEvent[];
  let documents: SvgDocument[];

  beforeEach(() => {
    warnings = new WarningSinkSpy();
    written = [];
    readDocument = new SvgDocument();
    readDocument.insert(new RectShape('r1', 0, 0, 1, 1), readDocument.root);
    session = new EditorSession(
      {
        read: (path) => {
          if (path === 'bad.svg') throw new Error('cannot read file: bad.svg');
          return readDocument;
        },
      },
      { write: (path) => void written.push(path) },
      warnings,
    );
    events = [];
    documents = [];
    session.subscribe((event, document) => {
      events.push(event);
      documents.push(document);
    });
  });

  it('init / read 发 opened，事件携带当前文档', () => {
    session.init(10, 10);
    session.read('a.svg');
    expect(events).toEqual(['opened', 'opened']);
    expect(documents[1]).toBe(readDocument);
  });

  it('save 成功后发 saved；保存失败、无文档时不发', () => {
    expect(() => session.save('a.svg')).toThrow('no document');
    session.read('a.svg');
    events.length = 0;
    session.save();
    expect(events).toEqual(['saved']);
    expect(written).toEqual(['a.svg']);
  });

  it('execute / undo / redo 成功后发 edited，失败的命令不发', () => {
    session.read('a.svg');
    events.length = 0;
    session.execute((document) => new MoveCommand(document, 'r1', 1, 1));
    expect(() => session.execute((document) => new MoveCommand(document, 'nope', 1, 1))).toThrow();
    session.undo();
    session.redo();
    expect(events).toEqual(['edited', 'edited', 'edited']);
    expect(() => session.redo()).toThrow();
    expect(events).toHaveLength(3);
  });

  it('canvas 只有修改尺寸时才发 edited，查询不发；读取失败不发 opened', () => {
    session.init();
    events.length = 0;
    session.canvas();
    expect(events).toEqual([]);
    session.canvas(100, 100);
    expect(events).toEqual(['edited']);
    events.length = 0;
    expect(() => session.read('bad.svg')).toThrow('cannot read file');
    expect(events).toEqual([]);
  });

  it('事件在状态更新之后发出：监听者通过 session 能看到新状态', () => {
    let size = '';
    session.subscribe((_event, document) => {
      size = `${document.width}x${document.height}`;
    });
    session.init(30, 40);
    expect(size).toBe('30x40');
  });

  it('可取消订阅；多个监听者按订阅顺序收到事件', () => {
    const order: string[] = [];
    const off = session.subscribe(() => order.push('second'));
    session.subscribe(() => order.push('third'));
    session.init();
    expect(order).toEqual(['second', 'third']);
    off();
    order.length = 0;
    session.init();
    expect(order).toEqual(['third']);
  });

  it('监听者抛错不会影响命令结果与其他监听者，改为输出警告', () => {
    session.subscribe(() => {
      throw new Error('listener broke');
    });
    const after: string[] = [];
    session.subscribe((event) => after.push(event));

    expect(session.init(10, 10)).toBe('canvas 10x10 created');
    expect(after).toEqual(['opened']);
    expect(warnings.messages).toEqual(['document listener failed: listener broke']);
  });
});
