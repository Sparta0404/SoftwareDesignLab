import { ContractViolationError } from '../model/error/ContractViolationError';
import type { Shape } from '../model/shape/Shape';
import { UnknownShapeTypeError } from './error/UnknownShapeTypeError';
import type { ShapeBuilder, ShapeProvider } from './ShapeProvider';

/**
 * 图形工厂：类型名 -> 提供者的注册表，本身不认识任何具体图形类型。
 * 它同时是 ShapeProvider 插件的注册插槽：新类型只需 register 一个提供者。
 */
export class ShapeFactory implements ShapeBuilder {
  private readonly providers = new Map<string, ShapeProvider>();

  register(provider: ShapeProvider): this {
    if (this.providers.has(provider.typeName)) {
      throw new Error(`shape type already registered: ${provider.typeName}`);
    }
    this.providers.set(provider.typeName, provider);
    return this;
  }

  typeNames(): string[] {
    return [...this.providers.keys()];
  }

  usages(): string[] {
    return [...this.providers.values()].map((provider) => provider.usage);
  }

  /** `create <type> <id> params…`。 */
  create(typeName: string, id: string, args: readonly string[]): Shape {
    const provider = this.providerFor(typeName);
    const shape = provider.fromArgs(id, args, this);
    this.checkId(provider, shape, id);
    return shape;
  }

  /** 读入一个没有子元素的 SVG 元素。 */
  createFromSvg(
    tagName: string,
    id: string,
    attrs: ReadonlyMap<string, string>,
    text: string,
  ): Shape {
    return this.createFromSvgTree(tagName, id, attrs, text, []);
  }

  /** 读入一个 SVG 元素及其已构造好的子树，由匹配的提供者组装。 */
  createFromSvgTree(
    tagName: string,
    id: string,
    attrs: ReadonlyMap<string, string>,
    text: string,
    children: readonly Shape[],
  ): Shape {
    const provider = this.providerForSvg(tagName, attrs);
    const shape = provider.fromSvgTree(id, attrs, text, children, this);
    this.checkId(provider, shape, id);
    if (shape.tagName !== tagName) {
      throw new ContractViolationError(
        `shape provider ${provider.typeName} returned <${shape.tagName}> for <${tagName}>`,
      );
    }
    return shape;
  }

  private providerFor(typeName: string): ShapeProvider {
    const provider = this.providers.get(typeName);
    if (provider === undefined) {
      throw new UnknownShapeTypeError(typeName);
    }
    return provider;
  }

  /** 后注册者优先；没有任何提供者匹配时按未知类型报错。 */
  private providerForSvg(tagName: string, attrs: ReadonlyMap<string, string>): ShapeProvider {
    const candidates = [...this.providers.values()].reverse();
    const provider = candidates.find((candidate) => candidate.matches(tagName, attrs));
    if (provider === undefined) {
      throw new UnknownShapeTypeError(tagName);
    }
    return provider;
  }

  private checkId(provider: ShapeProvider, shape: Shape, id: string): void {
    if (shape.id !== id) {
      throw new ContractViolationError(
        `shape provider ${provider.typeName} returned id ${shape.id}, expected ${id}`,
      );
    }
  }
}
