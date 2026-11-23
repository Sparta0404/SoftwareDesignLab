import { requireArgCount } from '../Arguments';
import type { Command, CommandContext } from '../Command';

export class RedoHandler implements Command {
  readonly name = 'redo';
  readonly usage = 'redo';

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 0, 0, this.usage);
    context.output.write(context.session.redo());
  }
}
