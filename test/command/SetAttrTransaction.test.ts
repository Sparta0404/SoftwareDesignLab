import { describe, expect, it } from 'vitest';
import { AttributeHandlerRegistry } from '../../src/command/attribute/AttributeHandlerRegistry';
import type { AttributeHandler } from '../../src/command/attribute/AttributeHandler';
import { SetAttrCommand } from '../../src/command/edit/SetAttrCommand';
import { CommandHistory } from '../../src/command/history/CommandHistory';
import { SvgDocument } from '../../src/model/document/SvgDocument';
import { ContractViolationError } from '../../src/model/error/ContractViolationError';
import { GroupShape } from '../../src/model/shape/GroupShape';
import type { Shape } from '../../src/model/shape/Shape';
import { RectShape } from '../../src/shapes/rect/RectShape';
import { TextShape } from '../../src/shapes/text/TextShape';
import { factoryWithBox, FakeBoxAttributeHandler, FakeBoxShape } from '../support/FakeBox';

function setup(...handlers: AttributeHandler[]) {
  const document = new SvgDocument();
  const box = factoryWithBox().create('box', 'n1', ['0', '0', '100', '40', 'Hi']);
  document.insert(box, document.root);
  const plain = new RectShape('r1', 0, 0, 5, 5);
  document.insert(plain, document.root);
  const registry = new AttributeHandlerRegistry();
  handlers.forEach((handler) => registry.register(handler));
  const set = (id: string, attr: string, value: string) =>
    new SetAttrCommand(document, id, attr, value, registry);
  return { document, box: box as FakeBoxShape, plain, registry, set };
}

function snapshot(document: SvgDocument): string {
  return JSON.stringify(
    document.root.walk().map((shape) => [shape.id, shape.attributes(), shape.textContent()]),
  );
}

describe('AttributeHandlerRegistry', () => {
  it('同名处理器不能重复注册，matching 只返回命中者', () => {
    const registry = new AttributeHandlerRegistry().register(new FakeBoxAttributeHandler());
    expect(() => registry.register(new FakeBoxAttributeHandler())).toThrow(
      'attribute handler already registered: fake-box-attributes',
    );
    const { box, plain } = setup();
    expect(registry.matching(box, 'fill').map((h) => h.name)).toEqual(['fake-box-attributes']);
    expect(registry.matching(plain, 'fill')).toEqual([]);
    expect(registry.matching(box, 'stroke')).toEqual([]);
  });
});

describe('SetAttrCommand：未命中任何处理器时走 Phase 1 默认路径', () => {
  it('回显、白名单与撤销与没有注册表时完全一致', () => {
    const { set, plain } = setup(new FakeBoxAttributeHandler());
    const command = set('r1', 'fill', 'red');
    expect(command.execute()).toBe('rect#r1 updated: fill=red');
    expect(command.undo()).toBe('rect#r1 updated: fill=(unset)');
    expect(plain.getAttr('fill')).toBeUndefined();
    expect(() => set('r1', 'font', 'x').execute()).toThrow('unknown attribute: font');
  });

  it('复合图形未被处理器接管的属性仍走默认路径（stroke 写在 g 上）', () => {
    const { set, box } = setup(new FakeBoxAttributeHandler());
    expect(set('n1', 'stroke', 'black').execute()).toBe('box#n1 updated: stroke=black');
    expect(box.getAttr('stroke')).toBe('black');
  });
});

describe('SetAttrCommand：命中唯一处理器', () => {
  it('apply 的回显作为命令结果，不触碰默认路径（g 本身不会得到 fill）', () => {
    const { set, box } = setup(new FakeBoxAttributeHandler());
    expect(set('n1', 'fill', 'red').execute()).toBe('fill propagated to n1-rect');
    expect(box.part('rect').getAttr('fill')).toBe('red');
    expect(box.getAttr('fill')).toBeUndefined();
    expect(set('n1', 'label', 'World').execute()).toBe('label updated: "World"');
    expect((box.part('label') as TextShape).textContent()).toBe('World');
  });

  it('undo 使用 undoMessage 并整体恢复，redo 恢复修改后状态且不再调用处理器', () => {
    let applied = 0;
    const counting = new FakeBoxAttributeHandler();
    const original = counting.apply.bind(counting);
    counting.apply = (target, attr, value) => {
      applied += 1;
      return original(target, attr, value);
    };
    const { set, box } = setup(counting);
    const command = set('n1', 'label', 'World');

    expect(command.execute()).toBe('label updated: "World"');
    expect(command.undo()).toBe('label restored: "Hi"');
    expect(box.part('label').textContent()).toBe('Hi');
    expect(command.redo()).toBe('label updated: "World"');
    expect(box.part('label').textContent()).toBe('World');
    expect(applied).toBe(1);
  });

  it('经过 CommandHistory：一次 set 一次 undo；多处修改也是一个 undo 单元', () => {
    const { set, box, document } = setup(new FakeBoxAttributeHandler());
    const before = snapshot(document);
    const history = new CommandHistory();

    history.execute(set('n1', 'fill', 'red'));
    expect(history.undo()).toBe('fill restored to (unset)');
    expect(snapshot(document)).toBe(before);
    expect(history.redo()).toBe('fill propagated to n1-rect');
    expect(box.part('rect').getAttr('fill')).toBe('red');
  });
});

