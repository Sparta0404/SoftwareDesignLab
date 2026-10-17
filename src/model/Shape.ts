import { NotContainerError } from './error/NotContainerError';
import { UnknownAttributeError } from './error/UnknownAttributeError';

/**
 * 所有图形的抽象基类（Composite 模式中的 Component）。
 *
 * 容器与叶子共用同一套接口：move / scale / setAttr 等对 `<g>` 与叶子一视同仁。
 * 图形还“自描述”：序列化与 tree/show 显示所需的信息都由图形自己提供，
 * 外部（io、view）只通过这些接口读取，不认识任何具体子类。
 */
export abstract class Shape {
  /** `set` 命令对所有图形都开放的样式属性。 */
  static readonly STYLE_ATTRS: readonly string[] = ['fill', 'stroke', 'stroke-width'];

  private parentShape: Shape | null = null;
  private readonly style = new Map<string, string>();
  private readonly extras = new Map<string, string>();

  constructor(readonly id: string) {}

  // ---------- 身份与结构 ----------

  /** SVG 标签名，如 rect / circle / g。 */
  abstract get tagName(): string;

  /** 命令回显与 tree 中使用的简短标识，如 `rect#r1`。 */
  get label(): string {
    return `${this.tagName}#${this.id}`;
  }

  get parent(): Shape | null {
    return this.parentShape;
  }

  /** 仅供容器在插入 / 摘除子节点时调用，外部不要直接使用。 */
  attachTo(parent: Shape | null): void {
    this.parentShape = parent;
  }

  /** 子节点列表；叶子返回空列表，使容器与叶子可被统一遍历。 */
  children(): readonly Shape[] {
    return [];
  }

  isContainer(): boolean {
    return false;
  }

  /** 复合图形（内部结构由插件所有，不可 ungroup）。 */
  isComposite(): boolean {
    return false;
  }

  /** 在子节点列表中的下标；找不到返回 -1。 */
  indexOf(child: Shape): number {
    return this.children().indexOf(child);
  }

  /** 把子节点插到指定下标（默认末尾）。叶子不是容器，抛错。 */
  insertChild(_child: Shape, _index?: number): void {
    throw new NotContainerError(this.id);
  }

  /** 摘除子节点并返回它原来的下标。叶子不是容器，抛错。 */
  removeChild(_child: Shape): number {
    throw new NotContainerError(this.id);
  }

  /** 先序遍历：自身在前，然后依次是各子孙。 */
  walk(): Shape[] {
    const result: Shape[] = [this];
    for (const child of this.children()) {
      result.push(...child.walk());
    }
    return result;
  }

  isDescendantOf(ancestor: Shape): boolean {
    for (let p = this.parentShape; p !== null; p = p.parentShape) {
      if (p === ancestor) {
        return true;
      }
    }
    return false;
  }

  // ---------- 统一操作 ----------

  abstract move(dx: number, dy: number): void;

  /** 等比缩放：因子同乘到全部几何属性（位置与尺寸）；容器递归到子孙。 */
  abstract scale(factor: number): void;

  /** 本节点自身几何值的快照（不含子孙），用于撤销 scale。 */
  geometryValues(): number[] {
    return [];
  }

  restoreGeometry(_values: readonly number[]): void {}

  /** 定位点，用于“moved to (x,y)”一类的回显；容器没有定位点。 */
  anchor(): [number, number] | undefined {
    return undefined;
  }

  // ---------- 属性（set 命令） ----------

  /** 可被 `set` 的全部属性名（白名单）。 */
  attrNames(): string[] {
    return [...this.ownAttrNames(), ...Shape.STYLE_ATTRS];
  }

  /** 读取属性；未设置的样式属性返回 undefined。 */
  getAttr(name: string): string | undefined {
    if (Shape.STYLE_ATTRS.includes(name)) {
      return this.style.get(name);
    }
    if (this.ownAttrNames().includes(name)) {
      return this.readOwnAttr(name);
    }
    throw new UnknownAttributeError(name);
  }

  /** 设置属性；值非法时抛错且不改变状态。 */
  setAttr(name: string, value: string): void {
    if (Shape.STYLE_ATTRS.includes(name)) {
      this.style.set(name, value);
    } else if (this.ownAttrNames().includes(name)) {
      this.writeOwnAttr(name, value);
    } else {
      throw new UnknownAttributeError(name);
    }
  }

  /** 清除样式属性（用于撤销“从无到有”的 set）。 */
  unsetAttr(name: string): void {
    if (!Shape.STYLE_ATTRS.includes(name)) {
      throw new UnknownAttributeError(name);
    }
    this.style.delete(name);
  }

  /** 回显用的 `name=value` 形式；字符串类属性可覆写以加引号。 */
  attrDisplay(name: string): string {
    return `${name}=${this.getAttr(name) ?? '(unset)'}`;
  }

  /** 保存读入 SVG 时无法识别的属性，序列化时原样写回（保证 round-trip）。 */
  setExtra(name: string, value: string): void {
    this.extras.set(name, value);
  }

  // ---------- 自描述：供序列化 ----------

  /** 按序输出的 SVG 属性键值对（id 在最前）。 */
  attributes(): Array<[string, string]> {
    const result: Array<[string, string]> = [['id', this.id], ...this.svgGeometry()];
    for (const name of Shape.STYLE_ATTRS) {
      const value = this.style.get(name);
      if (value !== undefined) {
        result.push([name, value]);
      }
    }
    for (const [name, value] of this.extras) {
      result.push([name, value]);
    }
    return result;
  }

  /** `<text>` 的文本内容；其余类型返回 undefined。 */
  textContent(): string | undefined {
    return undefined;
  }

  // ---------- 自描述：供显示 ----------

  /** tree 中 `tag#id` 之后的属性摘要；没有可显示内容时返回空串。 */
  abstract summary(): string;

  /** show 输出的属性明细行。 */
  abstract detailLines(): string[];

  // ---------- 子类扩展点 ----------

  /** 样式之外、本类型自有的可 set 属性名。 */
  protected ownAttrNames(): readonly string[] {
    return [];
  }

  protected readOwnAttr(_name: string): string {
    throw new UnknownAttributeError(_name);
  }

  protected writeOwnAttr(name: string, _value: string): void {
    throw new UnknownAttributeError(name);
  }

  /** 本类型几何属性的 SVG 键值对。 */
  protected svgGeometry(): Array<[string, string]> {
    return [];
  }

  /** 已设置的样式属性拼成一行，如 `fill=red stroke=black`；都没设置返回 undefined。 */
  protected styleLine(): string | undefined {
    const parts: string[] = [];
    for (const name of Shape.STYLE_ATTRS) {
      const value = this.style.get(name);
      if (value !== undefined) {
        parts.push(`${name}=${value}`);
      }
    }
    return parts.length > 0 ? parts.join(' ') : undefined;
  }
}
