import { requireArgCount } from '../Arguments';
import type { CliContext } from '../CliContext';
import type { CliHandler } from './CliHandler';

export class ReadHandler implements CliHandler {
  readonly name = 'read';
  readonly usage = 'read <file.svg>';

  execute(args: readonly string[], context: CliContext): void {
    requireArgCount(args, 1, 1, this.usage);
    context.output.write(context.session.read(args[0]));
  }
}
