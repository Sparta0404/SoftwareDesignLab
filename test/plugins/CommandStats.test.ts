import { describe, expect, it } from 'vitest';
import { EditorSession } from '../../src/app/EditorSession';
import type { TextOutput } from '../../src/cli/TextOutput';
import { buildBuiltinCli } from '../support/BuiltinCli';
import { FAKE_BOX_MANIFEST, FakeBoxPlugin } from '../support/FakeBox';
import statsPlugin, { manifest, StatsCommand } from '../../plugins/command-stats/index';
import packageJson from '../../plugins/command-stats/package.json';

class Recorder implements TextOutput {
  lines: string[] = [];
  errors: string[] = [];
  write(text: string): void {
    this.lines.push(text);
  }
  writeError(message: string): void {
    this.errors.push(message);
  }
  warn(): void {}
}

function build() {
  const output = new Recorder();
  const session = new EditorSession(
    { read: () => { throw new Error('unused'); } },
    { write: () => { throw new Error('unused'); } },
    output,
  );
  const cli = buildBuiltinCli(session, output, [
    { plugin: new FakeBoxPlugin(), manifest: FAKE_BOX_MANIFEST },
    { plugin: statsPlugin, manifest },
  ]);
  const run = (...lines: string[]) => {
    output.lines = [];
    output.errors = [];
    lines.forEach((line) => cli.executeLine(line));
    return { out: [...output.lines], err: [...output.errors] };
  };
  return { run };
}

describe('stats 插件', () => {
  it('清单与插件包 package.json 一致，且只贡献 stats 命令', () => {
    expect(manifest).toEqual({ name: packageJson.name, contributes: packageJson.contributes });
    expect(manifest.contributes).toEqual({ commands: ['stats'] });
    expect(new StatsCommand().name).toBe('stats');
  });

  it('已加载时出现在 help 中', () => {
    expect(build().run('help').out[0]).toContain('  stats');
  });

  it('输出需求中的示例格式：叶子计数、容器数与总数', () => {
    const { run } = build();
    run(
      'init',
      'create rect r1 0 0 10 10',
      'create rect r2 0 0 10 10',
      'create circle c1 5 5 3',
      'create text t1 1 1 "a"',
      'create g g1',
      'create rect r3 0 0 1 1 in g1',
      'create text t2 1 1 "b" in g1',
    );
    expect(run('stats').out).toEqual(['rect: 3  circle: 1  text: 2  (total 6, containers 1)']);
  });

  it('空文档只有括号部分', () => {
    const { run } = build();
    run('init');
    expect(run('stats').out).toEqual(['(total 0, containers 0)']);
  });

  it('类型顺序为首次出现的深度优先顺序；嵌套容器各计一次', () => {
    const { run } = build();
    run(
      'init',
      'create g outer',
      'create circle c1 1 1 1 in outer',
      'create g inner in outer',
      'create rect r1 0 0 1 1 in inner',
      'create circle c2 1 1 1 in inner',
      'create text t1 0 0 "x"',
      'create rect r2 0 0 1 1',
    );
    expect(run('stats').out).toEqual(['circle: 2  rect: 2  text: 1  (total 5, containers 2)']);
  });

  it('只有容器时没有类型项', () => {
    const { run } = build();
    run('init', 'create g g1', 'create g g2 in g1');
    expect(run('stats').out).toEqual(['(total 0, containers 2)']);
  });

  it('box 只计入 containers，内部叶子照常计数', () => {
    const { run } = build();
    run('init', 'create box n1 0 0 100 40 "Hi"', 'create circle c1 1 1 1');
    expect(run('stats').out).toEqual(['rect: 1  text: 1  circle: 1  (total 3, containers 1)']);
  });

  it('没有文档时报 no document，之后仍可使用', () => {
    const { run } = build();
    expect(run('stats').err).toEqual(["no document. use 'init' or 'read' first"]);
    run('init');
    expect(run('stats').out).toEqual(['(total 0, containers 0)']);
  });

  it('不接收参数', () => {
    const { run } = build();
    run('init');
    expect(run('stats x').err).toEqual(['usage: stats']);
  });

  it('不进入 undo 栈：stats 之后的 undo 仍撤销上一次编辑，重做栈也不受影响', () => {
    const { run } = build();
    run('init', 'create rect r1 0 0 1 1', 'create rect r2 0 0 1 1');
    run('stats', 'stats');
    expect(run('undo').out).toEqual(['rect#r2 deleted']);
    run('stats');
    expect(run('redo').out).toEqual(['rect#r2 created']);
    expect(run('stats').out).toEqual(['rect: 2  (total 2, containers 0)']);
    expect(run('undo', 'undo').out).toEqual(['rect#r2 deleted', 'rect#r1 deleted']);
    expect(run('undo').err).toEqual(['nothing to undo']);
  });
});
