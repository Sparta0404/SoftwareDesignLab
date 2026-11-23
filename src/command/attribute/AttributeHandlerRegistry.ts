import type { Shape } from '../../model/shape/Shape';
import type { AttributeHandler } from './AttributeHandler';

/** 属性处理器的注册表，按注册顺序保存。 */
export class AttributeHandlerRegistry {
  private readonly handlers = new Map<string, AttributeHandler>();

  register(handler: AttributeHandler): this {
    if (this.handlers.has(handler.name)) {
      throw new Error(`attribute handler already registered: ${handler.name}`);
    }
    this.handlers.set(handler.name, handler);
    return this;
  }

  all(): AttributeHandler[] {
    return [...this.handlers.values()];
  }

  /** 声明自己处理 (target, attr) 的全部处理器，按注册顺序。 */
  matching(target: Shape, attr: string): AttributeHandler[] {
    return this.all().filter((handler) => handler.handles(target, attr));
  }
}
