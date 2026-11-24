import { requireArgCount } from '../Arguments';
import type { Command, CommandContext } from '../Command';

export class UndoHandler implements Command {
  readonly name = 'undo';
  readonly usage = 'undo';

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 0, 0, this.usage);
    context.output.write(context.session.undo());
  }
}
