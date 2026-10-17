import { GeometryShape } from './GeometryShape';

export class TextShape extends GeometryShape {
  private content: string;

  constructor(id: string, x: number, y: number, content: string) {
    super(
      id,
      [
        ['x', x],
        ['y', y],
      ],
      ['x'],
      ['y'],
    );
    this.content = content;
  }

  get tagName(): string {
    return 'text';
  }

  override textContent(): string {
    return this.content;
  }

  override attrDisplay(name: string): string {
    return name === 'text' ? `text="${this.content}"` : super.attrDisplay(name);
  }

  summary(): string {
    return `(${this.fmt('x')},${this.fmt('y')}) "${this.content}"`;
  }

  override detailLines(): string[] {
    const lines = [this.geometryLine(), `text="${this.content}"`];
    const style = this.styleLine();
    if (style !== undefined) {
      lines.push(style);
    }
    return lines;
  }

  protected override ownAttrNames(): readonly string[] {
    return [...super.ownAttrNames(), 'text'];
  }

  protected override readOwnAttr(name: string): string {
    return name === 'text' ? this.content : super.readOwnAttr(name);
  }

  protected override writeOwnAttr(name: string, value: string): void {
    if (name === 'text') {
      this.content = value;
    } else {
      super.writeOwnAttr(name, value);
    }
  }
}
