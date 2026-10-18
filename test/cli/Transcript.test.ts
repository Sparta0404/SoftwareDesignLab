import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Cli } from '../../src/cli/Cli';
import { createCli } from '../../src/main';

class MemoryStream extends Writable {
  text = '';

  override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: () => void): void {
    this.text += chunk.toString();
    callback();
  }

  clear(): void {
    this.text = '';
  }
}

function run(cli: Cli, stdout: MemoryStream, stderr: MemoryStream, line: string): void {
  stdout.clear();
  stderr.clear();
  cli.executeLine(line);
}

function expectOutput(
  cli: Cli,
  stdout: MemoryStream,
  stderr: MemoryStream,
  line: string,
  out = '',
  err = '',
): void {
  run(cli, stdout, stderr, line);
  expect(stdout.text).toBe(out === '' ? '' : `${out}\n`);
  expect(stderr.text).toBe(err === '' ? '' : `${err}\n`);
}

describe('实验要求中的 CLI 会话', () => {
  let directory: string;
  let stdout: MemoryStream;
  let stderr: MemoryStream;
  let cli: Cli;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'svg-cli-'));
    stdout = new MemoryStream();
    stderr = new MemoryStream();
    cli = createCli(stdout, stderr);
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('回放完整编辑、撤销和文件往返会话', () => {
    const demo = join(directory, 'demo.svg');
    const other = join(directory, 'other.svg');
    writeFileSync(
      other,
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">',
        '  <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>',
        '  <text id="t1" x="10" y="290">imported</text>',
        '  <circle id="c1" cx="50" cy="50" r="10"/>',
        '  <g id="g1">',
        '    <rect id="r2" x="0" y="0" width="10" height="10"/>',
        '    <circle id="c2" cx="5" cy="5" r="2"/>',
        '  </g>',
        '  <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>',
        '</svg>',
        '',
      ].join('\n'),
      'utf8',
    );

    expectOutput(cli, stdout, stderr, 'init 800 600', 'canvas 800x600 created');
    expectOutput(cli, stdout, stderr, 'create rect bg 0 0 800 600 #ffffff', 'rect#bg created');
    expectOutput(cli, stdout, stderr, 'create text title 20 40 "My Diagram"', 'text#title created');
    expectOutput(cli, stdout, stderr, 'create circle c1 100 100 20 red', 'circle#c1 created');
    expectOutput(cli, stdout, stderr, 'create rect box 200 80 60 60 #3366ff', 'rect#box created');
    expectOutput(cli, stdout, stderr, 'group markers c1 box', 'g#markers created with 2 children');
    expectOutput(
      cli,
      stdout,
      stderr,
      'tree',
      [
        'svg (800x600)',
        '├── rect#bg        x=0 y=0 w=800 h=600 fill=#ffffff',
        '├── text#title     (20,40) "My Diagram"',
        '└── g#markers',
        '    ├── circle#c1  cx=100 cy=100 r=20 fill=red',
        '    └── rect#box   x=200 y=80 w=60 h=60 fill=#3366ff',
      ].join('\n'),
    );
    expectOutput(cli, stdout, stderr, 'move c1 30 0', 'circle#c1 moved to (130,100)');
    expectOutput(cli, stdout, stderr, 'undo', 'circle#c1 moved back to (100,100)');
    expectOutput(cli, stdout, stderr, 'redo', 'circle#c1 moved to (130,100)');
    expectOutput(
      cli,
      stdout,
      stderr,
      'set title text "My Diagram v2"',
      'text#title updated: text="My Diagram v2"',
    );
    expectOutput(cli, stdout, stderr, 'undo', 'text#title updated: text="My Diagram"');
    expectOutput(
      cli,
      stdout,
      stderr,
      'group bad c1 markers',
      '',
      'error: cannot group a container into its own descendant: markers',
    );
    expectOutput(cli, stdout, stderr, 'delete box', 'rect#box deleted');
    expectOutput(cli, stdout, stderr, 'undo', 'rect#box restored into g#markers');
    expectOutput(cli, stdout, stderr, `save ${demo}`, `saved to ${demo} (5 elements)`);
    expect(readFileSync(demo, 'utf8')).toContain('<rect id="bg"');
    expectOutput(cli, stdout, stderr, 'undo', '', 'error: undo not allowed after io command');
    expectOutput(
      cli,
      stdout,
      stderr,
      `read ${other}`,
      `read ${other} (7 elements)`,
      'warning: assigned id rect1 to unnamed <rect>',
    );
    expectOutput(
      cli,
      stdout,
      stderr,
      'tree',
      [
        'svg (400x300)',
        '├── rect#rect1     x=0 y=0 w=400 h=300 fill=#ffffff',
        '├── text#t1        (10,290) "imported"',
        '├── circle#c1      cx=50 cy=50 r=10',
        '├── g#g1',
        '│   ├── rect#r2    x=0 y=0 w=10 h=10',
        '│   └── circle#c2  cx=5 cy=5 r=2',
        '└── ellipse#e1     cx=1 cy=2 rx=3 ry=4',
      ].join('\n'),
    );
  });

  it('回放用容器组合节点的流程图会话', () => {
    const file = join(directory, 'flowchart.svg');
    const lines = [
      ['init 800 600', 'canvas 800x600 created'],
      ['# 先建容器骨架，再往里放图形', ''],
      ['create g flowchart', 'g#flowchart created'],
      ['create g node1 in flowchart', 'g#node1 created in g#flowchart'],
      ['create rect start 120 100 160 60 #4a90d9 in node1', 'rect#start created in g#node1'],
      ['create text start-label 155 135 "开始" in node1', 'text#start-label created in g#node1'],
      ['create g node2 in flowchart', 'g#node2 created in g#flowchart'],
      ['create rect process 520 100 160 60 #f5a623 in node2', 'rect#process created in g#node2'],
      [
        'create text process-label 545 135 "处理数据" in node2',
        'text#process-label created in g#node2',
      ],
      ['create line arrow1 280 130 520 130 black in flowchart', 'line#arrow1 created in g#flowchart'],
      ['move node2 0 100', 'g#node2 moved by (0,100)'],
      ['undo', 'g#node2 moved back by (0,-100)'],
      ['set process-label text "处理数据 v2"', 'text#process-label updated: text="处理数据 v2"'],
      [`save ${file}`, `saved to ${file} (8 elements)`],
    ] as const;

    for (const [line, expected] of lines) {
      expectOutput(cli, stdout, stderr, line, expected);
    }
    expectOutput(
      cli,
      stdout,
      stderr,
      'tree',
      [
        'svg (800x600)',
        '└── g#flowchart',
        '    ├── g#node1',
        '    │   ├── rect#start       x=120 y=100 w=160 h=60 fill=#4a90d9',
        '    │   └── text#start-label (155,135) "开始"',
        '    ├── g#node2',
        '    │   ├── rect#process     x=520 y=100 w=160 h=60 fill=#f5a623',
        '    │   └── text#process-label (545,135) "处理数据 v2"',
        '    └── line#arrow1          (280,130) -> (520,130)',
      ].join('\n'),
    );
  });
});
