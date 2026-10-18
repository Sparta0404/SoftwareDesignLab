import { requireArgCount } from '../Arguments';
import type { CliContext } from '../CliContext';
import type { CliHandler } from './CliHandler';

export class UndoHandler implements CliHandler {
  readonly name = 'undo';
  readonly usage = 'undo';

  execute(args: readonly string[], context: CliContext): void {
    requireArgCount(args, 0, 0, this.usage);
    context.output.write(context.session.undo());
  }
}
