import { SetAttrCommand } from '../../command/edit/SetAttrCommand';
import { requireArgCount } from '../Arguments';
import type { CliContext } from '../CliContext';
import type { CliHandler } from './CliHandler';

export class SetHandler implements CliHandler {
  readonly name = 'set';
  readonly usage = 'set <id> <attr> <value>';

  execute(args: readonly string[], context: CliContext): void {
    requireArgCount(args, 3, 3, this.usage);
    const result = context.session.execute(
      (document) => new SetAttrCommand(document, args[0], args[1], args[2]),
    );
    context.output.write(result);
  }
}
