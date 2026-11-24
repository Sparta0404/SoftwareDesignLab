import type { AttributeHandler, AttributeOutcome } from '../../src/command/attribute/AttributeHandler';
import type { ShapeBuilder, ShapeProvider } from '../../src/factory/ShapeProvider';
import { ShapeFactory } from '../../src/factory/ShapeFactory';
import { EditorError } from '../../src/model/error/EditorError';
import { GroupShape } from '../../src/model/shape/GroupShape';
import { Numbers } from '../../src/model/shape/Numbers';
import type { Shape } from '../../src/model/shape/Shape';
import { BuiltinShapes } from '../../src/shapes/BuiltinShapes';

/**
 * 测试用的假复合图形：证明内核钩子足以支撑 box 这类“内部结构归插件所有”的图形，
 * 而不需要真正的 box 插件。它只依赖内核公开的抽象。
 */
export class FakeBoxShape extends GroupShape {
  override get displayLabel(): string {
    return `box#${this.id}`;
  }

  override isComposite(): boolean {
    return true;
  }

  override creationNote(): string {
    return `(g#${this.id} + rect#${this.id}-rect + text#${this.id}-label)`;
  }

  override attributes(): Array<[string, string]> {
    const [first, ...rest] = super.attributes();
    return [first, ['data-kind', 'box'], ...rest];
  }

  override removeChild(child: Shape): number {
    if (child.id === `${this.id}-rect` || child.id === `${this.id}-label`) {
      throw new EditorError(`cannot detach ${child.id} from ${this.displayLabel}`);
    }
    return super.removeChild(child);
  }

  part(suffix: 'rect' | 'label'): Shape {
    return this.children().find((child) => child.id === `${this.id}-${suffix}`) as Shape;
  }
}

export class FakeBoxProvider implements ShapeProvider {
  readonly typeName = 'box';
  readonly usage = 'create box <id> <x> <y> <w> <h> "<title>"';

  fromArgs(id: string, args: readonly string[], builder: ShapeBuilder): Shape {
    if (args.length !== 5) throw new EditorError(`usage: ${this.usage}`);
    const [x, y, w, h] = args.slice(0, 4).map((arg) => Numbers.parse(arg));
    const box = new FakeBoxShape(id);
    box.insertChild(builder.create('rect', `${id}-rect`, [x, y, w, h].map(String)));
    box.insertChild(
      builder.create('text', `${id}-label`, [String(x + 20), String(y + h / 2 + 5), args[4]]),
    );
    return box;
  }

  matches(tag: string, attrs: ReadonlyMap<string, string>): boolean {
    return tag === 'g' && attrs.get('data-kind') === 'box';
  }

  fromSvgTree(
    id: string,
    _attrs: ReadonlyMap<string, string>,
    _text: string,
    children: readonly Shape[],
  ): Shape {
    const ok =
      children.length === 2 &&
      children[0].id === `${id}-rect` &&
      children[0].tagName === 'rect' &&
      children[1].id === `${id}-label` &&
      children[1].tagName === 'text';
    if (!ok) throw new EditorError(`invalid box: ${id}`);
    const box = new FakeBoxShape(id);
    children.forEach((child) => box.insertChild(child));
    return box;
  }
}

export function factoryWithBox(): ShapeFactory {
  return BuiltinShapes.createFactory().register(new FakeBoxProvider());
}

/** 把 fill 转发到 rect 子部件、把 label 改写到 text 子部件的属性处理器。 */
export class FakeBoxAttributeHandler implements AttributeHandler {
  readonly name = 'fake-box-attributes';

  handles(target: Shape, attr: string): boolean {
    return target instanceof FakeBoxShape && (attr === 'fill' || attr === 'label');
  }

  apply(target: Shape, attr: string, value: string): AttributeOutcome {
    const box = target as FakeBoxShape;
    if (attr === 'fill') {
      const rect = box.part('rect');
      const old = rect.getAttr('fill');
      rect.setAttr('fill', value);
      return {
        message: `fill propagated to ${rect.id}`,
        undoMessage: `fill restored to ${old ?? '(unset)'}`,
      };
    }
    const text = box.part('label');
    const old = text.getAttr('text');
    text.setAttr('text', value);
    return { message: `label updated: "${value}"`, undoMessage: `label restored: "${old}"` };
  }
}
