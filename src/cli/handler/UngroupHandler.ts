import { UngroupCommand } from '../../command/edit/UngroupCommand';
import { requireArgCount } from '../Arguments';
import type { CliContext } from '../CliContext';
import type { CliHandler } from './CliHandler';

export class UngroupHandler implements CliHandler {
  readonly name = 'ungroup';
  readonly usage = 'ungroup <gid>';

  execute(args: readonly string[], context: CliContext): void {
    requireArgCount(args, 1, 1, this.usage);
    const result = context.session.execute(
      (document) => new UngroupCommand(document, args[0]),
    );
    context.output.write(result);
  }
}
