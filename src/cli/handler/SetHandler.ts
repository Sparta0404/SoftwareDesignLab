import type { AttributeHandlerRegistry } from '../../command/attribute/AttributeHandlerRegistry';
import { SetAttrCommand } from '../../command/edit/SetAttrCommand';
import { requireArgCount } from '../Arguments';
import type { Command, CommandContext } from '../Command';

export class SetHandler implements Command {
  readonly name = 'set';
  readonly usage = 'set <id> <attr> <value>';

  constructor(private readonly attributeHandlers?: AttributeHandlerRegistry) {}

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 3, 3, this.usage);
    const result = context.session.execute(
      (document) => new SetAttrCommand(document, args[0], args[1], args[2], this.attributeHandlers),
    );
    context.output.write(result);
  }
}
