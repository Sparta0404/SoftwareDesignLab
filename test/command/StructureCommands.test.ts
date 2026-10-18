import { describe, expect, it } from 'vitest';
import { AddToCommand } from '../../src/command/edit/AddToCommand';
import { GroupCommand } from '../../src/command/edit/GroupCommand';
import { UngroupCommand } from '../../src/command/edit/UngroupCommand';
import { ZOrderCommand } from '../../src/command/edit/ZOrderCommand';
import { GroupIntoDescendantError } from '../../src/command/error/GroupIntoDescendantError';
import { UngroupCompositeError } from '../../src/command/error/UngroupCompositeError';
import { UngroupTopLevelError } from '../../src/command/error/UngroupTopLevelError';
import { SvgDocument } from '../../src/model/document/SvgDocument';
import { GroupShape } from '../../src/model/shape/GroupShape';
import { RectShape } from '../../src/shapes/rect/RectShape';

function rect(id: string): RectShape {
  return new RectShape(id, 0, 0, 10, 10);
}

function ids(container: GroupShape): string[] {
  return container.children().map((shape) => shape.id);
}

describe('GroupCommand', () => {
  it('新容器放在被收编图形中最靠前者的位置，子节点保持文档顺序', () => {
    const doc = new SvgDocument();
    const a = rect('a');
    const b = rect('b');
    const c = rect('c');
    const d = rect('d');
    for (const shape of [a, b, c, d]) doc.insert(shape, doc.root);
    const command = new GroupCommand(doc, 'g1', ['d', 'b']);

    expect(command.execute()).toBe('g#g1 created with 2 children');
    expect(ids(doc.root)).toEqual(['a', 'g1', 'c']);
    expect(ids(doc.find('g1') as GroupShape)).toEqual(['b', 'd']);
    expect(command.undo()).toBe('g#g1 ungrouped');
    expect(ids(doc.root)).toEqual(['a', 'b', 'c', 'd']);
    expect(command.redo()).toBe('g#g1 created with 2 children');
    expect(ids(doc.find('g1') as GroupShape)).toEqual(['b', 'd']);
  });

  it('可收编来自不同父节点的图形，容器放到先序遍历中最靠前者的位置', () => {
    const doc = new SvgDocument();
    const outer = new GroupShape('outer');
    const a = rect('a');
    const b = rect('b');
    const c = rect('c');
    doc.insert(outer, doc.root);
    doc.insert(a, outer);
    doc.insert(b, doc.root);
    doc.insert(c, doc.root);
    const command = new GroupCommand(doc, 'g1', ['c', 'a']);

    command.execute();
    expect(ids(outer)).toEqual(['g1']);
    expect(ids(doc.find('g1') as GroupShape)).toEqual(['a', 'c']);
    expect(ids(doc.root)).toEqual(['outer', 'b']);
    command.undo();
    expect(ids(outer)).toEqual(['a']);
    expect(ids(doc.root)).toEqual(['outer', 'b', 'c']);
  });

  it('同时选择祖先与其子孙时，校验失败且状态不变', () => {
    const doc = new SvgDocument();
    const group = new GroupShape('old');
    const child = rect('child');
    doc.insert(group, doc.root);
    doc.insert(child, group);

    expect(() => new GroupCommand(doc, 'new', ['child', 'old']).execute()).toThrow(
      GroupIntoDescendantError,
    );
    expect(ids(doc.root)).toEqual(['old']);
    expect(ids(group)).toEqual(['child']);
    expect(doc.has('new')).toBe(false);
  });

  it('重复 id 或不存在的 id 在修改前失败', () => {
    const doc = new SvgDocument();
    doc.insert(rect('a'), doc.root);
    expect(() => new GroupCommand(doc, 'g', ['a', 'a']).execute()).toThrow(
      'duplicate shape id: a',
    );
    expect(() => new GroupCommand(doc, 'g', ['a', 'missing']).execute()).toThrow(
      'no such shape: missing',
    );
    expect(ids(doc.root)).toEqual(['a']);
  });
});

