import { parseNumber, requireArgCount } from '../Arguments';
import type { Command, CommandContext } from '../Command';

export class CanvasHandler implements Command {
  readonly name = 'canvas';
  readonly usage = 'canvas [w] [h]';

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 0, 2, this.usage);
    if (args.length === 0) {
      context.output.write(context.session.canvas());
      return;
    }
    const width = parseNumber(args[0]);
    const height = args.length === 2 ? parseNumber(args[1]) : undefined;
    context.output.write(context.session.canvas(width, height));
  }
}
