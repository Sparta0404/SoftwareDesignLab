import { describe, expect, it } from 'vitest';
import { CreateCommand } from '../../src/command/edit/CreateCommand';
import { DeleteCommand } from '../../src/command/edit/DeleteCommand';
import { MoveCommand } from '../../src/command/edit/MoveCommand';
import { ScaleCommand } from '../../src/command/edit/ScaleCommand';
import { SetAttrCommand } from '../../src/command/edit/SetAttrCommand';
import { InvalidScaleFactorError } from '../../src/command/error/InvalidScaleFactorError';
import { SvgDocument } from '../../src/model/document/SvgDocument';
import { GroupShape } from '../../src/model/shape/GroupShape';
import { CircleShape } from '../../src/shapes/circle/CircleShape';
import { RectShape } from '../../src/shapes/rect/RectShape';
import { TextShape } from '../../src/shapes/text/TextShape';

function rect(id: string, x = 0, y = 0): RectShape {
  return new RectShape(id, x, y, 10, 20);
}

describe('CreateCommand', () => {
  it('创建到根节点，undo 删除，redo 恢复到原位置', () => {
    const doc = new SvgDocument();
    doc.insert(rect('before'), doc.root);
    const shape = rect('r1', 10, 20);
    const command = new CreateCommand(doc, shape);

    expect(command.execute()).toBe('rect#r1 created');
    expect(doc.root.children().map((item) => item.id)).toEqual(['before', 'r1']);
    expect(command.undo()).toBe('rect#r1 deleted');
    expect(doc.has('r1')).toBe(false);
    expect(command.redo()).toBe('rect#r1 created');
    expect(doc.root.children().map((item) => item.id)).toEqual(['before', 'r1']);
  });

  it('可创建到指定容器', () => {
    const doc = new SvgDocument();
    const group = new GroupShape('g1');
    doc.insert(group, doc.root);
    const command = new CreateCommand(doc, rect('r1'), group);

    expect(command.execute()).toBe('rect#r1 created in g#g1');
    expect(group.children().map((item) => item.id)).toEqual(['r1']);
  });

  it('id 冲突时不改变文档', () => {
    const doc = new SvgDocument();
    doc.insert(rect('r1'), doc.root);
    const command = new CreateCommand(doc, rect('r1'));

    expect(() => command.execute()).toThrow('id already exists: r1');
    expect(doc.shapeCount).toBe(1);
    expect(doc.root.children()).toHaveLength(1);
  });

  it('目标不是容器时不登记新图形', () => {
    const doc = new SvgDocument();
    const parent = rect('parent');
    doc.insert(parent, doc.root);

    expect(() => new CreateCommand(doc, rect('child'), parent).execute()).toThrow(
      'not a container: parent',
    );
    expect(doc.has('child')).toBe(false);
    expect(doc.shapeCount).toBe(1);
  });
});

describe('DeleteCommand', () => {
  it('删除整棵子树，undo 按原父节点和索引恢复，redo 再删除', () => {
    const doc = new SvgDocument();
    const before = rect('before');
    const group = new GroupShape('g1');
    const child = rect('child');
    const after = rect('after');
    doc.insert(before, doc.root);
    doc.insert(group, doc.root);
    doc.insert(child, group);
    doc.insert(after, doc.root);
    const command = new DeleteCommand(doc, 'g1');

    expect(command.execute()).toBe('g#g1 deleted');
    expect(doc.root.children().map((item) => item.id)).toEqual(['before', 'after']);
    expect(doc.has('child')).toBe(false);
    expect(command.undo()).toBe('g#g1 restored');
    expect(doc.root.children().map((item) => item.id)).toEqual(['before', 'g1', 'after']);
    expect(doc.find('child')).toBe(child);
    expect(command.redo()).toBe('g#g1 deleted');
  });

  it('目标不存在时不改变文档', () => {
    const doc = new SvgDocument();
    doc.insert(rect('r1'), doc.root);
    expect(() => new DeleteCommand(doc, 'missing').execute()).toThrow('no such shape: missing');
    expect(doc.root.children().map((item) => item.id)).toEqual(['r1']);
  });
});

