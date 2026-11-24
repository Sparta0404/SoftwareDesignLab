import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type {
  AttributeHandler,
  PluginContext,
  ShapeProvider,
  TreeDecorator,
  TreeNodeInfo,
} from '../../src/api';
import { SvgDocument } from '../../src/api';
import { createCli, type PluginEntry } from '../../src/main';
import boxPlugin, {
  BoxAttributeHandler,
  BoxProvider,
  BoxShape,
  BoxTypeLabelDecorator,
  manifest,
  ShapeBoxPlugin,
} from '../../plugins/shape-box/index';
import packageJson from '../../plugins/shape-box/package.json';

class Memory {
  text = '';
  write(chunk: string): void {
    this.text += chunk;
  }
}

const BOX_ENTRY: PluginEntry = { plugin: boxPlugin, manifest };

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'svg-box-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

/** 只装 box 插件（可选：完全不装）的 CLI，每次调用返回这一行的 stdout / stderr。 */
function build(withBox = true) {
  const stdout = new Memory();
  const stderr = new Memory();
  const cli = withBox
    ? createCli(stdout as unknown as Writable, stderr as unknown as Writable, [BOX_ENTRY])
    : createCli(stdout as unknown as Writable, stderr as unknown as Writable, { kind: 'none' });
  return (...lines: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    for (const line of lines) {
      stdout.text = '';
      stderr.text = '';
      cli.executeLine(line);
      if (stdout.text !== '') out.push(stdout.text.replace(/\n$/, ''));
      if (stderr.text !== '') err.push(stderr.text.replace(/\n$/, ''));
    }
    return { out, err };
  };
}

const NODE = 'create box n1 120 100 160 60 "开始"';

describe('shape-box 插件：注册与清单', () => {
  it('清单取自 package.json，声明与实际登记的三类扩展项一致', () => {
    expect(manifest).toEqual({ name: packageJson.name, contributes: packageJson.contributes });
    expect(manifest.contributes).toEqual({
      shapes: ['box'],
      attributeHandlers: ['box-attributes'],
      treeDecorators: ['box-type-label'],
    });
  });

  it('只依赖扩展上下文：用测试替身即可独立验证 activate 的登记', () => {
    const shapes: ShapeProvider[] = [];
    const handlers: AttributeHandler[] = [];
    const decorators: TreeDecorator[] = [];
    const context: PluginContext = {
      registerShape: (provider) => shapes.push(provider),
      registerCommand: () => {
        throw new Error('box registers no command');
      },
      registerAttributeHandler: (handler) => handlers.push(handler),
      registerTreeDecorator: (decorator) => decorators.push(decorator),
    };
    new ShapeBoxPlugin().activate(context);
    expect(shapes.map((item) => item.typeName)).toEqual(['box']);
    expect(handlers.map((item) => item.name)).toEqual(['box-attributes']);
    expect(decorators.map((item) => item.name)).toEqual(['box-type-label']);
    expect(shapes[0]).toBeInstanceOf(BoxProvider);
    expect(handlers[0]).toBeInstanceOf(BoxAttributeHandler);
    expect(decorators[0]).toBeInstanceOf(BoxTypeLabelDecorator);
  });

  it('出现在 help 的 shapes 里，用法为需求规定的参数形式', () => {
    const { out } = build()('help');
    expect(out[0]).toContain('  create box <id> <x> <y> <w> <h> "<title>"');
  });

  it('没有安装插件时 create box 报未知类型', () => {
    const run = build(false);
    run('init');
    expect(run(NODE).err).toEqual([
      'error: unknown shape type: box (is the plugin loaded?)',
    ]);
  });
});

