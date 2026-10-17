import { GeometryShape } from './GeometryShape';

export class RectShape extends GeometryShape {
  constructor(id: string, x: number, y: number, width: number, height: number) {
    super(
      id,
      [
        ['x', x],
        ['y', y],
        ['width', width],
        ['height', height],
      ],
      ['x'],
      ['y'],
    );
  }

  get tagName(): string {
    return 'rect';
  }

  summary(): string {
    return `x=${this.fmt('x')} y=${this.fmt('y')} w=${this.fmt('width')} h=${this.fmt('height')}${this.fillSuffix()}`;
  }
}
