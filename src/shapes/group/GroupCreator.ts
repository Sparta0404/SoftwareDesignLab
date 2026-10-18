import { AbstractShapeCreator } from '../../factory/AbstractShapeCreator';
import { GroupShape } from '../../model/shape/GroupShape';

export class GroupCreator extends AbstractShapeCreator {
  readonly typeName = 'g';
  readonly usage = 'create g <id>';
  protected readonly geometryKeys: readonly string[] = [];

  protected build(id: string): GroupShape {
    return new GroupShape(id);
  }
}
