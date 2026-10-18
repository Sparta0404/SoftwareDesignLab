import type { Writable } from 'node:stream';
import { EditorSession } from './app/EditorSession';
import { Cli } from './cli/Cli';
import { ConsoleOutput } from './cli/ConsoleOutput';
import { Repl } from './cli/Repl';
import { FileDocumentStore } from './io/FileDocumentStore';
import { SvgParser } from './io/SvgParser';
import { SvgSerializer } from './io/SvgSerializer';
import { BuiltinShapes } from './shapes/BuiltinShapes';

/** 组装全部模块。只有这里同时依赖 cli、io 和内置图形。 */
export function createCli(stdout: Writable, stderr: Writable): Cli {
  const output = new ConsoleOutput(stdout, stderr);
  const factory = BuiltinShapes.createFactory();
  const store = new FileDocumentStore(new SvgParser(factory), new SvgSerializer());
  const session = new EditorSession(store, store, output);
  return Cli.createDefault(session, factory, output);
}

export function main(): void {
  const output = new ConsoleOutput(process.stdout, process.stderr);
  const repl = new Repl(
    createCli(process.stdout, process.stderr),
    process.stdin,
    process.stdout,
    output,
  );
  repl.start();
}

if (require.main === module) {
  main();
}
