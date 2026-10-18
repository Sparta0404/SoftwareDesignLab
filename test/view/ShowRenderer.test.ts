import { describe, expect, it } from 'vitest';
import { SvgDocument } from '../../src/model/document/SvgDocument';
import { GroupShape } from '../../src/model/shape/GroupShape';
import { Shape } from '../../src/model/shape/Shape';
import { CircleShape } from '../../src/shapes/circle/CircleShape';
import { TextShape } from '../../src/shapes/text/TextShape';
import { ShowRenderer } from '../../src/view/ShowRenderer';

describe('ShowRenderer', () => {
  it('显示图形标识、父容器和逐行属性明细', () => {
    const document = new SvgDocument();
    const group = new GroupShape('markers');
    const circle = new CircleShape('c1', 100, 100, 20);
    circle.setAttr('fill', 'red');
    document.insert(group, document.root);
    document.insert(circle, group);

    expect(new ShowRenderer().render(document, 'c1')).toBe(
      ['circle#c1  parent=g#markers', '  cx=100 cy=100 r=20', '  fill=red'].join('\n'),
    );
  });

  it('顶层图形的父节点显示为 svg，text 内容独立成行', () => {
    const document = new SvgDocument();
    const text = new TextShape('title', 20, 40, 'My Diagram');
    document.insert(text, document.root);

    expect(new ShowRenderer().render(document, 'title')).toBe(
      ['text#title  parent=svg', '  x=20 y=40', '  text="My Diagram"'].join('\n'),
    );
  });

  it('容器明细由 GroupShape 自描述', () => {
    const document = new SvgDocument();
    const group = new GroupShape('g1');
    document.insert(group, document.root);

    expect(new ShowRenderer().render(document, 'g1')).toBe(
      ['g#g1  parent=svg', '  children=0'].join('\n'),
    );
  });

  it('新增插件图形的明细无需修改渲染器', () => {
    class PluginShape extends Shape {
      get tagName(): string {
        return 'plugin';
      }
      move(): void {}
      scale(): void {}
      summary(): string {
        return 'custom';
      }
      detailLines(): string[] {
        return ['alpha=1', 'label="hello"'];
      }
    }
    const document = new SvgDocument();
    document.insert(new PluginShape('p1'), document.root);

    expect(new ShowRenderer().render(document, 'p1')).toBe(
      ['plugin#p1  parent=svg', '  alpha=1', '  label="hello"'].join('\n'),
    );
  });

  it('不存在的 id 由文档抛错', () => {
    expect(() => new ShowRenderer().render(new SvgDocument(), 'missing')).toThrow(
      'no such shape: missing',
    );
  });
});
