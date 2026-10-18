import type { CliHandler } from './handler/CliHandler';
import type { CliContext } from './CliContext';

/**
 * 命令名到处理器的注册表。
 *
 * 【待重构】这里是按名字分派的两处之一（另一处是 ShapeFactory）。
 */
export class CommandRegistry {
  private readonly handlers = new Map<string, CliHandler>();

  register(handler: CliHandler): this {
    if (this.handlers.has(handler.name)) {
      throw new Error(`command already registered: ${handler.name}`);
    }
    this.handlers.set(handler.name, handler);
    return this;
  }

  usages(): string[] {
    return [...this.handlers.values()].map((handler) => handler.usage);
  }

  dispatch(name: string, args: readonly string[], context: CliContext): void {
    const handler = this.handlers.get(name);
    if (handler === undefined) {
      throw new Error(`unknown command: ${name}`);
    }
    handler.execute(args, context);
  }
}
