import type { TreeDecorator } from './TreeDecorator';

/** 树装饰器的注册表；注册顺序就是标签的拼接顺序。 */
export class TreeDecoratorRegistry {
  private readonly decorators = new Map<string, TreeDecorator>();

  register(decorator: TreeDecorator): this {
    if (this.decorators.has(decorator.name)) {
      throw new Error(`tree decorator already registered: ${decorator.name}`);
    }
    this.decorators.set(decorator.name, decorator);
    return this;
  }

  all(): TreeDecorator[] {
    return [...this.decorators.values()];
  }
}
