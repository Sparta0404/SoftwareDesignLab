import type { EditorSession } from '../app/EditorSession';
import type { AttributeHandlerRegistry } from '../command/attribute/AttributeHandlerRegistry';
import type { ShapeFactory } from '../factory/ShapeFactory';
import type { TreeDecoratorRegistry } from '../view/TreeDecoratorRegistry';
import type { Command, CommandContext } from './Command';
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

/** 装配 CLI 时可以接入的扩展；全部可省略，省略时就是 Phase 1 的行为。 */
export interface CliExtensions {
  /** 追加在内置命令之后、help 之前注册；与内置命令重名会在装配期报错。 */
  readonly commands?: readonly Command[];
  /** set 使用的属性处理器。 */
  readonly attributeHandlers?: AttributeHandlerRegistry;
  /** 	ree 使用的行尾装饰器。 */
  readonly treeDecorators?: TreeDecoratorRegistry;
}

/** 执行一行 CLI 输入：注释和空行被忽略，失败命令只输出错误。 */
export class Cli {
  private readonly tokenizer = new Tokenizer();

  constructor(
    private readonly registry: CommandRegistry,
    private readonly context: CommandContext,
  ) {}

  static createDefault(
    session: EditorSession,
    factory: ShapeFactory,
    output: TextOutput,
    extensions: CliExtensions = {},
  ): Cli {
    const registry = new CommandRegistry();
    registry
      .register(new InitHandler())
      .register(new ReadHandler())
      .register(new SaveHandler())
      .register(new CanvasHandler())
      .register(new CreateHandler(factory))
      .register(new DeleteHandler())
      .register(new MoveHandler())
      .register(new ScaleHandler())
      .register(new SetHandler(extensions.attributeHandlers))
      .register(new GroupHandler())
      .register(new UngroupHandler())
      .register(new AddToHandler())
      .register(new ZOrderHandler('front'))
      .register(new ZOrderHandler('back'))
      .register(new TreeHandler(extensions.treeDecorators))
      .register(new ShowHandler())
      .register(new UndoHandler())
      .register(new RedoHandler());
    for (const command of extensions.commands ?? []) {
      registry.register(command);
    }
    registry.register(new HelpHandler(registry, factory));
    return new Cli(registry, { session, output });
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
