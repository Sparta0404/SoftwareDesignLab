import { Readable, Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/app/EditorSession';
import type { DocumentReader } from '../../src/app/port/DocumentReader';
import type { DocumentWriter } from '../../src/app/port/DocumentWriter';
import { Cli } from '../../src/cli/Cli';
import { ConsoleOutput } from '../../src/cli/ConsoleOutput';
import { Repl } from '../../src/cli/Repl';
import { BuiltinShapes } from '../../src/shapes/BuiltinShapes';

class MemoryStream extends Writable {
  text = '';

  override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: () => void): void {
    this.text += chunk.toString();
    callback();
  }
}

describe('Repl', () => {
  it('打印启动信息，执行命令，并忽略注释', async () => {
    const input = new Readable({ read() {} });
    const stream = new MemoryStream();
    const output = new ConsoleOutput(stream, stream);
    const session = new EditorSession(
      { read: () => { throw new Error('not used'); } } satisfies DocumentReader,
      { write: () => { throw new Error('not used'); } } satisfies DocumentWriter,
      output,
    );
    const repl = new Repl(
      Cli.createDefault(session, BuiltinShapes.createFactory(), output),
      input,
      stream,
      output,
    );

    const done = new Promise<void>((resolve) => {
      repl.start().once('close', () => resolve());
    });
    input.push('# comment\n');
    input.push('init 10 20\n');
    input.push(null);
    await done;

    expect(stream.text).toContain("svg-editor 0.1 — type 'help' for commands\n");
    expect(stream.text).toContain('svg> ');
    expect(stream.text).toContain('canvas 10x20 created\n');
    expect(stream.text).not.toContain('comment');
  });
});
