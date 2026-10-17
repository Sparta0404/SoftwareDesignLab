import { UnknownShapeTypeError } from '../model/error/UnknownShapeTypeError';
import type { Shape } from '../model/Shape';
import { CircleCreator } from './CircleCreator';
import { EllipseCreator } from './EllipseCreator';
import { GroupCreator } from './GroupCreator';
import { LineCreator } from './LineCreator';
import { RectCreator } from './RectCreator';
import type { ShapeCreator } from './ShapeCreator';
import { TextCreator } from './TextCreator';

/**
 * 图形工厂：类型名 -> 创建器。
 *
 * 【待重构】这里是按名字分派的两处之一（另一处是 CLI 的 CommandRegistry）。
 * 它同时是后续 ShapeProvider 插件的注册插槽：新类型只需 register 一个创建器。
 */
export class ShapeFactory {
  private readonly creators = new Map<string, ShapeCreator>();

  /** 内置 rect / circle / ellipse / line / text / g 六种类型。 */
  static withBuiltins(): ShapeFactory {
    return new ShapeFactory()
      .register(new RectCreator())
      .register(new CircleCreator())
      .register(new EllipseCreator())
      .register(new LineCreator())
      .register(new TextCreator())
      .register(new GroupCreator());
  }

  register(creator: ShapeCreator): this {
    if (this.creators.has(creator.typeName)) {
      throw new Error(`shape type already registered: ${creator.typeName}`);
    }
    this.creators.set(creator.typeName, creator);
    return this;
  }

  typeNames(): string[] {
    return [...this.creators.keys()];
  }

  usages(): string[] {
    return [...this.creators.values()].map((creator) => creator.usage);
  }

  /** `create <type> <id> params…`。 */
  create(typeName: string, id: string, args: readonly string[]): Shape {
    return this.creatorFor(typeName).fromArgs(id, args);
  }

  /** 读入 SVG 元素（不含子元素）。 */
  createFromSvg(tagName: string, id: string, attrs: ReadonlyMap<string, string>, text: string): Shape {
    return this.creatorFor(tagName).fromSvg(id, attrs, text);
  }

  private creatorFor(typeName: string): ShapeCreator {
    const creator = this.creators.get(typeName);
    if (creator === undefined) {
      throw new UnknownShapeTypeError(typeName);
    }
    return creator;
  }
}
