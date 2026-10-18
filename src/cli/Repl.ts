import { createInterface, type Interface } from 'node:readline';
import type { Cli } from './Cli';
import type { TextOutput } from './TextOutput';

/** 逐行读取命令的交互循环。`#` 开头的行由 Cli 当作注释忽略。 */
export class Repl {
  constructor(
    private readonly cli: Cli,
    private readonly input: NodeJS.ReadableStream,
    private readonly output: NodeJS.WritableStream,
    private readonly textOutput: TextOutput,
  ) {}

  start(): Interface {
    this.textOutput.write("svg-editor 0.1 — type 'help' for commands");
    const repl = createInterface({
      input: this.input,
      output: this.output,
      prompt: 'svg> ',
    });
    repl.prompt();
    repl.on('line', (line) => {
      this.cli.executeLine(line);
      repl.prompt();
    });
    return repl;
  }
}
