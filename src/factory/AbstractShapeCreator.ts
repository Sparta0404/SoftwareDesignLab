import { InvalidArgumentsError } from '../model/error/InvalidArgumentsError';
import { Numbers } from '../model/Numbers';
import { Shape } from '../model/Shape';
import type { ShapeCreator } from './ShapeCreator';

/**
 * 创建器的模板基类：约定参数 = 若干数值几何参数 + 可选的一个样式参数。
 * 子类只需声明几何属性名并实现 build。
 */
export abstract class AbstractShapeCreator implements ShapeCreator {
  abstract readonly typeName: string;
  abstract readonly usage: string;

  /** 按 `create` 参数顺序排列的几何属性名，同时也是对应的 SVG 属性名。 */
  protected abstract readonly geometryKeys: readonly string[];

  /** 末尾可选参数对应的样式属性（rect 为 fill，line 为 stroke）；没有则为 undefined。 */
  protected readonly optionalStyle: string | undefined = undefined;

  protected abstract build(id: string, numbers: readonly number[], text: string): Shape;

  fromArgs(id: string, args: readonly string[]): Shape {
    const count = this.geometryKeys.length;
    const maxArgs = count + (this.optionalStyle === undefined ? 0 : 1);
    if (args.length < count || args.length > maxArgs) {
      throw new InvalidArgumentsError(`usage: ${this.usage}`);
    }
    const shape = this.build(id, args.slice(0, count).map((arg) => Numbers.parse(arg)), '');
    if (this.optionalStyle !== undefined && args.length > count) {
      shape.setAttr(this.optionalStyle, args[count]);
    }
    return shape;
  }

  fromSvg(id: string, attrs: ReadonlyMap<string, string>, text: string): Shape {
    const numbers = this.geometryKeys.map((key) => {
      const raw = attrs.get(key);
      return raw === undefined ? 0 : Numbers.parse(raw);
    });
    const shape = this.build(id, numbers, text);
    for (const [name, value] of attrs) {
      if (name === 'id' || this.geometryKeys.includes(name)) {
        continue;
      }
      if (Shape.STYLE_ATTRS.includes(name)) {
        shape.setAttr(name, value);
      } else {
        shape.setExtra(name, value);
      }
    }
    return shape;
  }
}