describe('SetAttrCommand：事务性', () => {
  const failingAfterPartialWrite: AttributeHandler = {
    name: 'half-done',
    handles: (target, attr) => target instanceof FakeBoxShape && attr === 'fill',
    apply: (target) => {
      const box = target as FakeBoxShape;
      box.part('rect').setAttr('fill', 'half');
      box.part('label').setAttr('text', 'half');
      box.setAttr('stroke', 'half');
      throw new Error('boom');
    },
  };

  it('apply 部分修改后抛错：整棵子树回滚、原样抛出、不回落到默认路径、历史不变', () => {
    const { set, document } = setup(failingAfterPartialWrite);
    const before = snapshot(document);
    const history = new CommandHistory();

    expect(() => history.execute(set('n1', 'fill', 'red'))).toThrow('boom');
    expect(snapshot(document)).toBe(before);
    expect(() => history.undo()).toThrow('nothing to undo');
  });

  it('失败的 set 不会清空 redo 栈，也不影响此前的 undo 记录', () => {
    const { set, document } = setup(new FakeBoxAttributeHandler(), failingAfterPartialWrite);
    const history = new CommandHistory();
    history.execute(set('n1', 'label', 'A'));
    history.undo();
    // fill 同时被两个处理器命中会冲突，这里换用只有 half-done 命中的属性
    const registry = new AttributeHandlerRegistry().register(failingAfterPartialWrite);
    expect(() =>
      history.execute(new SetAttrCommand(document, 'n1', 'fill', 'x', registry)),
    ).toThrow('boom');
    expect(history.redo()).toBe('label updated: "A"');
  });

  it('属性值非法导致处理器抛错时，错误原样透出', () => {
    const { document } = setup();
    const before = snapshot(document);
    // 处理器写入非法数值；原样透出模型的校验错误。
    // box 内部 text 子部件不接受未知属性：构造一个会触发库内错误的处理器
    const strict: AttributeHandler = {
      name: 'strict',
      handles: (_t, attr) => attr === 'width',
      apply: (target, attr, value) => {
        target.setAttr(attr, value);
        return { message: 'ok', undoMessage: 'ok' };
      },
    };
    const registry = new AttributeHandlerRegistry().register(strict);
    expect(() => new SetAttrCommand(document, 'r1', 'width', 'abc', registry).execute()).toThrow(
      'invalid number: abc',
    );
    expect(snapshot(document)).toBe(before);
  });
});

describe('SetAttrCommand：冲突与契约违反', () => {
  it('两个处理器同时命中：拒绝而不是按优先级，文档不变', () => {
    const second: AttributeHandler = {
      name: 'second',
      handles: (target, attr) => target instanceof FakeBoxShape && attr === 'fill',
      apply: () => ({ message: 'second', undoMessage: 'second' }),
    };
    const { set, document } = setup(new FakeBoxAttributeHandler(), second);
    const before = snapshot(document);

    expect(() => set('n1', 'fill', 'red').execute()).toThrow(
      'attribute handler conflict: n1.fill is claimed by fake-box-attributes, second',
    );
    expect(snapshot(document)).toBe(before);
    // 只被一个处理器命中的属性不受影响
    expect(set('n1', 'label', 'x').execute()).toBe('label updated: "x"');
  });

  it('处理器改动了子树结构：状态回滚、结构尽力恢复，并报契约违反', () => {
    const adds: AttributeHandler = {
      name: 'adds-child',
      handles: (_t, attr) => attr === 'fill',
      apply: (target) => {
        (target as GroupShape).insertChild(new RectShape('stray', 0, 0, 1, 1));
        target.setAttr('stroke', 'red');
        return { message: 'ok', undoMessage: 'ok' };
      },
    };
    const removes: AttributeHandler = {
      name: 'removes-child',
      handles: (_t, attr) => attr === 'stroke-width',
      apply: (target) => {
        const group = target as GroupShape;
        group.removeChild(group.children()[0]);
        return { message: 'ok', undoMessage: 'ok' };
      },
    };
    const document = new SvgDocument();
    const group = new GroupShape('g1');
    document.insert(group, document.root);
    document.insert(new RectShape('r1', 0, 0, 1, 1), group);
    const registry = new AttributeHandlerRegistry().register(adds).register(removes);
    const before = snapshot(document);

    const add = () => new SetAttrCommand(document, 'g1', 'fill', 'x', registry).execute();
    expect(add).toThrow(ContractViolationError);
    expect(add).toThrow('contract violation: attribute handler adds-child changed the structure of g#g1');
    expect(snapshot(document)).toBe(before);

    const remove = () => new SetAttrCommand(document, 'g1', 'stroke-width', '2', registry).execute();
    expect(remove).toThrow('attribute handler removes-child changed the structure');
    expect(group.children().map((child: Shape) => child.id)).toEqual(['r1']);
  });

  it('找不到目标图形仍报 no such shape，且不会调用处理器', () => {
    const { set } = setup(new FakeBoxAttributeHandler());
    expect(() => set('zzz', 'fill', 'red').execute()).toThrow('no such shape: zzz');
  });
});
