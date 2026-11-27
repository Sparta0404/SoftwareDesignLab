import type { EditorSession } from '../app/EditorSession';
import type { ShapeFactory } from '../factory/ShapeFactory';
import type { CommandContext } from './Command';
import { CommandRegistry } from './CommandRegistry';
import type { TextOutput } from './TextOutput';
import { Tokenizer } from './Tokenizer';
import { HelpHandler } from './handler/HelpHandler';

/**
 * 执行一行 CLI 输入：注释和空行被忽略，失败命令只输出错误。
 * 它不认识任何具体命令：命令全部来自装配时注册进 CommandRegistry 的 Command。
 */
export class Cli {
  private readonly tokenizer = new Tokenizer();

  constructor(
    private readonly registry: CommandRegistry,
    private readonly context: CommandContext,
  ) {}

  /** 在已注册好的命令之后追加内核自带的 help，并组装 Cli。 */
  static create(
    registry: CommandRegistry,
    factory: ShapeFactory,
    session: EditorSession,
    output: TextOutput,
  ): Cli {
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