describe('shape-box 插件：创建与显示', () => {
  it('create 回显 box#id 与内部部件；tree 用 g#id 加 (box) 标签', () => {
    const run = build();
    run('init 800 600');
    expect(run(NODE).out).toEqual(['box#n1 created (g#n1 + rect#n1-rect + text#n1-label)']);
    expect(run('tree n1').out).toEqual([
      [
        'g#n1 (box)',
        '├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=#4a90d9',
        '└── text#n1-label  (140,135) "开始"',
      ].join('\n'),
    ]);
  });

  it('子部件模板：默认填充 #4a90d9，文字位置为 x+20、y+h/2+5', () => {
    const run = build();
    run('init', 'create box b 10 20 100 40 "t"');
    expect(run('show b-rect').out[0]).toContain('fill=#4a90d9');
    expect(run('show b-label').out[0]).toContain('x=30');
    expect(run('show b-label').out[0]).toContain('y=45');
  });

  it('参数个数或数字不对时报用法或数字错误，且不留下任何图形', () => {
    const run = build();
    run('init');
    expect(run('create box n1 1 2 3').err).toEqual([
      'error: usage: create box <id> <x> <y> <w> <h> "<title>"',
    ]);
    expect(run('create box n1 a 2 3 4 "t"').err).toEqual(['error: invalid number: a']);
    expect(run('tree').out).toEqual(['svg (800x600)']);
  });

  it('支持 in 子句并可递归嵌套；嵌套的 box 同样带标签', () => {
    const run = build();
    run('init', 'create box outer 0 0 200 100 "外"');
    expect(run('create box inner 10 10 50 30 "内" in outer').out).toEqual([
      'box#inner created in box#outer (g#inner + rect#inner-rect + text#inner-label)',
    ]);
    const tree = run('tree').out[0];
    expect(tree).toContain('g#outer (box)');
    expect(tree).toContain('g#inner (box)');
  });

  it('id 冲突时整条命令失败，不留下容器或子部件', () => {
    const run = build();
    run('init', 'create rect n1-rect 0 0 1 1');
    const before = run('tree').out;
    expect(run(NODE).err).toEqual(['error: id already exists: n1-rect']);
    expect(run('tree').out).toEqual(before);
    expect(run('show n1').err).toEqual(['error: no such shape: n1']);

    run('create g n2');
    expect(run('create box n2 0 0 1 1 "x"').err).toEqual(['error: id already exists: n2']);
    expect(run('show n2-rect').err).toEqual(['error: no such shape: n2-rect']);
  });
});

describe('shape-box 插件：统一操作（Composite）', () => {
  it('move 整体平移：矩形与文字随行，一次 undo 恢复', () => {
    const run = build();
    run('init', NODE);
    expect(run('move n1 0 100').out).toEqual(['box#n1 moved by (0,100)']);
    expect(run('show n1-rect').out[0]).toContain('y=200');
    expect(run('undo').out).toEqual(['box#n1 moved back by (0,-100)']);
    expect(run('show n1-rect').out[0]).toContain('y=100');
  });

  it('delete 删除整个 box，是一个 undo 单元', () => {
    const run = build();
    run('init', NODE);
    expect(run('delete n1').out).toEqual(['box#n1 deleted']);
    expect(run('tree').out).toEqual(['svg (800x600)']);
    run('undo');
    expect(run('tree n1').out[0]).toContain('g#n1 (box)');
    expect(run('show n1-rect').err).toEqual([]);
  });

  it('可以被 group 收编；ungroup box 被拒绝', () => {
    const run = build();
    run('init', NODE, 'create box n2 0 0 10 10 "二"');
    expect(run('group cluster n1 n2').out).toEqual(['g#cluster created with 2 children']);
    expect(run('ungroup n1').err).toEqual(['error: cannot ungroup composite shape: n1']);
    expect(run('tree').out[0]).toContain('g#n1 (box)');
  });

  it('scale 递归到内部部件', () => {
    const run = build();
    run('init', 'create box b 10 10 100 40 "t"');
    run('scale b 2');
    expect(run('show b-rect').out[0]).toContain('width=200');
  });
});

describe('shape-box 插件：fill 与 label 的领域语义', () => {
  it('fill 传播到内部矩形；一次 undo / redo 整体恢复与重做', () => {
    const run = build();
    run('init', NODE);
    expect(run('set n1 fill #f5a623').out).toEqual(['box#n1 fill propagated to n1-rect']);
    expect(run('show n1-rect').out[0]).toContain('fill=#f5a623');
    expect(run('undo').out).toEqual(['box#n1 fill restored: #4a90d9']);
    expect(run('show n1-rect').out[0]).toContain('fill=#4a90d9');
    expect(run('redo').out).toEqual(['box#n1 fill propagated to n1-rect']);
    expect(run('show n1-rect').out[0]).toContain('fill=#f5a623');
    // box 自己的 <g> 没有被写入 fill
    expect(run('show n1').out.join('\n')).not.toContain('fill=');
  });

  it('label 改写内部文字；一次 undo / redo 整体恢复与重做', () => {
    const run = build();
    run('init', NODE);
    expect(run('set n1 label "处理数据 v2"').out).toEqual(['box#n1 label updated: "处理数据 v2"']);
    expect(run('show n1-label').out[0]).toContain('text="处理数据 v2"');
    expect(run('undo').out).toEqual(['box#n1 label restored: "开始"']);
    expect(run('show n1-label').out[0]).toContain('text="开始"');
    expect(run('redo').out).toEqual(['box#n1 label updated: "处理数据 v2"']);
    expect(run('show n1-label').out[0]).toContain('text="处理数据 v2"');
  });

  it('两条 set 各自是一个 undo 单元', () => {
    const run = build();
    run('init', NODE, 'set n1 fill red', 'set n1 label "B"');
    run('undo');
    expect(run('show n1-label').out[0]).toContain('text="开始"');
    expect(run('show n1-rect').out[0]).toContain('fill=red');
    run('undo');
    expect(run('show n1-rect').out[0]).toContain('fill=#4a90d9');
  });

  it('其余属性走 Phase 1 的默认路径；label 不进入白名单，对普通图形仍是未知属性', () => {
    const run = build();
    run('init', NODE, 'create rect r1 0 0 5 5');
    expect(run('set n1 stroke red').out).toEqual(['box#n1 updated: stroke=red']);
    expect(run('set n1 bogus 1').err).toEqual(['error: unknown attribute: bogus']);
    expect(run('set r1 label x').err).toEqual(['error: unknown attribute: label']);
    expect(run('set r1 fill blue').out).toEqual(['rect#r1 updated: fill=blue']);
  });
});

