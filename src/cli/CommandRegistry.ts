import type { Command, CommandContext } from './Command';

/** 命令名到命令的注册表，按注册顺序保存。 */
export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  register(command: Command): this {
    if (this.commands.has(command.name)) {
      throw new Error(`command already registered: ${command.name}`);
    }
    this.commands.set(command.name, command);
    return this;
  }

  usages(): string[] {
    return [...this.commands.values()].map((command) => command.usage);
  }

  dispatch(name: string, args: readonly string[], context: CommandContext): void {
    const command = this.commands.get(name);
    if (command === undefined) {
      throw new Error(`unknown command: ${name}`);
    }
    command.execute(args, context);
  }
}
