import { requireArgCount } from '../Arguments';
import type { Command, CommandContext } from '../Command';

export class SaveHandler implements Command {
  readonly name = 'save';
  readonly usage = 'save [file.svg]';

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 0, 1, this.usage);
    context.output.write(context.session.save(args[0]));
  }
}
