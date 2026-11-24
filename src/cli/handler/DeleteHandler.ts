import { DeleteCommand } from '../../command/edit/DeleteCommand';
import { requireArgCount } from '../Arguments';
import type { Command, CommandContext } from '../Command';

export class DeleteHandler implements Command {
  readonly name = 'delete';
  readonly usage = 'delete <id>';

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 1, 1, this.usage);
    const result = context.session.execute(
      (document) => new DeleteCommand(document, args[0]),
    );
    context.output.write(result);
  }
}
