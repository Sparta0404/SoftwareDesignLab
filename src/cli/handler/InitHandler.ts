import { parseNumber, requireArgCount } from '../Arguments';
import type { Command, CommandContext } from '../Command';

export class InitHandler implements Command {
  readonly name = 'init';
  readonly usage = 'init [w] [h]';

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 0, 2, this.usage);
    const width = args.length > 0 ? parseNumber(args[0]) : undefined;
    const height = args.length > 1 ? parseNumber(args[1]) : undefined;
    context.output.write(context.session.init(width, height));
  }
}
