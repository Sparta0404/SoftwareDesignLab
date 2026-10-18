import type { EditorSession } from '../app/EditorSession';
import type { ShapeFactory } from '../factory/ShapeFactory';
import type { CliContext } from './CliContext';
import { CommandRegistry } from './CommandRegistry';
import type { TextOutput } from './TextOutput';
import { Tokenizer } from './Tokenizer';
import { AddToHandler } from './handler/AddToHandler';
import { CanvasHandler } from './handler/CanvasHandler';
import { CreateHandler } from './handler/CreateHandler';
import { DeleteHandler } from './handler/DeleteHandler';
import { GroupHandler } from './handler/GroupHandler';
import { HelpHandler } from './handler/HelpHandler';
import { InitHandler } from './handler/InitHandler';
import { MoveHandler } from './handler/MoveHandler';
import { ReadHandler } from './handler/ReadHandler';
import { RedoHandler } from './handler/RedoHandler';
import { SaveHandler } from './handler/SaveHandler';
import { ScaleHandler } from './handler/ScaleHandler';
import { SetHandler } from './handler/SetHandler';
import { ShowHandler } from './handler/ShowHandler';
import { TreeHandler } from './handler/TreeHandler';
import { UndoHandler } from './handler/UndoHandler';
import { UngroupHandler } from './handler/UngroupHandler';
import { ZOrderHandler } from './handler/ZOrderHandler';

/** 执行一行 CLI 输入：注释和空行被忽略，失败命令只输出错误。 */
export class Cli {
  private readonly tokenizer = new Tokenizer();

  constructor(
    private readonly registry: CommandRegistry,
    private readonly context: CliContext,
  ) {}

  static createDefault(session: EditorSession, factory: ShapeFactory, output: TextOutput): Cli {
    const registry = new CommandRegistry();
    registry
      .register(new InitHandler())
      .register(new ReadHandler())
      .register(new SaveHandler())
      .register(new CanvasHandler())
      .register(new CreateHandler())
      .register(new DeleteHandler())
      .register(new MoveHandler())
      .register(new ScaleHandler())
      .register(new SetHandler())
      .register(new GroupHandler())
      .register(new UngroupHandler())
      .register(new AddToHandler())
      .register(new ZOrderHandler('front'))
      .register(new ZOrderHandler('back'))
      .register(new TreeHandler())
      .register(new ShowHandler())
      .register(new UndoHandler())
      .register(new RedoHandler());
    registry.register(new HelpHandler(registry));
    return new Cli(registry, { session, factory, output });
  }

  executeLine(line: string): void {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) return;
    try {
      const tokens = this.tokenizer.tokenize(trimmed);
      if (tokens.length === 0) return;
      const [name, ...args] = tokens;
      this.registry.dispatch(name, args, this.context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.context.output.writeError(message);
    }
  }
}
