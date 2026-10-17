import { GroupShape } from '../model/GroupShape';
import { AbstractShapeCreator } from './AbstractShapeCreator';

export class GroupCreator extends AbstractShapeCreator {
  readonly typeName = 'g';
  readonly usage = 'create g <id>';
  protected readonly geometryKeys: readonly string[] = [];

  protected build(id: string): GroupShape {
    return new GroupShape(id);
  }
}
