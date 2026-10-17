import { LineShape } from '../model/LineShape';
import { AbstractShapeCreator } from './AbstractShapeCreator';

export class LineCreator extends AbstractShapeCreator {
  readonly typeName = 'line';
  readonly usage = 'create line <id> <x1> <y1> <x2> <y2> [stroke]';
  protected readonly geometryKeys = ['x1', 'y1', 'x2', 'y2'];
  protected override readonly optionalStyle = 'stroke';

  protected build(id: string, n: readonly number[]): LineShape {
    return new LineShape(id, n[0], n[1], n[2], n[3]);
  }
}