describe('MoveCommand', () => {
  it('移动叶子并可撤销、重做', () => {
    const doc = new SvgDocument();
    const circle = new CircleShape('c1', 100, 100, 20);
    doc.insert(circle, doc.root);
    const command = new MoveCommand(doc, 'c1', 30, -10);

    expect(command.execute()).toBe('circle#c1 moved to (130,90)');
    expect(command.undo()).toBe('circle#c1 moved back to (100,100)');
    expect(command.redo()).toBe('circle#c1 moved to (130,90)');
  });

  it('移动容器递归作用于子孙，回显增量', () => {
    const doc = new SvgDocument();
    const group = new GroupShape('g1');
    const child = rect('r1', 10, 20);
    doc.insert(group, doc.root);
    doc.insert(child, group);
    const command = new MoveCommand(doc, 'g1', 5, 6);

    expect(command.execute()).toBe('g#g1 moved by (5,6)');
    expect(child.anchor()).toEqual([15, 26]);
    expect(command.undo()).toBe('g#g1 moved back by (-5,-6)');
    expect(child.anchor()).toEqual([10, 20]);
  });
});

describe('ScaleCommand', () => {
  it('缩放全部几何属性，并用快照精确撤销', () => {
    const doc = new SvgDocument();
    const text = new TextShape('t1', 20, 40, 'hello');
    doc.insert(text, doc.root);
    const command = new ScaleCommand(doc, 't1', 0.3333333);

    expect(command.execute()).toBe('text#t1 scaled by 0.333333');
    expect(text.anchor()).toEqual([6.666666, 13.333332]);
    expect(command.undo()).toBe('text#t1 scale restored');
    expect(text.anchor()).toEqual([20, 40]);
    expect(command.redo()).toBe('text#t1 scaled by 0.333333');
  });

  it.each([0, -1, Number.POSITIVE_INFINITY])('因子 %s 非法时不改变状态', (factor) => {
    const doc = new SvgDocument();
    const shape = rect('r1', 2, 3);
    doc.insert(shape, doc.root);
    const before = shape.geometryValues();

    expect(() => new ScaleCommand(doc, 'r1', factor).execute()).toThrow(InvalidScaleFactorError);
    expect(shape.geometryValues()).toEqual(before);
  });
});

describe('SetAttrCommand', () => {
  it('设置已有属性，undo 恢复旧值', () => {
    const doc = new SvgDocument();
    const shape = rect('r1');
    shape.setAttr('fill', 'red');
    doc.insert(shape, doc.root);
    const command = new SetAttrCommand(doc, 'r1', 'fill', 'blue');

    expect(command.execute()).toBe('rect#r1 updated: fill=blue');
    expect(command.undo()).toBe('rect#r1 updated: fill=red');
    expect(command.redo()).toBe('rect#r1 updated: fill=blue');
  });

  it('undo 可清除原本不存在的样式属性', () => {
    const doc = new SvgDocument();
    const shape = rect('r1');
    doc.insert(shape, doc.root);
    const command = new SetAttrCommand(doc, 'r1', 'stroke', 'black');

    command.execute();
    expect(command.undo()).toBe('rect#r1 updated: stroke=(unset)');
    expect(shape.getAttr('stroke')).toBeUndefined();
  });

  it('text 回显内容带引号；非法属性不改变状态', () => {
    const doc = new SvgDocument();
    const text = new TextShape('t1', 0, 0, 'old');
    doc.insert(text, doc.root);

    expect(new SetAttrCommand(doc, 't1', 'text', 'new value').execute()).toBe(
      'text#t1 updated: text="new value"',
    );
    expect(() => new SetAttrCommand(doc, 't1', 'font', 'large').execute()).toThrow(
      'unknown attribute: font',
    );
    expect(text.textContent()).toBe('new value');
  });
});
