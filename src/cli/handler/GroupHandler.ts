import { GroupCommand } from '../../command/edit/GroupCommand';
import { requireArgCount } from '../Arguments';
import type { CliContext } from '../CliContext';
import type { CliHandler } from './CliHandler';

export class GroupHandler implements CliHandler {
  readonly name = 'group';
  readonly usage = 'group <newGid> <id>…';

  execute(args: readonly string[], context: CliContext): void {
    requireArgCount(args, 2, Number.POSITIVE_INFINITY, this.usage);
    const [groupId, ...ids] = args;
    const result = context.session.execute(
      (document) => new GroupCommand(document, groupId, ids),
    );
    context.output.write(result);
  }
}
