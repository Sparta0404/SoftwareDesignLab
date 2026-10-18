import { GeometryShape } from '../../model/shape/GeometryShape';

export class LineShape extends GeometryShape {
  constructor(id: string, x1: number, y1: number, x2: number, y2: number) {
    super(
      id,
      [
        ['x1', x1],
        ['y1', y1],
        ['x2', x2],
        ['y2', y2],
      ],
      ['x1', 'x2'],
      ['y1', 'y2'],
    );
  }

  get tagName(): string {
    return 'line';
  }

  summary(): string {
    return `(${this.fmt('x1')},${this.fmt('y1')}) -> (${this.fmt('x2')},${this.fmt('y2')})`;
  }
}
