import { Shape } from './Shape';

/** 容器图形 `<g>`（Composite 模式中的 Composite）。 */
export class GroupShape extends Shape {
  private readonly items: Shape[] = [];

  get tagName(): string {
    return 'g';
  }

  override children(): readonly Shape[] {
    return this.items;
  }

  override isContainer(): boolean {
    return true;
  }

  override insertChild(child: Shape, index: number = this.items.length): void {
    if (child.parent !== null) {
      throw new Error(`shape already attached: ${child.id}`);
    }
    const at = Math.max(0, Math.min(index, this.items.length));
    this.items.splice(at, 0, child);
    child.attachTo(this);
  }

  override removeChild(child: Shape): number {
    const index = this.items.indexOf(child);
    if (index < 0) {
      throw new Error(`not a child of ${this.id}: ${child.id}`);
    }
    this.items.splice(index, 1);
    child.attachTo(null);
    return index;
  }

  move(dx: number, dy: number): void {
    for (const child of this.items) {
      child.move(dx, dy);
    }
  }

  scale(factor: number): void {
    for (const child of this.items) {
      child.scale(factor);
    }
  }

  summary(): string {
    return '';
  }

  detailLines(): string[] {
    const lines = [`children=${this.items.length}`];
    const style = this.styleLine();
    if (style !== undefined) {
      lines.push(style);
    }
    return lines;
  }
}
