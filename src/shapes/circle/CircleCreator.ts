import { AbstractShapeCreator } from '../../factory/AbstractShapeCreator';
import { CircleShape } from './CircleShape';

export class CircleCreator extends AbstractShapeCreator {
  readonly typeName = 'circle';
  readonly usage = 'create circle <id> <cx> <cy> <r> [fill]';
  protected readonly geometryKeys = ['cx', 'cy', 'r'];
  protected override readonly optionalStyle = 'fill';

  protected build(id: string, n: readonly number[]): CircleShape {
    return new CircleShape(id, n[0], n[1], n[2]);
  }
}
