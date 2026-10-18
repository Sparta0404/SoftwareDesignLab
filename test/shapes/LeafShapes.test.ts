import { describe, expect, it } from 'vitest';
import { InvalidValueError } from '../../src/model/error/InvalidValueError';
import { NotContainerError } from '../../src/model/error/NotContainerError';
import { UnknownAttributeError } from '../../src/model/error/UnknownAttributeError';
import { GroupShape } from '../../src/model/shape/GroupShape';
import { CircleShape } from '../../src/shapes/circle/CircleShape';
import { EllipseShape } from '../../src/shapes/ellipse/EllipseShape';
import { LineShape } from '../../src/shapes/line/LineShape';
import { RectShape } from '../../src/shapes/rect/RectShape';
import { TextShape } from '../../src/shapes/text/TextShape';

describe('叶子图形', () => {
  it('rect 移动与缩放作用于全部几何属性', () => {
    const r = new RectShape('r1', 10, 20, 100, 50);
    r.move(5, -5);
    expect(r.attributes()).toEqual([
      ['id', 'r1'],
      ['x', '15'],
      ['y', '15'],
      ['width', '100'],
      ['height', '50'],
    ]);
    r.scale(2);
    expect(r.getAttr('x')).toBe('30');
    expect(r.getAttr('width')).toBe('200');
  });

  it('circle / ellipse / line 的移动只改位置', () => {
    const c = new CircleShape('c', 100, 100, 20);
    c.move(30, 0);
    expect(c.summary()).toBe('cx=130 cy=100 r=20');

    const e = new EllipseShape('e', 1, 2, 3, 4);
    e.move(1, 1);
    expect(e.summary()).toBe('cx=2 cy=3 rx=3 ry=4');

    const l = new LineShape('l', 0, 0, 10, 10);
    l.move(1, 2);
    expect(l.summary()).toBe('(1,2) -> (11,12)');
  });

  it('text 只缩放位置，内容通过 textContent 自描述', () => {
    const t = new TextShape('t', 20, 40, 'My Diagram');
    t.scale(2);
    expect(t.summary()).toBe('(40,80) "My Diagram"');
    expect(t.textContent()).toBe('My Diagram');
    expect(t.attributes()).toEqual([
      ['id', 't'],
      ['x', '40'],
      ['y', '80'],
    ]);
  });

  it('geometryValues / restoreGeometry 可精确还原缩放', () => {
    const r = new RectShape('r', 100, 100, 100, 100);
    const snapshot = r.geometryValues();
    r.scale(0.3333333);
    r.restoreGeometry(snapshot);
    expect(r.getAttr('x')).toBe('100');
    expect(r.geometryValues()).toEqual(snapshot);
  });

  it('anchor 给出定位点，容器没有', () => {
    expect(new CircleShape('c', 1, 2, 3).anchor()).toEqual([1, 2]);
    expect(new LineShape('l', 5, 6, 7, 8).anchor()).toEqual([5, 6]);
    expect(new GroupShape('g').anchor()).toBeUndefined();
  });
});

describe('属性白名单', () => {
  it('样式与几何属性可 set，白名单外报错', () => {
    const r = new RectShape('r', 0, 0, 1, 1);
    r.setAttr('fill', 'red');
    r.setAttr('width', '5.5');
    expect(r.getAttr('fill')).toBe('red');
    expect(r.getAttr('width')).toBe('5.5');
    expect(() => r.setAttr('rx', '3')).toThrow(UnknownAttributeError);
    expect(() => r.getAttr('nope')).toThrow('unknown attribute: nope');
  });

  it('非法数字不改变状态', () => {
    const r = new RectShape('r', 1, 2, 3, 4);
    expect(() => r.setAttr('x', 'abc')).toThrow(InvalidValueError);
    expect(r.getAttr('x')).toBe('1');
  });

  it('text 的 text 属性可 set，其余图形没有', () => {
    const t = new TextShape('t', 0, 0, 'a');
    t.setAttr('text', 'b');
    expect(t.textContent()).toBe('b');
    expect(t.attrDisplay('text')).toBe('text="b"');
    expect(() => new RectShape('r', 0, 0, 1, 1).setAttr('text', 'x')).toThrow(UnknownAttributeError);
  });

  it('unsetAttr 只对样式属性有效', () => {
    const r = new RectShape('r', 0, 0, 1, 1);
    r.setAttr('fill', 'red');
    r.unsetAttr('fill');
    expect(r.getAttr('fill')).toBeUndefined();
    expect(() => r.unsetAttr('x')).toThrow(UnknownAttributeError);
  });

  it('未识别的属性作为 extras 原样输出在末尾', () => {
    const t = new TextShape('t', 1, 2, 'x');
    t.setAttr('fill', 'white');
    t.setExtra('text-anchor', 'middle');
    expect(t.attributes().map(([k]) => k)).toEqual(['id', 'x', 'y', 'fill', 'text-anchor']);
  });
});

describe('自描述显示', () => {
  it('summary 带 fill，detailLines 分行', () => {
    const c = new CircleShape('c1', 100, 100, 20);
    c.setAttr('fill', 'red');
    expect(c.summary()).toBe('cx=100 cy=100 r=20 fill=red');
    expect(c.detailLines()).toEqual(['cx=100 cy=100 r=20', 'fill=red']);
  });

  it('浮点噪声在显示时被去掉', () => {
    const c = new CircleShape('c', 0.1, 0, 1);
    c.move(0.2, 0);
    expect(c.getAttr('cx')).toBe('0.3');
  });
});

describe('叶子不是容器', () => {
  it('插入子节点报 not a container', () => {
    const r = new RectShape('r', 0, 0, 1, 1);
    expect(() => r.insertChild(new RectShape('x', 0, 0, 1, 1))).toThrow(NotContainerError);
    expect(r.children()).toEqual([]);
    expect(r.isContainer()).toBe(false);
  });
});
