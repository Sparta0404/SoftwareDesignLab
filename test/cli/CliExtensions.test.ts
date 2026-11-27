import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/app/EditorSession';
import type { WarningSink } from '../../src/app/port/WarningSink';
import type { Command, CommandContext } from '../../src/cli/Command';
import type { TreeDecorator } from '../../src/view/TreeDecorator';
import { buildBuiltinCli, extensionPlugin, type Extensions } from '../support/BuiltinCli';
import { FAKE_BOX_MANIFEST, FakeBoxAttributeHandler, FakeBoxPlugin } from '../support/FakeBox';

class RecordingOutput implements WarningSink {
  readonly lines: string[] = [];
  readonly errors: string[] = [];

  write(text: string): void {
    this.lines.push(text);
  }

  writeError(message: string): void {
    this.errors.push(message);
  }

  warn(): void {}
}

function build(extensions: Extensions = {}) {
  const output = new RecordingOutput();
  const session = new EditorSession(
    { read: () => { throw new Error('unused'); } },
    { write: () => { throw new Error('unused'); } },
    output,
  );
  const cli = buildBuiltinCli(session, output, [
    { plugin: new FakeBoxPlugin(), manifest: FAKE_BOX_MANIFEST },
    extensionPlugin('test-extensions', extensions),
  ]);
  const run = (...lines: string[]) => {
    output.lines.length = 0;
    output.errors.length = 0;
    lines.forEach((line) => cli.executeLine(line));
    return { out: [...output.lines], err: [...output.errors] };
  };
  return { cli, run, output };
}

describe('Command 接口与扩展命令', () => {
  it('扩展命令通过 Command 注册，上下文只暴露 session 与 output', () => {
    let seen: CommandContext | undefined;
    let seenArgs: readonly string[] = [];
    const hello: Command = {
      name: 'hello',
      usage: 'hello [name]',
      execute: (args, context) => {
        seen = context;
        seenArgs = args;
        context.output.write(`hi ${args[0] ?? 'world'}`);
      },
    };
    const { run } = build({ commands: [hello] });

    expect(run('hello bob').out).toEqual(['hi bob']);
    expect(seenArgs).toEqual(['bob']);
    expect(Object.keys(seen as object).sort()).toEqual(['output', 'session']);
  });

  it('扩展命令出现在 help 中，且可以通过 session.inspect 读取当前文档', () => {
    const count: Command = {
      name: 'count',
      usage: 'count',
      execute: (_args, context) =>
        context.output.write(String(context.session.inspect((document) => document.shapeCount))),
    };
    const { run } = build({ commands: [count] });

    expect(run('help').out[0]).toContain('  count');
    expect(run('count').err).toEqual(["no document. use 'init' or 'read' first"]);
    run('init');
    run('create rect r1 0 0 1 1');
    expect(run('count').out).toEqual(['1']);
  });

  it('与内置命令同名时在装配期失败', () => {
    const clash: Command = { name: 'tree', usage: 'tree', execute: () => undefined };
    expect(() => build({ commands: [clash] })).toThrow('duplicate registration: commands/tree');
  });

  it('扩展命令抛错时和内置命令一样只输出错误', () => {
    const broken: Command = {
      name: 'broken',
      usage: 'broken',
      execute: () => {
        throw new Error('oops');
      },
    };
    expect(build({ commands: [broken] }).run('broken')).toEqual({ out: [], err: ['oops'] });
  });
});

describe('扩展点接入内置命令', () => {
  it('create 回显使用复合图形的 displayLabel 与创建说明，tree/show 仍使用 g#id', () => {
    const { run } = build();
    run('init');
    expect(run('create box n1 0 0 100 40 "Hi"').out).toEqual([
      'box#n1 created (g#n1 + rect#n1-rect + text#n1-label)',
    ]);
    expect(run('tree').out).toEqual([
      [
        'svg (800x600)',
        '└── g#n1',
        '    ├── rect#n1-rect   x=0 y=0 w=100 h=40',
        '    └── text#n1-label  (20,25) "Hi"',
      ].join('\n'),
    ]);
    expect(run('show n1').out[0].startsWith('g#n1  parent=svg')).toBe(true);
  });

  it('set 经由注册的属性处理器；一次 undo 整体恢复', () => {
    const attributeHandlers = [new FakeBoxAttributeHandler()];
    const { run } = build({ attributeHandlers });
    run('init', 'create box n1 0 0 100 40 "Hi"');

    expect(run('set n1 fill red').out).toEqual(['fill propagated to n1-rect']);
    expect(run('set n1 label "World"').out).toEqual(['label updated: "World"']);
    expect(run('undo').out).toEqual(['label restored: "Hi"']);
    expect(run('show n1-rect').out[0]).toContain('rect#n1-rect');
    expect(run('show n1-rect').out[0]).toContain('fill=red');
    expect(run('set n1 stroke black').out).toEqual(['box#n1 updated: stroke=black']);
  });

  it('没有注册属性处理器时，box 的 fill 仍走 Phase 1 路径（写在 g 上）', () => {
    const { run } = build();
    run('init', 'create box n1 0 0 100 40 "Hi"');
    expect(run('set n1 fill red').out).toEqual(['box#n1 updated: fill=red']);
    expect(run('set n1 label x').err).toEqual(['unknown attribute: label']);
  });

  it('tree 带上注册的装饰器；装饰器抛错时只输出错误', () => {
    const treeDecorators: TreeDecorator[] = [
      {
        name: 'composite',
        decorate: (node) => (node.shape.isComposite() ? '(box)' : undefined),
      },
    ];
    const { run } = build({ treeDecorators });
    run('init', 'create box n1 0 0 100 40 "Hi"');
    expect(run('tree').out[0].split('\n')[1]).toBe('└── g#n1 (box)');
    expect(run('tree n1').out[0].split('\n')[0]).toBe('g#n1 (box)');

    const failing: TreeDecorator[] = [
      {
        name: 'bad',
        decorate: () => {
          throw new Error('nope');
        },
      },
    ];
    const second = build({ treeDecorators: failing });
    second.run('init');
    expect(second.run('tree')).toEqual({ out: [], err: ['tree decorator failed: bad (nope)'] });
  });
});