describe('shape-box 插件：必要子部件受保护', () => {
  it.each([
    ['delete n1-rect', 'cannot detach n1-rect from box#n1'],
    ['delete n1-label', 'cannot detach n1-label from box#n1'],
    ['addto g1 n1-rect', 'cannot detach n1-rect from box#n1'],
    ['group g3 n1-label', 'cannot detach n1-label from box#n1'],
    ['front n1-rect', 'cannot detach n1-rect from box#n1'],
    ['back n1-label', 'cannot detach n1-label from box#n1'],
  ])('%s 被拒绝，树与 undo 历史都不变', (command, message) => {
    const run = build();
    run('init', NODE, 'create g g1', 'create g g2', 'move n1 5 0');
    const before = run('tree').out;
    expect(run(command).err).toEqual([`error: ${message}`]);
    expect(run('tree').out).toEqual(before);
    // 失败的命令没有进入历史：下一次 undo 撤销的仍是 move
    expect(run('undo').out).toEqual(['box#n1 moved back by (-5,0)']);
  });

  it('box 里额外放进去的子图形不受保护，可以正常删除并撤销', () => {
    const run = build();
    run('init', NODE, 'create rect extra 0 0 5 5 in n1');
    expect(run('delete extra').out).toEqual(['rect#extra deleted']);
    run('undo');
    expect(run('tree n1').out[0]).toContain('rect#extra');
  });
});

