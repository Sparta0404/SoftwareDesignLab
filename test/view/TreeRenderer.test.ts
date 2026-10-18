import { describe, expect, it } from 'vitest';
import { SvgDocument } from '../../src/model/document/SvgDocument';
import { GroupShape } from '../../src/model/shape/GroupShape';
import { CircleShape } from '../../src/shapes/circle/CircleShape';
import { RectShape } from '../../src/shapes/rect/RectShape';
import { TextShape } from '../../src/shapes/text/TextShape';
import { TreeRenderer } from '../../src/view/TreeRenderer';

function sampleDocument(): SvgDocument {
  const document = new SvgDocument(800, 600);
  const background = new RectShape('bg', 0, 0, 800, 600);
  background.setAttr('fill', '#ffffff');
  const title = new TextShape('title', 20, 40, 'My Diagram');
  const markers = new GroupShape('markers');
  const circle = new CircleShape('c1', 100, 100, 20);
  circle.setAttr('fill', 'red');
  const box = new RectShape('box', 200, 80, 60, 60);
  box.setAttr('fill', '#3366ff');

  document.insert(background, document.root);
  document.insert(title, document.root);
  document.insert(markers, document.root);
  document.insert(circle, markers);
  document.insert(box, markers);
  return document;
}

describe('TreeRenderer', () => {
  it('显示完整文档树，连接符正确，所有属性摘要全局对齐', () => {
    expect(new TreeRenderer().render(sampleDocument())).toBe(
      [
        'svg (800x600)',
        '├── rect#bg        x=0 y=0 w=800 h=600 fill=#ffffff',
        '├── text#title     (20,40) "My Diagram"',
        '└── g#markers',
        '    ├── circle#c1  cx=100 cy=100 r=20 fill=red',
        '    └── rect#box   x=200 y=80 w=60 h=60 fill=#3366ff',
      ].join('\n'),
    );
  });

  it('tree <id> 只显示指定图形为根的子树', () => {
    expect(new TreeRenderer().render(sampleDocument(), 'markers')).toBe(
      [
        'g#markers',
        '├── circle#c1  cx=100 cy=100 r=20 fill=red',
        '└── rect#box   x=200 y=80 w=60 h=60 fill=#3366ff',
      ].join('\n'),
    );
  });

  it('叶子子树只有一行；不存在的 id 由文档抛错', () => {
    const renderer = new TreeRenderer();
    expect(renderer.render(sampleDocument(), 'c1')).toBe(
      'circle#c1 cx=100 cy=100 r=20 fill=red',
    );
    expect(() => renderer.render(sampleDocument(), 'missing')).toThrow('no such shape: missing');
  });

  it('空文档只显示画布，浮点尺寸使用统一数字格式', () => {
    expect(new TreeRenderer().render(new SvgDocument(100.5, 20.25))).toBe(
      'svg (100.5x20.25)',
    );
  });

  it('新增插件图形无需修改渲染器', () => {
    class BoxShape extends GroupShape {
      override summary(): string {
        return '(box)';
      }
    }
    const document = new SvgDocument();
    const box = new BoxShape('n1');
    const rect = new RectShape('n1-rect', 1, 2, 3, 4);
    document.insert(box, document.root);
    document.insert(rect, box);

    expect(new TreeRenderer().render(document)).toBe(
      ['svg (800x600)', '└── g#n1 (box)', '    └── rect#n1-rect  x=1 y=2 w=3 h=4'].join(
        '\n',
      ),
    );
  });
});
