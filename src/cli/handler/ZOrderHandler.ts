import { ZOrderCommand, type ZOrderDirection } from '../../command/edit/ZOrderCommand';
import { requireArgCount } from '../Arguments';
import type { Command, CommandContext } from '../Command';

export class ZOrderHandler implements Command {
  readonly usage: string;

  constructor(readonly name: ZOrderDirection) {
    this.usage = `${name} <id>`;
  }

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 1, 1, this.usage);
    const result = context.session.execute(
      (document) => new ZOrderCommand(document, args[0], this.name),
    );
    context.output.write(result);
  }
}
