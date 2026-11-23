import { describe, expect, it } from 'vitest';
import type { WarningSink } from '../../src/app/port/WarningSink';
import { SvgParser } from '../../src/io/SvgParser';
import { SvgSerializer } from '../../src/io/SvgSerializer';
import { IdExistsError } from '../../src/model/error/IdExistsError';
import { BuiltinShapes } from '../../src/shapes/BuiltinShapes';
import { factoryWithBox, FakeBoxShape } from '../support/FakeBox';

class WarningSinkSpy implements WarningSink {
  readonly messages: string[] = [];

  warn(message: string): void {
    this.messages.push(message);
  }
}

const BOX_XML = `<svg width="400" height="300">
  <g id="n1" data-kind="box">
    <rect id="n1-rect" x="10" y="10" width="100" height="40" fill="#4a90d9"/>
    <text id="n1-label" x="30" y="35">Hello</text>
  </g>
  <rect id="r1" x="0" y="0" width="5" height="5"/>
</svg>`;

describe('SvgParser：先构造子树，再由提供者组装', () => {
  it('复合图形的提供者接管 rect/text 子部件，整棵子树一次性登记', () => {
    const document = new SvgParser(factoryWithBox()).parse(BOX_XML, new WarningSinkSpy());

    const box = document.find('n1');
    expect(box).toBeInstanceOf(FakeBoxShape);
    expect(box.children().map((child) => child.id)).toEqual(['n1-rect', 'n1-label']);
    expect(document.shapeCount).toBe(4);
    expect(document.find('n1-rect').parent).toBe(box);
  });

  it('读回的复合图形可原样序列化（round-trip）', () => {
    const factory = factoryWithBox();
    const first = new SvgParser(factory).parse(BOX_XML, new WarningSinkSpy());
    const serialized = new SvgSerializer().serialize(first);
    const second = new SvgParser(factory).parse(serialized, new WarningSinkSpy());

    expect(new SvgSerializer().serialize(second)).toBe(serialized);
    expect(serialized).toContain('<g id="n1" data-kind="box">');
  });

  it('没装复合图形插件时降级为普通 g，子部件仍可读回并写回', () => {
    const parser = new SvgParser(BuiltinShapes.createFactory());
    const document = parser.parse(BOX_XML, new WarningSinkSpy());

    expect(document.find('n1').isComposite()).toBe(false);
    expect(document.find('n1-rect').parent).toBe(document.find('n1'));
    expect(new SvgSerializer().serialize(document)).toContain('data-kind="box"');
  });

  it('提供者拒绝坏子树时整个读入失败，错误原样抛出', () => {
    const xml = `<svg width="10" height="10">
  <g id="n1" data-kind="box"><rect id="n1-rect" x="0" y="0" width="1" height="1"/></g>
</svg>`;
    expect(() => new SvgParser(factoryWithBox()).parse(xml, new WarningSinkSpy())).toThrow(
      'invalid box: n1',
    );
  });

  it('子树内部或与其他子树重复的 id 整体被拒绝', () => {
    const inner = `<svg width="10" height="10">
  <g id="a"><rect id="x"/><circle id="x"/></g>
</svg>`;
    const across = `<svg width="10" height="10">
  <g id="a"><rect id="x"/></g><g id="b"><rect id="x"/></g>
</svg>`;
    const parser = new SvgParser(BuiltinShapes.createFactory());
    expect(() => parser.parse(inner, new WarningSinkSpy())).toThrow(IdExistsError);
    expect(() => parser.parse(across, new WarningSinkSpy())).toThrow('id already exists: x');
  });

  it('缺 id 的警告仍按文档先序输出（父节点先于子节点）', () => {
    const xml = `<svg width="10" height="10"><g><rect x="0" y="0" width="1" height="1"/></g><g/></svg>`;
    const warnings = new WarningSinkSpy();
    new SvgParser(BuiltinShapes.createFactory()).parse(xml, warnings);
    expect(warnings.messages).toEqual([
      'assigned id g1 to unnamed <g>',
      'assigned id rect1 to unnamed <rect>',
      'assigned id g2 to unnamed <g>',
    ]);
  });

  it('叶子图形带子元素仍报 not a container', () => {
    const xml = '<svg width="10" height="10"><rect id="r"><rect id="c"/></rect></svg>';
    expect(() =>
      new SvgParser(BuiltinShapes.createFactory()).parse(xml, new WarningSinkSpy()),
    ).toThrow('not a container: r');
  });
});
