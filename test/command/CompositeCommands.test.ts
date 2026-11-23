import { describe, expect, it } from 'vitest';
import { AddToCommand } from '../../src/command/edit/AddToCommand';
import { CreateCommand } from '../../src/command/edit/CreateCommand';
import { DeleteCommand } from '../../src/command/edit/DeleteCommand';
import { GroupCommand } from '../../src/command/edit/GroupCommand';
import { MoveCommand } from '../../src/command/edit/MoveCommand';
import { UngroupCommand } from '../../src/command/edit/UngroupCommand';
import { SvgDocument } from '../../src/model/document/SvgDocument';
import { GroupShape } from '../../src/model/shape/GroupShape';
import { RectShape } from '../../src/shapes/rect/RectShape';
import { factoryWithBox } from '../support/FakeBox';

function documentWithBox() {
  const document = new SvgDocument();
  const box = factoryWithBox().create('box', 'n1', ['0', '0', '100', '40', 'Hi']);
  document.insert(box, document.root);
  return { document, box };
}

const ids = (document: SvgDocument) => document.root.walk().map((shape) => shape.id);

describe('命令回显使用 displayLabel，并附带 creationNote', () => {
  it('create：复合图形回显 box#id 与创建说明；undo/redo 同样', () => {
    const document = new SvgDocument();
    const box = factoryWithBox().create('box', 'n1', ['0', '0', '100', '40', 'Hi']);
    const command = new CreateCommand(document, box);

    expect(command.execute()).toBe('box#n1 created (g#n1 + rect#n1-rect + text#n1-label)');
    expect(command.undo()).toBe('box#n1 deleted');
    expect(command.redo()).toBe('box#n1 created (g#n1 + rect#n1-rect + text#n1-label)');
  });

  it('create in：容器名也使用 displayLabel，说明紧随其后', () => {
    const { document } = documentWithBox();
    const second = factoryWithBox().create('box', 'n2', ['0', '0', '10', '10', 'x']);
    const outer = new GroupShape('outer');
    document.insert(outer, document.root);
    expect(new CreateCommand(document, second, outer).execute()).toBe(
      'box#n2 created in g#outer (g#n2 + rect#n2-rect + text#n2-label)',
    );
    const rect = new RectShape('r9', 0, 0, 1, 1);
    expect(new CreateCommand(document, rect, document.find('n1')).execute()).toBe(
      'rect#r9 created in box#n1',
    );
  });

  it('delete / move / addto 的回显用 box#id，父节点 svg 的叫法不变', () => {
    const { document } = documentWithBox();
    const outer = new GroupShape('outer');
    document.insert(outer, document.root);

    expect(new MoveCommand(document, 'n1', 5, 5).execute()).toBe('box#n1 moved by (5,5)');
    const addTo = new AddToCommand(document, 'outer', 'n1');
    expect(addTo.execute()).toBe('box#n1 moved into g#outer');
    expect(addTo.undo()).toBe('box#n1 moved back to svg');

    const del = new DeleteCommand(document, 'n1');
    expect(del.execute()).toBe('box#n1 deleted');
    expect(del.undo()).toBe('box#n1 restored into svg');
  });

  it('子部件作为目标时仍显示内置标签，父节点显示 box#id', () => {
    const { document } = documentWithBox();
    const outer = new GroupShape('outer');
    document.insert(outer, document.root);
    expect(new MoveCommand(document, 'n1-rect', 1, 1).execute()).toBe('rect#n1-rect moved to (1,1)');
    // 子部件不能脱离复合图形：addto 被拒绝，错误来自 removeChild
    expect(() => new AddToCommand(document, 'outer', 'n1-rect').execute()).toThrow(
      'cannot detach n1-rect from box#n1',
    );
  });
});

describe('子部件保护对结构命令的影响', () => {
  it('delete 子部件被拒绝，文档不变', () => {
    const { document } = documentWithBox();
    const before = ids(document);
    expect(() => new DeleteCommand(document, 'n1-label').execute()).toThrow('cannot detach');
    expect(ids(document)).toEqual(before);
  });

  it('group 包含受保护子部件时整条失败，已摘走的图形全部放回原位', () => {
    const { document } = documentWithBox();
    document.insert(new RectShape('a', 0, 0, 1, 1), document.root, 0);
    document.insert(new RectShape('z', 0, 0, 1, 1), document.root);
    const before = ids(document);
    // 先序为 a, n1-rect, z：a 先被摘走，随后 n1-rect 触发保护
    expect(() => new GroupCommand(document, 'grp', ['z', 'n1-rect', 'a']).execute()).toThrow(
      'cannot detach n1-rect from box#n1',
    );
    expect(ids(document)).toEqual(before);
    expect(document.has('grp')).toBe(false);
    expect(document.root.children().map((shape) => shape.id)).toEqual(['a', 'n1', 'z']);
  });

  it('ungroup 复合图形仍被拒绝（isComposite），成员不变', () => {
    const { document } = documentWithBox();
    document.insert(new GroupShape('outer'), document.root);
    expect(() => new UngroupCommand(document, 'n1').execute()).toThrow('cannot ungroup composite shape: n1');
    expect(ids(document)).toContain('n1-rect');
  });

  it('把整个复合图形放进 group 并撤销，内部结构不变', () => {
    const { document, box } = documentWithBox();
    const command = new GroupCommand(document, 'grp', ['n1']);
    command.execute();
    expect(box.parent?.id).toBe('grp');
    command.undo();
    expect(box.parent).toBe(document.root);
    expect(box.children().map((child) => child.id)).toEqual(['n1-rect', 'n1-label']);
  });
});
