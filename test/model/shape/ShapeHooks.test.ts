import { describe, expect, it } from 'vitest';
import { SvgDocument } from '../../../src/model/document/SvgDocument';
import { GroupShape } from '../../../src/model/shape/GroupShape';
import { RectShape } from '../../../src/shapes/rect/RectShape';
import { TextShape } from '../../../src/shapes/text/TextShape';
import { factoryWithBox, FakeBoxShape } from '../../support/FakeBox';

describe('Shape 扩展钩子的默认行为（内置图形输出不变）', () => {
  it('displayLabel 默认等于 label，creationNote 默认为空', () => {
    for (const shape of [new RectShape('r', 0, 0, 1, 1), new GroupShape('g')]) {
      expect(shape.displayLabel).toBe(shape.label);
      expect(shape.creationNote()).toBeUndefined();
    }
  });

  it('子类可以让回显名与 tree/show 的 label 不同', () => {
    const box = new FakeBoxShape('n1');
    expect(box.label).toBe('g#n1');
    expect(box.displayLabel).toBe('box#n1');
  });
});

describe('captureState / restoreState', () => {
  it('恢复几何、样式与 text 内容，已删除的样式属性回到未设置', () => {
    const rect = new RectShape('r', 1, 2, 3, 4);
    rect.setAttr('fill', 'red');
    const text = new TextShape('t', 5, 6, 'old');
    const rectState = rect.captureState();
    const textState = text.captureState();

    rect.setAttr('fill', 'blue');
    rect.setAttr('stroke', 'black');
    rect.setAttr('width', '99');
    rect.move(10, 10);
    text.setAttr('text', 'new');

    rect.restoreState(rectState);
    text.restoreState(textState);

    expect(rect.attributes()).toEqual([
      ['id', 'r'],
      ['x', '1'],
      ['y', '2'],
      ['width', '3'],
      ['height', '4'],
      ['fill', 'red'],
    ]);
    expect(rect.getAttr('stroke')).toBeUndefined();
    expect(text.textContent()).toBe('old');
  });

  it('状态是值快照：之后再修改不会污染已捕获的备忘录', () => {
    const rect = new RectShape('r', 1, 2, 3, 4);
    rect.setAttr('fill', 'red');
    const state = rect.captureState();
    rect.setAttr('fill', 'green');
    rect.restoreState(state);
    rect.setAttr('fill', 'yellow');
    rect.restoreState(state);
    expect(rect.getAttr('fill')).toBe('red');
  });

  it('对 walk() 逐节点捕获即得到子树备忘录', () => {
    const box = factoryWithBox().create('box', 'n1', ['0', '0', '100', '40', 'Hi']);
    const nodes = box.walk();
    const states = nodes.map((node) => node.captureState());

    box.children()[0].setAttr('fill', 'red');
    box.children()[1].setAttr('text', 'changed');
    nodes.forEach((node, index) => node.restoreState(states[index]));

    expect(box.children()[0].getAttr('fill')).toBeUndefined();
    expect(box.children()[1].textContent()).toBe('Hi');
  });
});

describe('子部件保护：所有摘除都经过 removeChild', () => {
  function documentWithBox() {
    const document = new SvgDocument();
    const box = factoryWithBox().create('box', 'n1', ['0', '0', '100', '40', 'Hi']);
    document.insert(box, document.root);
    return { document, box };
  }

  it('复合图形重写 removeChild 后，文档 detach 失败且不改变任何状态', () => {
    const { document, box } = documentWithBox();
    expect(() => document.detach(document.find('n1-rect'))).toThrow(
      'cannot detach n1-rect from box#n1',
    );
    expect(document.has('n1-rect')).toBe(true);
    expect(box.children().map((child) => child.id)).toEqual(['n1-rect', 'n1-label']);
  });

  it('relocate 同样被拒绝，原位置不变', () => {
    const { document, box } = documentWithBox();
    const other = new GroupShape('g1');
    document.insert(other, document.root);
    expect(() => document.relocate(document.find('n1-label'), other)).toThrow('cannot detach');
    expect(box.children()).toHaveLength(2);
    expect(other.children()).toHaveLength(0);
  });

  it('整个复合图形本身仍可被摘除（含全部子部件 id）', () => {
    const { document } = documentWithBox();
    document.detach(document.find('n1'));
    expect(document.shapeCount).toBe(0);
  });
});
