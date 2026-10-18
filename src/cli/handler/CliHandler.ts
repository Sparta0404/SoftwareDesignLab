import type { CliContext } from '../CliContext';

export interface CliHandler {
  readonly name: string;
  readonly usage: string;
  execute(args: readonly string[], context: CliContext): void;
}
