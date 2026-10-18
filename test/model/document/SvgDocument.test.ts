import { describe, expect, it } from 'vitest';
import { SvgDocument } from '../../../src/model/document/SvgDocument';
import { IdExistsError } from '../../../src/model/error/IdExistsError';
import { InvalidValueError } from '../../../src/model/error/InvalidValueError';
import { NoSuchContainerError } from '../../../src/model/error/NoSuchContainerError';
import { NoSuchShapeError } from '../../../src/model/error/NoSuchShapeError';
import { NotContainerError } from '../../../src/model/error/NotContainerError';
import { GroupShape } from '../../../src/model/shape/GroupShape';
import { RectShape } from '../../../src/shapes/rect/RectShape';

function rect(id: string) {
  return new RectShape(id, 0, 0, 1, 1);
}

describe('SvgDocument', () => {
  it('默认画布 800x600，resize 可只改一个维度', () => {
    const doc = new SvgDocument();
    expect([doc.width, doc.height]).toEqual([800, 600]);
    doc.resize(400);
    expect([doc.width, doc.height]).toEqual([400, 600]);
    expect(() => doc.resize(0, 10)).toThrow(InvalidValueError);
    expect([doc.width, doc.height]).toEqual([400, 600]);
  });

  it('insert 登记 id，重复 id 报错且不改变状态', () => {
    const doc = new SvgDocument();
    doc.insert(rect('r1'), doc.root);
    expect(() => doc.insert(rect('r1'), doc.root)).toThrow(IdExistsError);
    expect(doc.root.children()).toHaveLength(1);
    expect(doc.shapeCount).toBe(1);
  });

  it('插入子树时整棵树的 id 都要登记，子树内重复也报错', () => {
    const doc = new SvgDocument();
    const g = new GroupShape('g');
    g.insertChild(rect('a'));
    g.insertChild(rect('a'));
    expect(() => doc.insert(g, doc.root)).toThrow(IdExistsError);
    expect(doc.shapeCount).toBe(0);
  });

  it('find / findContainer 的错误类型', () => {
    const doc = new SvgDocument();
    doc.insert(rect('r1'), doc.root);
    doc.insert(new GroupShape('g1'), doc.root);
    expect(doc.find('r1').id).toBe('r1');
    expect(() => doc.find('r9')).toThrow(NoSuchShapeError);
    expect(doc.findContainer('g1').id).toBe('g1');
    expect(() => doc.findContainer('node9')).toThrow(NoSuchContainerError);
    expect(() => doc.findContainer('r1')).toThrow(NotContainerError);
    expect(() => doc.find('svg')).toThrow(NoSuchShapeError);
  });

  it('detach 注销整棵子树 id 并返回原位置，再 insert 可还原', () => {
    const doc = new SvgDocument();
    const g = new GroupShape('g');
    const a = rect('a');
    doc.insert(rect('first'), doc.root);
    doc.insert(g, doc.root);
    doc.insert(a, g);
    const placement = doc.detach(g);
    expect(placement).toEqual({ parent: doc.root, index: 1 });
    expect(doc.has('g')).toBe(false);
    expect(doc.has('a')).toBe(false);
    doc.insert(g, placement.parent, placement.index);
    expect(doc.find('a')).toBe(a);
  });

  it('relocate 不改变 id 登记，不允许移入自身子孙', () => {
    const doc = new SvgDocument();
    const g = new GroupShape('g');
    const inner = new GroupShape('inner');
    const r = rect('r');
    doc.insert(g, doc.root);
    doc.insert(inner, g);
    doc.insert(r, doc.root);
    doc.relocate(r, inner);
    expect(r.parent).toBe(inner);
    expect(doc.has('r')).toBe(true);
    expect(() => doc.relocate(g, inner)).toThrow('into itself');
  });

  it('parentLabel：根节点显示为 svg', () => {
    const doc = new SvgDocument();
    const g = new GroupShape('g');
    const r = rect('r');
    doc.insert(g, doc.root);
    doc.insert(r, g);
    expect(doc.parentLabel(g)).toBe('svg');
    expect(doc.parentLabel(r)).toBe('g#g');
  });
});
