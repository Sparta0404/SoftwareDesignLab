import { InvalidArgumentsError } from '../model/error/InvalidArgumentsError';
import { Numbers } from '../model/Numbers';
import { TextShape } from '../model/TextShape';
import { AbstractShapeCreator } from './AbstractShapeCreator';

export class TextCreator extends AbstractShapeCreator {
  readonly typeName = 'text';
  readonly usage = 'create text <id> <x> <y> "content"';
  protected readonly geometryKeys = ['x', 'y'];

  /** text 的第三个参数是内容而不是样式，因此整体覆写参数解析。 */
  override fromArgs(id: string, args: readonly string[]): TextShape {
    if (args.length !== 3) {
      throw new InvalidArgumentsError(`usage: ${this.usage}`);
    }
    return new TextShape(id, Numbers.parse(args[0]), Numbers.parse(args[1]), args[2]);
  }

  protected build(id: string, n: readonly number[], text: string): TextShape {
    return new TextShape(id, n[0], n[1], text);
  }
}
