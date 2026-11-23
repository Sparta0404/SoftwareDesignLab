import { ScaleCommand } from '../../command/edit/ScaleCommand';
import { parseNumber, requireArgCount } from '../Arguments';
import type { Command, CommandContext } from '../Command';

export class ScaleHandler implements Command {
  readonly name = 'scale';
  readonly usage = 'scale <id> <factor>';

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 2, 2, this.usage);
    const result = context.session.execute(
      (document) => new ScaleCommand(document, args[0], parseNumber(args[1])),
    );
    context.output.write(result);
  }
}
