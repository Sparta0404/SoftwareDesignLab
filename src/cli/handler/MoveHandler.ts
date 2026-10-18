import { MoveCommand } from '../../command/edit/MoveCommand';
import { parseNumber, requireArgCount } from '../Arguments';
import type { CliContext } from '../CliContext';
import type { CliHandler } from './CliHandler';

export class MoveHandler implements CliHandler {
  readonly name = 'move';
  readonly usage = 'move <id> <dx> <dy>';

  execute(args: readonly string[], context: CliContext): void {
    requireArgCount(args, 3, 3, this.usage);
    const result = context.session.execute(
      (document) => new MoveCommand(document, args[0], parseNumber(args[1]), parseNumber(args[2])),
    );
    context.output.write(result);
  }
}
