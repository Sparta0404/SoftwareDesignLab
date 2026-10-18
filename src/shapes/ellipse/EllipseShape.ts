import { GeometryShape } from '../../model/shape/GeometryShape';

export class EllipseShape extends GeometryShape {
  constructor(id: string, cx: number, cy: number, rx: number, ry: number) {
    super(
      id,
      [
        ['cx', cx],
        ['cy', cy],
        ['rx', rx],
        ['ry', ry],
      ],
      ['cx'],
      ['cy'],
    );
  }

  get tagName(): string {
    return 'ellipse';
  }

  summary(): string {
    return `cx=${this.fmt('cx')} cy=${this.fmt('cy')} rx=${this.fmt('rx')} ry=${this.fmt('ry')}${this.fillSuffix()}`;
  }
}
