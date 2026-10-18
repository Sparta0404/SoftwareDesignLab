import { parseNumber, requireArgCount } from '../Arguments';
import type { CliContext } from '../CliContext';
import type { CliHandler } from './CliHandler';

export class InitHandler implements CliHandler {
  readonly name = 'init';
  readonly usage = 'init [w] [h]';

  execute(args: readonly string[], context: CliContext): void {
    requireArgCount(args, 0, 2, this.usage);
    const width = args.length > 0 ? parseNumber(args[0]) : undefined;
    const height = args.length > 1 ? parseNumber(args[1]) : undefined;
    context.output.write(context.session.init(width, height));
  }
}