describe('shape-box 插件：序列化、读回与降级', () => {
  const FILE = () => join(directory, 'box.svg');

  function saveSample(): string {
    const run = build();
    run(
      'init 800 600',
      NODE,
      'create box n2 520 100 160 60 "处理数据"',
      'create box inner 10 10 20 20 "内" in n2',
      'create rect extra 1 1 2 2 in n1',
      'set n2 fill #f5a623',
      'set extra stroke black',
      `save ${FILE()}`,
    );
    return readFileSync(FILE(), 'utf8');
  }

  it('序列化为带 data-kind="box" 的普通 g，后面跟 rect 与 text', () => {
    const xml = saveSample();
    expect(xml).toContain('<g id="n1" data-kind="box">');
    expect(xml).toContain('<rect id="n1-rect" x="120" y="100" width="160" height="60" fill="#4a90d9"/>');
    expect(xml).toContain('<text id="n1-label" x="140" y="135">开始</text>');
  });

  it('装了插件的编辑器读回后还原为 box，再保存与原文件逐字节相同', () => {
    const xml = saveSample();
    const run = build();
    expect(run(`read ${FILE()}`).out).toEqual([`read ${FILE()} (10 elements)`]);
    const tree = run('tree').out[0];
    expect(tree).toContain('g#n1 (box)');
    expect(tree).toContain('g#inner (box)');
    // 还原后的 box 具备领域语义与保护
    expect(run('set n1 label "改"').out).toEqual(['box#n1 label updated: "改"']);
    expect(run('delete n1-rect').err).toEqual(['error: cannot detach n1-rect from box#n1']);
    run('undo');
    const again = join(directory, 'again.svg');
    run(`save ${again}`);
    expect(readFileSync(again, 'utf8')).toBe(xml);
  });

  it('box 自身的样式属性与未知属性随 round-trip 保留，data-kind 不被当成未知属性重复写出', () => {
    const run = build();
    const first = join(directory, 'styled.svg');
    run('init', NODE, 'set n1 stroke black', `save ${first}`);
    const xml = readFileSync(first, 'utf8');
    expect(xml).toContain('<g id="n1" data-kind="box" stroke="black">');
    expect(xml.match(/data-kind/g)).toHaveLength(1);

    const second = join(directory, 'styled-again.svg');
    run(`read ${first}`, `save ${second}`);
    expect(readFileSync(second, 'utf8')).toBe(xml);
  });

  it('没有安装插件的编辑器降级为普通 g：结构不丢、不再有 box 语义，data-kind 原样写回', () => {
    const xml = saveSample();
    const run = build(false);
    run(`read ${FILE()}`);
    const tree = run('tree').out[0];
    expect(tree).toContain('g#n1');
    expect(tree).not.toContain('(box)');
    expect(run('set n1 label x').err).toEqual(['error: unknown attribute: label']);
    // 降级后的 inner 只是普通分组，可以 ungroup（装了插件时它会被拒绝）
    expect(run('ungroup inner').err).toEqual([]);
    run('undo');
    const again = join(directory, 'degraded.svg');
    run(`save ${again}`);
    expect(readFileSync(again, 'utf8')).toBe(xml);
  });

  describe('结构不合法的 box 被整体拒绝，读入失败保持原文档', () => {
    function readBad(body: string): { out: string[]; err: string[]; tree: string[] } {
      const bad = join(directory, 'bad.svg');
      writeFileSync(
        bad,
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">${body}</svg>`,
        'utf8',
      );
      const run = build();
      run('init 100 100', 'create rect keep 0 0 1 1');
      const result = run(`read ${bad}`);
      return { ...result, tree: run('tree').out };
    }

    const KEEP = ['svg (100x100)\n└── rect#keep  x=0 y=0 w=1 h=1'];

    it('缺少矩形', () => {
      const result = readBad('<g id="b" data-kind="box"><text id="b-label" x="0" y="0">t</text></g>');
      expect(result.err).toEqual(['error: invalid box: b (missing rect b-rect)']);
      expect(result.tree).toEqual(KEEP);
    });

    it('缺少标题文字', () => {
      const result = readBad('<g id="b" data-kind="box"><rect id="b-rect" x="0" y="0" width="1" height="1"/></g>');
      expect(result.err).toEqual(['error: invalid box: b (missing text b-label)']);
      expect(result.tree).toEqual(KEEP);
    });

    it('部件类型错误', () => {
      const result = readBad(
        '<g id="b" data-kind="box"><rect id="b-rect" x="0" y="0" width="1" height="1"/>' +
          '<rect id="b-label" x="0" y="0" width="1" height="1"/></g>',
      );
      expect(result.err).toEqual([
        'error: invalid box: b (b-label must be <text>, found <rect>)',
      ]);
      expect(result.tree).toEqual(KEEP);
    });

    it('嵌套在普通分组里的坏 box 同样拒绝整个读入', () => {
      const result = readBad('<g id="outer"><g id="b" data-kind="box"/></g>');
      expect(result.err[0]).toMatch(/^error: invalid box: b/);
      expect(result.tree).toEqual(KEEP);
    });

    it('重复 id 不能靠降级消除，同样拒绝整个读入', () => {
      const result = readBad(
        '<g id="b" data-kind="box"><rect id="b-rect" x="0" y="0" width="1" height="1"/>' +
          '<text id="b-label" x="0" y="0">t</text><circle id="b-rect" cx="0" cy="0" r="1"/></g>',
      );
      expect(result.err).toEqual(['error: id already exists: b-rect']);
      expect(result.tree).toEqual(KEEP);
    });
  });
});

describe('shape-box 插件：BoxShape 与装饰器', () => {
  it('(box) 标签只给 box 行，其余图形与文档根没有', () => {
    const decorator = new BoxTypeLabelDecorator();
    const document = new SvgDocument();
    const box = new BoxShape('b');
    const info = (shape: BoxShape | SvgDocument['root'], isDocumentRoot = false): TreeNodeInfo => ({
      shape,
      document,
      isDocumentRoot,
    });
    expect(decorator.decorate(info(box))).toBe('(box)');
    expect(decorator.decorate(info(document.root, true))).toBeUndefined();
  });

  it('缺少必要部件的 box 在取部件时报契约违反', () => {
    expect(() => new BoxShape('b').part('rect')).toThrow('box#b lost its part b-rect');
  });
});
