import { describe, expect, it } from 'vitest';
import { InvalidArgumentsError } from '../../src/factory/error/InvalidArgumentsError';
import { UnknownShapeTypeError } from '../../src/factory/error/UnknownShapeTypeError';
import { InvalidValueError } from '../../src/model/error/InvalidValueError';
import { GroupShape } from '../../src/model/shape/GroupShape';
import { BuiltinShapes } from '../../src/shapes/BuiltinShapes';
import { RectCreator } from '../../src/shapes/rect/RectCreator';

const factory = BuiltinShapes.createFactory();

describe('ShapeFactory.create（来自 CLI 参数）', () => {
  it('六种内置类型都能创建', () => {
    expect(factory.typeNames().sort()).toEqual(['circle', 'ellipse', 'g', 'line', 'rect', 'text']);
    expect(factory.create('rect', 'r1', ['10', '20', '100', '50', '#eee']).summary()).toBe(
      'x=10 y=20 w=100 h=50 fill=#eee',
    );
    expect(factory.create('circle', 'c1', ['100', '100', '20', 'red']).summary()).toBe(
      'cx=100 cy=100 r=20 fill=red',
    );
    expect(factory.create('ellipse', 'e1', ['1', '2', '3', '4']).summary()).toBe('cx=1 cy=2 rx=3 ry=4');
    expect(factory.create('text', 't1', ['20', '40', 'My Diagram']).textContent()).toBe('My Diagram');
    expect(factory.create('g', 'scene', []) instanceof GroupShape).toBe(true);
  });

  it('line 的可选参数是 stroke，省略时不写入属性', () => {
    const withStroke = factory.create('line', 'l1', ['0', '0', '1', '1', 'black']);
    expect(withStroke.getAttr('stroke')).toBe('black');
    const plain = factory.create('rect', 'r', ['0', '0', '1', '1']);
    expect(plain.attributes().map(([k]) => k)).toEqual(['id', 'x', 'y', 'width', 'height']);
  });

  it('未知类型报 unknown shape type', () => {
    expect(() => factory.create('hexagon', 'h', [])).toThrow(UnknownShapeTypeError);
    expect(() => factory.create('hexagon', 'h', [])).toThrow(
      'unknown shape type: hexagon (is the plugin loaded?)',
    );
  });

  it('参数个数不对给出 usage，数字非法给出 invalid number', () => {
    expect(() => factory.create('rect', 'r', ['1', '2'])).toThrow(InvalidArgumentsError);
    expect(() => factory.create('rect', 'r', ['1', '2'])).toThrow(
      'usage: create rect <id> <x> <y> <w> <h> [fill]',
    );
    expect(() => factory.create('rect', 'r', ['1', '2', '3', '4', 'red', 'extra'])).toThrow(
      InvalidArgumentsError,
    );
    expect(() => factory.create('circle', 'c', ['1', 'x', '3'])).toThrow(InvalidValueError);
    expect(() => factory.create('g', 'g', ['1'])).toThrow(InvalidArgumentsError);
    expect(() => factory.create('text', 't', ['1', '2'])).toThrow(InvalidArgumentsError);
  });
});

describe('ShapeFactory.createFromSvg（来自 SVG 属性）', () => {
  it('几何、样式与未识别属性分别落位', () => {
    const attrs = new Map([
      ['id', 'ignored'],
      ['x', '10'],
      ['y', '20'],
      ['width', '30'],
      ['height', '40'],
      ['fill', '#fff'],
      ['rx', '5'],
    ]);
    const rect = factory.createFromSvg('rect', 'r1', attrs, '');
    expect(rect.attributes()).toEqual([
      ['id', 'r1'],
      ['x', '10'],
      ['y', '20'],
      ['width', '30'],
      ['height', '40'],
      ['fill', '#fff'],
      ['rx', '5'],
    ]);
  });

  it('缺失的几何属性默认为 0，text 取元素内容', () => {
    const t = factory.createFromSvg('text', 't1', new Map([['x', '10']]), 'imported');
    expect(t.summary()).toBe('(10,0) "imported"');
  });

  it('不支持的标签报 unknown shape type', () => {
    expect(() => factory.createFromSvg('path', 'p', new Map(), '')).toThrow(UnknownShapeTypeError);
  });
});

describe('BuiltinShapes', () => {
  it('重复注册内置类型会报错', () => {
    expect(() => BuiltinShapes.createFactory().register(new RectCreator())).toThrow('already registered');
  });
});
