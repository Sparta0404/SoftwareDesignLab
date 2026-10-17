import { describe, expect, it } from 'vitest';
import { CircleShape } from '../../src/model/CircleShape';
import { GroupShape } from '../../src/model/GroupShape';
import { RectShape } from '../../src/model/RectShape';

function sample() {
  const g = new GroupShape('g');
  const r = new RectShape('r', 0, 0, 10, 10);
  const inner = new GroupShape('inner');
  const c = new CircleShape('c', 5, 5, 2);
  g.insertChild(r);
  g.insertChild(inner);
  inner.insertChild(c);
  return { g, r, inner, c };
}

describe('GroupShape', () => {
  it('insertChild / removeChild 维护 parent 与顺序', () => {
    const { g, r, inner } = sample();
    expect(g.children()).toEqual([r, inner]);
    expect(r.parent).toBe(g);
    expect(g.removeChild(r)).toBe(0);
    expect(r.parent).toBeNull();
    g.insertChild(r, 1);
    expect(g.children()).toEqual([inner, r]);
  });

  it('同一图形不能同时挂在两个位置', () => {
    const { g, c } = sample();
    expect(() => g.insertChild(c)).toThrow('already attached');
  });

  it('move / scale 递归作用到所有子孙', () => {
    const { g, r, c } = sample();
    g.move(10, 20);
    expect(r.summary()).toBe('x=10 y=20 w=10 h=10');
    expect(c.summary()).toBe('cx=15 cy=25 r=2');
    g.scale(2);
    expect(r.summary()).toBe('x=20 y=40 w=20 h=20');
    expect(c.summary()).toBe('cx=30 cy=50 r=4');
  });

  it('walk 为先序遍历，isDescendantOf 判断祖先关系', () => {
    const { g, r, inner, c } = sample();
    expect(g.walk()).toEqual([g, r, inner, c]);
    expect(c.isDescendantOf(g)).toBe(true);
    expect(c.isDescendantOf(inner)).toBe(true);
    expect(r.isDescendantOf(inner)).toBe(false);
    expect(g.isDescendantOf(g)).toBe(false);
  });

  it('容器没有摘要，明细包含 children 数', () => {
    const { g } = sample();
    expect(g.summary()).toBe('');
    expect(g.detailLines()).toEqual(['children=2']);
    expect(g.isContainer()).toBe(true);
    expect(g.isComposite()).toBe(false);
  });

  it('容器自身可以设置样式并自描述', () => {
    const { g } = sample();
    g.setAttr('fill', 'blue');
    expect(g.attributes()).toEqual([
      ['id', 'g'],
      ['fill', 'blue'],
    ]);
  });
});
