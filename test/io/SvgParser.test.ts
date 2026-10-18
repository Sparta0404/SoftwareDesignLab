import { describe, expect, it } from 'vitest';
import type { WarningSink } from '../../src/app/port/WarningSink';
import { SvgParser } from '../../src/io/SvgParser';
import { SvgSerializer } from '../../src/io/SvgSerializer';
import { IdExistsError } from '../../src/model/error/IdExistsError';
import { BuiltinShapes } from '../../src/shapes/BuiltinShapes';

class WarningSinkSpy implements WarningSink {
  readonly messages: string[] = [];

  warn(message: string): void {
    this.messages.push(message);
  }
}

function parser(): SvgParser {
  return new SvgParser(BuiltinShapes.createFactory());
}

describe('SvgParser', () => {
  it('读取画布、全部内置类型、嵌套结构与原始顺序', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect id="bg" x="0" y="0" width="400" height="300" fill="#ffffff"/>
  <text id="t1" x="10" y="290">A &amp; B</text>
  <circle id="c1" cx="50" cy="50" r="10"/>
  <g id="g1">
    <rect id="r2" x="0" y="0" width="10" height="10"/>
    <ellipse id="e1" cx="5" cy="5" rx="3" ry="4"/>
    <line id="l1" x1="0" y1="0" x2="10" y2="10" stroke="black"/>
  </g>
</svg>`;
    const warnings = new WarningSinkSpy();

    const document = parser().parse(xml, warnings);

    expect([document.width, document.height, document.shapeCount]).toEqual([400, 300, 7]);
    expect(document.root.children().map((shape) => shape.id)).toEqual(['bg', 't1', 'c1', 'g1']);
    expect(document.find('g1').children().map((shape) => shape.id)).toEqual(['r2', 'e1', 'l1']);
    expect(document.find('bg').summary()).toBe('x=0 y=0 w=400 h=300 fill=#ffffff');
    expect(document.find('t1').textContent()).toBe('A & B');
    expect(document.find('l1').getAttr('stroke')).toBe('black');
    expect(warnings.messages).toEqual([]);
  });

  it('缺 id 时按标签分别编号并逐条警告，跳过已被显式 id 占用的名字', () => {
    const xml = `<svg width="10" height="10">
  <rect x="0" y="0" width="1" height="1"/>
  <circle cx="1" cy="1" r="1"/>
  <rect id="rect1" x="1" y="1" width="1" height="1"/>
  <g><rect x="2" y="2" width="1" height="1"/></g>
</svg>`;
    const warnings = new WarningSinkSpy();

    const document = parser().parse(xml, warnings);

    expect(document.root.children().map((shape) => shape.id)).toEqual([
      'rect2',
      'circle1',
      'rect1',
      'g1',
    ]);
    expect(document.find('g1').children()[0].id).toBe('rect3');
    expect(warnings.messages).toEqual([
      'assigned id rect2 to unnamed <rect>',
      'assigned id circle1 to unnamed <circle>',
      'assigned id g1 to unnamed <g>',
      'assigned id rect3 to unnamed <rect>',
    ]);
  });

  it('保留未知属性；带 data-kind 的未知插件降级为普通 g', () => {
    const xml = `<svg width="100" height="50">
  <g id="n1" data-kind="box" transform="translate(1,2)">
    <text id="label" x="1" y="2" text-anchor="middle">hello</text>
  </g>
</svg>`;
    const document = parser().parse(xml, new WarningSinkSpy());
    const group = document.find('n1');

    expect(group.tagName).toBe('g');
    expect(group.isComposite()).toBe(false);
    expect(group.attributes()).toContainEqual(['data-kind', 'box']);
    expect(group.attributes()).toContainEqual(['transform', 'translate(1,2)']);
    expect(document.find('label').attributes()).toContainEqual(['text-anchor', 'middle']);
  });

  it('解析后再序列化可保持结构、属性与文本语义', () => {
    const xml = `<svg width="100" height="50">
  <g id="g"><text id="t" x="1" y="2" fill="red">A &amp; B</text></g>
</svg>`;
    const first = parser().parse(xml, new WarningSinkSpy());
    const serialized = new SvgSerializer().serialize(first);
    const second = parser().parse(serialized, new WarningSinkSpy());

    expect(second.find('g').children().map((shape) => shape.id)).toEqual(['t']);
    expect(second.find('t').textContent()).toBe('A & B');
    expect(second.find('t').getAttr('fill')).toBe('red');
  });

  it('重复 id、未知元素、非 svg 根和非法 XML 都会失败', () => {
    expect(() =>
      parser().parse(
        '<svg width="10" height="10"><rect id="x"/><circle id="x"/></svg>',
        new WarningSinkSpy(),
      ),
    ).toThrow(IdExistsError);
    expect(() =>
      parser().parse('<svg width="10" height="10"><path id="p"/></svg>', new WarningSinkSpy()),
    ).toThrow('unknown shape type: path');
    expect(() => parser().parse('<html/>', new WarningSinkSpy())).toThrow(
      'root element must be <svg>',
    );
    expect(() => parser().parse('<svg><g></svg>', new WarningSinkSpy())).toThrow('invalid XML');
  });

  it('缺失尺寸使用 800x600，非法尺寸不产生文档', () => {
    const defaults = parser().parse('<svg/>', new WarningSinkSpy());
    expect([defaults.width, defaults.height]).toEqual([800, 600]);
    expect(() =>
      parser().parse('<svg width="0" height="10"/>', new WarningSinkSpy()),
    ).toThrow('canvas size must be positive');
  });
});
