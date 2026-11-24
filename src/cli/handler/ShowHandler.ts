import { ShowRenderer } from '../../view/ShowRenderer';
import { requireArgCount } from '../Arguments';
import type { Command, CommandContext } from '../Command';

export class ShowHandler implements Command {
  readonly name = 'show';
  readonly usage = 'show <id>';

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 1, 1, this.usage);
    const text = context.session.inspect((document) => new ShowRenderer().render(document, args[0]));
    context.output.write(text);
  }
}
