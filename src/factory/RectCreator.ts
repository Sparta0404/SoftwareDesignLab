import { RectShape } from '../model/RectShape';
import { AbstractShapeCreator } from './AbstractShapeCreator';

export class RectCreator extends AbstractShapeCreator {
  readonly typeName = 'rect';
  readonly usage = 'create rect <id> <x> <y> <w> <h> [fill]';
  protected readonly geometryKeys = ['x', 'y', 'width', 'height'];
  protected override readonly optionalStyle = 'fill';

  protected build(id: string, n: readonly number[]): RectShape {
    return new RectShape(id, n[0], n[1], n[2], n[3]);
  }
}
