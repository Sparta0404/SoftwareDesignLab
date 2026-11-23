import { GroupCommand } from '../../command/edit/GroupCommand';
import { requireArgCount } from '../Arguments';
import type { Command, CommandContext } from '../Command';

export class GroupHandler implements Command {
  readonly name = 'group';
  readonly usage = 'group <newGid> <id>…';

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 2, Number.POSITIVE_INFINITY, this.usage);
    const [groupId, ...ids] = args;
    const result = context.session.execute(
      (document) => new GroupCommand(document, groupId, ids),
    );
    context.output.write(result);
  }
}
