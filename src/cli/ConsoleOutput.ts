import type { WarningSink } from '../app/port/WarningSink';
import type { TextOutput } from './TextOutput';

/** 把成功信息、错误和警告分别写到标准输出和标准错误。 */
export class ConsoleOutput implements TextOutput, WarningSink {
  constructor(
    private readonly stdout: { write(chunk: string): void },
    private readonly stderr: { write(chunk: string): void },
  ) {}

  write(text: string): void {
    this.stdout.write(`${text}\n`);
  }

  writeError(message: string): void {
    this.stderr.write(`error: ${message}\n`);
  }

  warn(message: string): void {
    this.stderr.write(`warning: ${message}\n`);
  }
}
