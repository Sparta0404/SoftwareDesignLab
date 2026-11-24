import { AddToCommand } from '../../command/edit/AddToCommand';
import { requireArgCount } from '../Arguments';
import type { Command, CommandContext } from '../Command';

export class AddToHandler implements Command {
  readonly name = 'addto';
  readonly usage = 'addto <gid> <id>';

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 2, 2, this.usage);
    const result = context.session.execute(
      (document) => new AddToCommand(document, args[0], args[1]),
    );
    context.output.write(result);
  }
}
