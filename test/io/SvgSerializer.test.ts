import { describe, expect, it } from 'vitest';
import { SvgSerializer } from '../../src/io/SvgSerializer';
import { SvgDocument } from '../../src/model/document/SvgDocument';
import { GroupShape } from '../../src/model/shape/GroupShape';
import { Shape } from '../../src/model/shape/Shape';
import { LineShape } from '../../src/shapes/line/LineShape';
import { RectShape } from '../../src/shapes/rect/RectShape';
import { TextShape } from '../../src/shapes/text/TextShape';

describe('SvgSerializer', () => {
  it('按图形树顺序输出缩进良好的完整 SVG', () => {
    const document = new SvgDocument(400, 200);
    const group = new GroupShape('flow');
    const rect = new RectShape('start', 30, 70, 120, 60);
    rect.setAttr('fill', '#4a90d9');
    const line = new LineShape('edge', 150, 100, 250, 100);
    line.setAttr('stroke', 'black');
    const text = new TextShape('title', 10, 20, 'A & B < C');
    document.insert(group, document.root);
    document.insert(rect, group);
    document.insert(line, group);
    document.insert(text, group);

    expect(new SvgSerializer().serialize(document)).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">',
        '  <g id="flow">',
        '    <rect id="start" x="30" y="70" width="120" height="60" fill="#4a90d9"/>',
        '    <line id="edge" x1="150" y1="100" x2="250" y2="100" stroke="black"/>',
        '    <text id="title" x="10" y="20">A &amp; B &lt; C</text>',
        '  </g>',
        '</svg>',
        '',
      ].join('\n'),
    );
  });

  it('空容器与叶子使用自闭合标签，属性值正确转义', () => {
    const document = new SvgDocument();
    const empty = new GroupShape('empty');
    empty.setExtra('data-note', '"quoted" & <tag>');
    document.insert(empty, document.root);

    const svg = new SvgSerializer().serialize(document);
    expect(svg).toContain('<g id="empty" data-note="&quot;quoted&quot; &amp; &lt;tag&gt;"/>');
  });

  it('只使用 Shape 自描述接口，不需要认识具体图形类', () => {
    class PluginShape extends Shape {
      get tagName(): string {
        return 'diamond';
      }
      move(): void {}
      scale(): void {}
      summary(): string {
        return '(plugin)';
      }
      detailLines(): string[] {
        return [];
      }
      protected override svgGeometry(): Array<[string, string]> {
        return [
          ['points', '0,10 10,0 20,10 10,20'],
          ['data-kind', 'diamond'],
        ];
      }
    }

    const document = new SvgDocument(20, 20);
    document.insert(new PluginShape('d1'), document.root);
    expect(new SvgSerializer().serialize(document)).toContain(
      '<diamond id="d1" points="0,10 10,0 20,10 10,20" data-kind="diamond"/>',
    );
  });

  it('画布浮点尺寸使用统一数字格式', () => {
    const document = new SvgDocument(100.5, 20.25);
    const svg = new SvgSerializer().serialize(document);
    expect(svg).toContain('width="100.5" height="20.25" viewBox="0 0 100.5 20.25"');
  });
});
