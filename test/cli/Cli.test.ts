import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/app/EditorSession';
import type { DocumentReader } from '../../src/app/port/DocumentReader';
import type { DocumentWriter } from '../../src/app/port/DocumentWriter';
import type { WarningSink } from '../../src/app/port/WarningSink';
import { Cli } from '../../src/cli/Cli';
import { BuiltinShapes } from '../../src/shapes/BuiltinShapes';

class RecordingOutput implements WarningSink {
  readonly lines: string[] = [];
  readonly errors: string[] = [];
  readonly warnings: string[] = [];

  write(text: string): void {
    this.lines.push(text);
  }

  writeError(message: string): void {
    this.errors.push(message);
  }

  warn(message: string): void {
    this.warnings.push(message);
  }
}

function unusedReader(): DocumentReader {
  return {
    read: () => {
      throw new Error('not used');
    },
  };
}

function unusedWriter(): DocumentWriter {
  return {
    write: () => {
      throw new Error('not used');
    },
  };
}

function createCli() {
  const output = new RecordingOutput();
  const session = new EditorSession(unusedReader(), unusedWriter(), output);
  return { output, cli: Cli.createDefault(session, BuiltinShapes.createFactory(), output) };
}

describe('Cli', () => {
  it('忽略空行和注释', () => {
    const { cli, output } = createCli();
    cli.executeLine('   ');
    cli.executeLine('# this is a comment');
    cli.executeLine('   # indented comment');
    expect(output.lines).toEqual([]);
    expect(output.errors).toEqual([]);
  });

  it('分派编辑和显示命令', () => {
    const { cli, output } = createCli();
    cli.executeLine('init 800 600');
    cli.executeLine('create circle c1 100 100 20 red');
    cli.executeLine('show c1');

    expect(output.lines).toEqual([
      'canvas 800x600 created',
      'circle#c1 created',
      ['circle#c1  parent=svg', '  cx=100 cy=100 r=20', '  fill=red'].join('\n'),
    ]);
  });

  it('命令失败只记录错误，不改变已有状态', () => {
    const { cli, output } = createCli();
    cli.executeLine('create rect a 0 0 1 1');
    cli.executeLine('init');
    cli.executeLine('create rect a 0 0 10 10');
    cli.executeLine('create rect a 1 1 10 10');
    cli.executeLine('scale a 0');
    cli.executeLine('tree');

    expect(output.errors).toEqual([
      "no document. use 'init' or 'read' first",
      'id already exists: a',
      'scale factor must be positive',
    ]);
    expect(output.lines.at(-1)).toBe(
      ['svg (800x600)', '└── rect#a  x=0 y=0 w=10 h=10'].join('\n'),
    );
  });

  it('未知命令、参数错误和未闭合引号都变成命令错误', () => {
    const { cli, output } = createCli();
    cli.executeLine('init');
    cli.executeLine('nope');
    cli.executeLine('move a');
    cli.executeLine('create text t 1 2 "hello');

    expect(output.errors).toEqual([
      'unknown command: nope',
      'usage: move <id> <dx> <dy>',
      'unterminated string',
    ]);
  });

  it('help 列出命令和内置图形用法', () => {
    const { cli, output } = createCli();
    cli.executeLine('help');
    expect(output.lines).toEqual([
      [
        'commands:',
        '  init [w] [h]',
        '  read <file.svg>',
        '  save [file.svg]',
        '  canvas [w] [h]',
        '  create <type> <id> [params…] [in <containerId>]',
        '  delete <id>',
        '  move <id> <dx> <dy>',
        '  scale <id> <factor>',
        '  set <id> <attr> <value>',
        '  group <newGid> <id>…',
        '  ungroup <gid>',
        '  addto <gid> <id>',
        '  front <id>',
        '  back <id>',
        '  tree [id]',
        '  show <id>',
        '  undo',
        '  redo',
        '  help',
        '',
        'shapes:',
        '  create rect <id> <x> <y> <w> <h> [fill]',
        '  create circle <id> <cx> <cy> <r> [fill]',
        '  create ellipse <id> <cx> <cy> <rx> <ry> [fill]',
        '  create line <id> <x1> <y1> <x2> <y2> [stroke]',
        '  create text <id> <x> <y> "content"',
        '  create g <id>',
      ].join('\n'),
    ]);
  });
});
