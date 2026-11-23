import { requireArgCount } from '../Arguments';
import type { TreeDecoratorRegistry } from '../../view/TreeDecoratorRegistry';
import { TreeRenderer } from '../../view/TreeRenderer';
import type { Command, CommandContext } from '../Command';

export class TreeHandler implements Command {
  readonly name = 'tree';
  readonly usage = 'tree [id]';

  constructor(private readonly decorators?: TreeDecoratorRegistry) {}

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 0, 1, this.usage);
    const text = context.session.inspect((document) =>
      new TreeRenderer(this.decorators?.all()).render(document, args[0]),
    );
    context.output.write(text);
  }
}
