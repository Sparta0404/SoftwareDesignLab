import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { ConsoleOutput } from '../../src/cli/ConsoleOutput';

class MemoryStream extends Writable {
  text = '';

  override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: () => void): void {
    this.text += chunk.toString();
    callback();
  }
}

describe('ConsoleOutput', () => {
  it('成功信息写入 stdout，错误和警告分别加前缀后写入 stderr', () => {
    const stdout = new MemoryStream();
    const stderr = new MemoryStream();
    const output = new ConsoleOutput(stdout, stderr);

    output.write('canvas 800x600 created');
    output.writeError('no such shape: r9');
    output.warn('assigned id rect1 to unnamed <rect>');

    expect(stdout.text).toBe('canvas 800x600 created\n');
    expect(stderr.text).toBe(
      'error: no such shape: r9\nwarning: assigned id rect1 to unnamed <rect>\n',
    );
  });
});