describe('UngroupCommand', () => {
  it('子图形保持容器内顺序，原样插入容器所在索引', () => {
    const doc = new SvgDocument();
    const parent = new GroupShape('parent');
    const a = rect('a');
    const group = new GroupShape('g');
    const x = rect('x');
    const y = rect('y');
    const b = rect('b');
    doc.insert(parent, doc.root);
    for (const shape of [a, group, b]) doc.insert(shape, parent);
    for (const shape of [x, y]) doc.insert(shape, group);
    const command = new UngroupCommand(doc, 'g');

    expect(command.execute()).toBe('g#g ungrouped');
    expect(ids(parent)).toEqual(['a', 'x', 'y', 'b']);
    expect(doc.has('g')).toBe(false);
    expect(command.undo()).toBe('g#g restored with 2 children');
    expect(ids(parent)).toEqual(['a', 'g', 'b']);
    expect(ids(group)).toEqual(['x', 'y']);
    expect(command.redo()).toBe('g#g ungrouped');
  });

  it('拒绝解散顶层容器', () => {
    const doc = new SvgDocument();
    const group = new GroupShape('g');
    doc.insert(group, doc.root);
    expect(() => new UngroupCommand(doc, 'g').execute()).toThrow(UngroupTopLevelError);
    expect(doc.find('g')).toBe(group);
  });

  it('拒绝解散插件所有的复合图形', () => {
    class CompositeGroup extends GroupShape {
      override isComposite(): boolean {
        return true;
      }
    }
    const doc = new SvgDocument();
    const parent = new GroupShape('parent');
    const composite = new CompositeGroup('box');
    doc.insert(parent, doc.root);
    doc.insert(composite, parent);

    expect(() => new UngroupCommand(doc, 'box').execute()).toThrow(UngroupCompositeError);
    expect(ids(parent)).toEqual(['box']);
  });
});

describe('AddToCommand', () => {
  it('把已有图形移到容器末尾，并可恢复原父节点与索引', () => {
    const doc = new SvgDocument();
    const a = rect('a');
    const b = rect('b');
    const group = new GroupShape('g');
    const x = rect('x');
    for (const shape of [a, b, group]) doc.insert(shape, doc.root);
    doc.insert(x, group);
    const command = new AddToCommand(doc, 'g', 'a');

    expect(command.execute()).toBe('rect#a moved into g#g');
    expect(ids(doc.root)).toEqual(['b', 'g']);
    expect(ids(group)).toEqual(['x', 'a']);
    expect(command.undo()).toBe('rect#a moved back to svg');
    expect(ids(doc.root)).toEqual(['a', 'b', 'g']);
    expect(command.redo()).toBe('rect#a moved into g#g');
  });

  it('拒绝把容器移入自身或自己的子孙，失败时状态不变', () => {
    const doc = new SvgDocument();
    const outer = new GroupShape('outer');
    const inner = new GroupShape('inner');
    doc.insert(outer, doc.root);
    doc.insert(inner, outer);

    expect(() => new AddToCommand(doc, 'inner', 'outer').execute()).toThrow(
      GroupIntoDescendantError,
    );
    expect(ids(doc.root)).toEqual(['outer']);
    expect(ids(outer)).toEqual(['inner']);
  });
});

describe('ZOrderCommand', () => {
  it('front 移到同级最后，back 移到同级最前，并可撤销', () => {
    const doc = new SvgDocument();
    for (const id of ['a', 'b', 'c']) doc.insert(rect(id), doc.root);

    const front = new ZOrderCommand(doc, 'b', 'front');
    expect(front.execute()).toBe('rect#b moved to front');
    expect(ids(doc.root)).toEqual(['a', 'c', 'b']);
    expect(front.undo()).toBe('rect#b z-order restored');
    expect(ids(doc.root)).toEqual(['a', 'b', 'c']);

    const back = new ZOrderCommand(doc, 'b', 'back');
    expect(back.execute()).toBe('rect#b moved to back');
    expect(ids(doc.root)).toEqual(['b', 'a', 'c']);
    back.undo();
    expect(ids(doc.root)).toEqual(['a', 'b', 'c']);
  });
});
