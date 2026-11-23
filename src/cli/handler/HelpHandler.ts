import type { ShapeFactory } from '../../factory/ShapeFactory';
import type { CommandRegistry } from '../CommandRegistry';
import { requireArgCount } from '../Arguments';
import type { Command, CommandContext } from '../Command';

export class HelpHandler implements Command {
  readonly name = 'help';
  readonly usage = 'help';

  constructor(
    private readonly registry: CommandRegistry,
    private readonly factory: ShapeFactory,
  ) {}

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 0, 0, this.usage);
    const commands = this.registry.usages().map((usage) => `  ${usage}`);
    const shapes = this.factory.usages().map((usage) => `  ${usage}`);
    context.output.write(['commands:', ...commands, '', 'shapes:', ...shapes].join('\n'));
  }
}
