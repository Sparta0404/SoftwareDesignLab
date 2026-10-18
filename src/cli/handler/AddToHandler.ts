import { AddToCommand } from '../../command/edit/AddToCommand';
import { requireArgCount } from '../Arguments';
import type { CliContext } from '../CliContext';
import type { CliHandler } from './CliHandler';

export class AddToHandler implements CliHandler {
  readonly name = 'addto';
  readonly usage = 'addto <gid> <id>';

  execute(args: readonly string[], context: CliContext): void {
    requireArgCount(args, 2, 2, this.usage);
    const result = context.session.execute(
      (document) => new AddToCommand(document, args[0], args[1]),
    );
    context.output.write(result);
  }
}
