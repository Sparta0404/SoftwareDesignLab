import { requireArgCount } from '../Arguments';
import type { CliContext } from '../CliContext';
import type { CliHandler } from './CliHandler';

export class SaveHandler implements CliHandler {
  readonly name = 'save';
  readonly usage = 'save [file.svg]';

  execute(args: readonly string[], context: CliContext): void {
    requireArgCount(args, 0, 1, this.usage);
    context.output.write(context.session.save(args[0]));
  }
}
