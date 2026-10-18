import { Numbers } from './Numbers';
import { Shape } from './Shape';

/**
 * 带数值几何属性的叶子图形基类（rect / circle / ellipse / line / text）。
 * 几何值按 SVG 属性名保存（保持定义顺序），子类只需声明各属性名与哪些属于 x / y 方向。
 */
export abstract class GeometryShape extends Shape {
  private readonly values = new Map<string, number>();

  protected constructor(
    id: string,
    entries: ReadonlyArray<readonly [string, number]>,
    private readonly xKeys: readonly string[],
    private readonly yKeys: readonly string[],
  ) {
    super(id);
    for (const [key, value] of entries) {
      this.values.set(key, value);
    }
  }

  protected num(key: string): number {
    return this.values.get(key) as number;
  }

  move(dx: number, dy: number): void {
    for (const key of this.xKeys) {
      this.values.set(key, this.num(key) + dx);
    }
    for (const key of this.yKeys) {
      this.values.set(key, this.num(key) + dy);
    }
  }

  scale(factor: number): void {
    for (const [key, value] of this.values) {
      this.values.set(key, value * factor);
    }
  }

  override geometryValues(): number[] {
    return [...this.values.values()];
  }

  override restoreGeometry(values: readonly number[]): void {
    let i = 0;
    for (const key of [...this.values.keys()]) {
      this.values.set(key, values[i++]);
    }
  }

  override anchor(): [number, number] {
    return [this.num(this.xKeys[0]), this.num(this.yKeys[0])];
  }

  override detailLines(): string[] {
    const lines = [this.geometryLine()];
    const style = this.styleLine();
    if (style !== undefined) {
      lines.push(style);
    }
    return lines;
  }

  protected geometryLine(): string {
    return [...this.values].map(([key, value]) => `${key}=${Numbers.format(value)}`).join(' ');
  }

  protected override ownAttrNames(): readonly string[] {
    return [...this.values.keys()];
  }

  protected override readOwnAttr(name: string): string {
    return Numbers.format(this.num(name));
  }

  protected override writeOwnAttr(name: string, value: string): void {
    this.values.set(name, Numbers.parse(value));
  }

  protected override svgGeometry(): Array<[string, string]> {
    return [...this.values].map(([key, value]) => [key, Numbers.format(value)]);
  }

  /** 带可选 fill 的摘要后缀，如 ` fill=red`。 */
  protected fillSuffix(): string {
    const fill = this.getAttr('fill');
    return fill === undefined ? '' : ` fill=${fill}`;
  }

  /** 格式化某个几何值。 */
  protected fmt(key: string): string {
    return Numbers.format(this.num(key));
  }
}
