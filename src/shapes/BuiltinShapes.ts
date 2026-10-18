import { ShapeFactory } from '../factory/ShapeFactory';
import { CircleCreator } from './circle/CircleCreator';
import { EllipseCreator } from './ellipse/EllipseCreator';
import { GroupCreator } from './group/GroupCreator';
import { LineCreator } from './line/LineCreator';
import { RectCreator } from './rect/RectCreator';
import { TextCreator } from './text/TextCreator';

/** 内置的六种图形类型；只有 Composition Root（main.ts）会用到它。 */
export class BuiltinShapes {
  static createFactory(): ShapeFactory {
    return BuiltinShapes.registerInto(new ShapeFactory());
  }

  static registerInto(factory: ShapeFactory): ShapeFactory {
    return factory
      .register(new RectCreator())
      .register(new CircleCreator())
      .register(new EllipseCreator())
      .register(new LineCreator())
      .register(new TextCreator())
      .register(new GroupCreator());
  }
}
