import { DeleteCommand } from '../../command/edit/DeleteCommand';
import { requireArgCount } from '../Arguments';
import type { CliContext } from '../CliContext';
import type { CliHandler } from './CliHandler';

export class DeleteHandler implements CliHandler {
  readonly name = 'delete';
  readonly usage = 'delete <id>';

  execute(args: readonly string[], context: CliContext): void {
    requireArgCount(args, 1, 1, this.usage);
    const result = context.session.execute(
      (document) => new DeleteCommand(document, args[0]),
    );
    context.output.write(result);
  }
}
