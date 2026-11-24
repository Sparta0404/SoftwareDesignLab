import { ShapeFactory } from '../factory/ShapeFactory';
import type { ShapeProvider } from '../factory/ShapeProvider';
import { CircleCreator } from './circle/CircleCreator';
import { EllipseCreator } from './ellipse/EllipseCreator';
import { GroupCreator } from './group/GroupCreator';
import { LineCreator } from './line/LineCreator';
import { RectCreator } from './rect/RectCreator';
import { TextCreator } from './text/TextCreator';

/** 内置的六种图形类型；只有内置插件装配（src/builtin）与测试会用到它。 */
export class BuiltinShapes {
  /** 按 help 中展示的顺序返回六个提供者。 */
  static providers(): ShapeProvider[] {
    return [
      new RectCreator(),
      new CircleCreator(),
      new EllipseCreator(),
      new LineCreator(),
      new TextCreator(),
      new GroupCreator(),
    ];
  }

  static createFactory(): ShapeFactory {
    return BuiltinShapes.registerInto(new ShapeFactory());
  }

  static registerInto(factory: ShapeFactory): ShapeFactory {
    for (const provider of BuiltinShapes.providers()) {
      factory.register(provider);
    }
    return factory;
  }
}
