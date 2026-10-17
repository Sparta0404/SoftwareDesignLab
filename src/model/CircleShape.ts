import { GeometryShape } from './GeometryShape';

export class CircleShape extends GeometryShape {
  constructor(id: string, cx: number, cy: number, r: number) {
    super(
      id,
      [
        ['cx', cx],
        ['cy', cy],
        ['r', r],
      ],
      ['cx'],
      ['cy'],
    );
  }

  get tagName(): string {
    return 'circle';
  }

  summary(): string {
    return `cx=${this.fmt('cx')} cy=${this.fmt('cy')} r=${this.fmt('r')}${this.fillSuffix()}`;
  }
}
