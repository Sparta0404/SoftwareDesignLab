import { requireArgCount } from '../Arguments';
import type { CliContext } from '../CliContext';
import { TreeRenderer } from '../../view/TreeRenderer';
import type { CliHandler } from './CliHandler';

export class TreeHandler implements CliHandler {
  readonly name = 'tree';
  readonly usage = 'tree [id]';

  execute(args: readonly string[], context: CliContext): void {
    requireArgCount(args, 0, 1, this.usage);
    const text = context.session.inspect((document) =>
      new TreeRenderer().render(document, args[0]),
    );
    context.output.write(text);
  }
}
