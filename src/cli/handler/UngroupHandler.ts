import { UngroupCommand } from '../../command/edit/UngroupCommand';
import { requireArgCount } from '../Arguments';
import type { Command, CommandContext } from '../Command';

export class UngroupHandler implements Command {
  readonly name = 'ungroup';
  readonly usage = 'ungroup <gid>';

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 1, 1, this.usage);
    const result = context.session.execute(
      (document) => new UngroupCommand(document, args[0]),
    );
    context.output.write(result);
  }
}
