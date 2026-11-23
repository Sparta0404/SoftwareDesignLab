import { requireArgCount } from '../Arguments';
import type { Command, CommandContext } from '../Command';

export class ReadHandler implements Command {
  readonly name = 'read';
  readonly usage = 'read <file.svg>';

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 1, 1, this.usage);
    context.output.write(context.session.read(args[0]));
  }
}
