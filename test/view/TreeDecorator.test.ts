import { describe, expect, it } from 'vitest';
import { SvgDocument } from '../../src/model/document/SvgDocument';
import { GroupShape } from '../../src/model/shape/GroupShape';
import { RectShape } from '../../src/shapes/rect/RectShape';
import { TextShape } from '../../src/shapes/text/TextShape';
import type { TreeDecorator, TreeNodeInfo } from '../../src/view/TreeDecorator';
import { TreeDecoratorRegistry } from '../../src/view/TreeDecoratorRegistry';
import { TreeRenderer } from '../../src/view/TreeRenderer';
import { factoryWithBox } from '../support/FakeBox';

function sample(): SvgDocument {
  const document = new SvgDocument(800, 600);
  document.insert(new RectShape('bg', 0, 0, 800, 600), document.root);
  const group = new GroupShape('grp');
  document.insert(group, document.root);
  document.insert(new TextShape('title', 20, 40, 'Hi'), group);
  document.insert(new RectShape('r2', 1, 2, 3, 4), group);
  return document;
}

const mark = (name: string, tag: string, when: (node: TreeNodeInfo) => boolean): TreeDecorator => ({
  name,
  decorate: (node) => (when(node) ? tag : undefined),
});

describe('TreeRenderer 与 TreeDecorator', () => {
  it('没有任何装饰器时输出与无扩展点时逐字节相同', () => {
    const document = sample();
    expect(new TreeRenderer([]).render(document)).toBe(new TreeRenderer().render(document));
    expect(new TreeRenderer().render(document)).toBe(
      [
        'svg (800x600)',
        '├── rect#bg         x=0 y=0 w=800 h=600',
        '└── g#grp',
        '    ├── text#title  (20,40) "Hi"',
        '    └── rect#r2     x=1 y=2 w=3 h=4',
      ].join('\n'),
    );
  });

  it('标签追加在行尾；对齐列只由 summary 决定，不受标签影响', () => {
    const decorator = mark('all', '[x]', () => true);
    expect(new TreeRenderer([decorator]).render(sample())).toBe(
      [
        'svg (800x600) [x]',
        '├── rect#bg         x=0 y=0 w=800 h=600 [x]',
        '└── g#grp [x]',
        '    ├── text#title  (20,40) "Hi" [x]',
        '    └── rect#r2     x=1 y=2 w=3 h=4 [x]',
      ].join('\n'),
    );
  });

  it('多个装饰器按注册顺序以空格拼接，返回 undefined 或空串的被跳过', () => {
    const decorators = [
      mark('first', '(a)', (n) => n.shape.id === 'grp'),
      { name: 'empty', decorate: () => '' } satisfies TreeDecorator,
      mark('second', '*', (n) => n.shape.id === 'grp'),
    ];
    const lines = new TreeRenderer(decorators).render(sample()).split('\n');
    expect(lines[2]).toBe('└── g#grp (a) *');
    expect(lines[1]).toBe('├── rect#bg         x=0 y=0 w=800 h=600');
  });

  it('文档根行带 isDocumentRoot；tree <id> 的首行不是文档根', () => {
    const seen: Array<[string, boolean]> = [];
    const spy: TreeDecorator = {
      name: 'spy',
      decorate: (node) => {
        seen.push([node.shape.id, node.isDocumentRoot]);
        return node.isDocumentRoot ? '*' : undefined;
      },
    };
    const document = sample();
    expect(new TreeRenderer([spy]).render(document).split('\n')[0]).toBe('svg (800x600) *');
    expect(seen[0]).toEqual(['svg', true]);
    seen.length = 0;
    expect(new TreeRenderer([spy]).render(document, 'grp').split('\n')[0]).toBe('g#grp');
    expect(seen[0]).toEqual(['grp', false]);
  });

  it('装饰器拿到 shape 与 document，可识别复合图形并追加类型标签', () => {
    const document = new SvgDocument();
    document.insert(factoryWithBox().create('box', 'n1', ['0', '0', '10', '10', 'T']), document.root);
    const tagBox: TreeDecorator = {
      name: 'box-type',
      decorate: (node) => (node.shape.isComposite() && node.document === document ? '(box)' : undefined),
    };
    expect(new TreeRenderer([tagBox]).render(document).split('\n')[1]).toBe('└── g#n1 (box)');
  });

  it('装饰器抛错：整条 tree 失败，报 tree decorator failed: <name> (<reason>)', () => {
    const broken: TreeDecorator = {
      name: 'broken',
      decorate: () => {
        throw new Error('kaboom');
      },
    };
    expect(() => new TreeRenderer([broken]).render(sample())).toThrow(
      'tree decorator failed: broken (kaboom)',
    );
  });
});

describe('TreeDecoratorRegistry', () => {
  it('保持注册顺序，同名装饰器重复注册报错', () => {
    const registry = new TreeDecoratorRegistry()
      .register(mark('b', 'b', () => true))
      .register(mark('a', 'a', () => true));
    expect(registry.all().map((d) => d.name)).toEqual(['b', 'a']);
    expect(() => registry.register(mark('a', 'a', () => true))).toThrow(
      'tree decorator already registered: a',
    );
  });
});
