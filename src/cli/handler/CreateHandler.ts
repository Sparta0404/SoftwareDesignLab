import { CreateCommand } from '../../command/edit/CreateCommand';
import { InvalidArgumentsError } from '../../factory/error/InvalidArgumentsError';
import type { ShapeFactory } from '../../factory/ShapeFactory';
import type { Command, CommandContext } from '../Command';

export class CreateHandler implements Command {
  readonly name = 'create';
  readonly usage = 'create <type> <id> [params…] [in <containerId>]';

  constructor(private readonly factory: ShapeFactory) {}

  execute(args: readonly string[], context: CommandContext): void {
    if (args.length < 2) {
      throw new InvalidArgumentsError(`usage: ${this.usage}`);
    }
    const [type, id, ...rest] = args;
    const { params, containerId } = this.splitIn(rest);
    const result = context.session.execute((document) => {
      const shape = this.factory.create(type, id, params);
      const parent =
        containerId === undefined ? document.root : document.findContainer(containerId);
      return new CreateCommand(document, shape, parent);
    });
    context.output.write(result);
  }

  private splitIn(args: readonly string[]): { params: string[]; containerId?: string } {
    const marker = args.lastIndexOf('in');
    if (marker < 0) return { params: [...args] };
    if (marker !== args.length - 2) {
      throw new InvalidArgumentsError(`usage: ${this.usage}`);
    }
    return { params: args.slice(0, marker), containerId: args[marker + 1] };
  }
}
