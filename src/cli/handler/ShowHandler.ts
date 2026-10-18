import { ShowRenderer } from '../../view/ShowRenderer';
import { requireArgCount } from '../Arguments';
import type { CliContext } from '../CliContext';
import type { CliHandler } from './CliHandler';

export class ShowHandler implements CliHandler {
  readonly name = 'show';
  readonly usage = 'show <id>';

  execute(args: readonly string[], context: CliContext): void {
    requireArgCount(args, 1, 1, this.usage);
    const text = context.session.inspect((document) => new ShowRenderer().render(document, args[0]));
    context.output.write(text);
  }
}
