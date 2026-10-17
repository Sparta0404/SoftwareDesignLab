import { EllipseShape } from '../model/EllipseShape';
import { AbstractShapeCreator } from './AbstractShapeCreator';

export class EllipseCreator extends AbstractShapeCreator {
  readonly typeName = 'ellipse';
  readonly usage = 'create ellipse <id> <cx> <cy> <rx> <ry> [fill]';
  protected readonly geometryKeys = ['cx', 'cy', 'rx', 'ry'];
  protected override readonly optionalStyle = 'fill';

  protected build(id: string, n: readonly number[]): EllipseShape {
    return new EllipseShape(id, n[0], n[1], n[2], n[3]);
  }
}
