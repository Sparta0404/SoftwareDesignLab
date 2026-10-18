import type { CommandRegistry } from '../CommandRegistry';
import { requireArgCount } from '../Arguments';
import type { CliContext } from '../CliContext';
import type { CliHandler } from './CliHandler';

export class HelpHandler implements CliHandler {
  readonly name = 'help';
  readonly usage = 'help';

  constructor(private readonly registry: CommandRegistry) {}

  execute(args: readonly string[], context: CliContext): void {
    requireArgCount(args, 0, 0, this.usage);
    const commands = this.registry.usages().map((usage) => `  ${usage}`);
    const shapes = context.factory.usages().map((usage) => `  ${usage}`);
    context.output.write(['commands:', ...commands, '', 'shapes:', ...shapes].join('\n'));
  }
}
