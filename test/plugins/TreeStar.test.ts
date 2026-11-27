import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PluginContext, TreeDecorator } from '../../src/api';
import { SvgDocument } from '../../src/api';
import { createCli, type PluginEntry } from '../../src/main';
import { GroupShape } from '../../src/model/shape/GroupShape';
import { RectShape } from '../../src/shapes/rect/RectShape';
import { TextShape } from '../../src/shapes/text/TextShape';
import { TreeRenderer } from '../../src/view/TreeRenderer';
import boxPlugin, { manifest as boxManifest } from '../../plugins/shape-box/index';
import starPlugin, {
  manifest,
  ModificationTracker,
  ModifiedStarDecorator,
  TreeStarPlugin,
} from '../../plugins/tree-star/index';
import packageJson from '../../plugins/tree-star/package.json';

class Memory {
  text = '';
  write(chunk: string): void {
    this.text += chunk;
  }
}

const BOX: PluginEntry = { plugin: boxPlugin, manifest: boxManifest };
const STAR: PluginEntry = { plugin: starPlugin, manifest };

describe('tree-star 插件：注册与清单', () => {
  it('清单取自 package.json，只声明一个树装饰器', () => {
    expect(manifest).toEqual({ name: packageJson.name, contributes: packageJson.contributes });
    expect(manifest.contributes).toEqual({ treeDecorators: ['modified-star'] });
  });

  it('只依赖扩展上下文：用测试替身即可独立验证 activate 的登记', () => {
    const decorators: TreeDecorator[] = [];
    const context: PluginContext = {
      registerShape: () => {
        throw new Error('tree-star registers no shape');
      },
      registerCommand: () => {
        throw new Error('tree-star registers no command');
      },
      registerAttributeHandler: () => {
        throw new Error('tree-star registers no attribute handler');
      },
      registerTreeDecorator: (decorator) => decorators.push(decorator),
    };
    new TreeStarPlugin().activate(context);
    expect(decorators.map((item) => item.name)).toEqual(['modified-star']);
    expect(typeof decorators[0].onDocumentEvent).toBe('function');
  });

  it('每次 activate 都创建新的装饰器，状态不会在实例之间共享', () => {
    const collect = (): TreeDecorator[] => {
      const found: TreeDecorator[] = [];
      new TreeStarPlugin().activate({
        registerShape: () => undefined,
        registerCommand: () => undefined,
        registerAttributeHandler: () => undefined,
        registerTreeDecorator: (decorator) => found.push(decorator),
      });
      return found;
    };
    expect(collect()[0]).not.toBe(collect()[0]);
  });
});

/** 状态机测试：直接给跟踪器喂事件，不经过 CLI，也不依赖其他插件。 */
describe('ModificationTracker 状态机', () => {
  function setup() {
    const document = new SvgDocument(800, 600);
    const tracker = new ModificationTracker();
    const rect = new RectShape('r1', 0, 0, 10, 10);
    const group = new GroupShape('g1');
    document.insert(rect, document.root);
    document.insert(group, document.root);
    const label = new TextShape('t1', 5, 5, 'hi');
    document.insert(label, group);
    return { document, tracker, rect, group, label };
  }

  /** 与 EditorSession 一致：先改文档，再发 edited。 */
  const edited = (t: ModificationTracker, d: SvgDocument): void => t.onDocumentEvent('edited', d);

  it('未收到 opened 之前（没有基线）不标记任何东西，edited 也不会凭空建立基线', () => {
    const { document, tracker, rect } = setup();
    edited(tracker, document);
    expect(tracker.isModified(rect, document)).toBe(false);
    expect(tracker.isDocumentModified(document)).toBe(false);
  });

  it('opened：以当前内容为基线，没有任何差异', () => {
    const { document, tracker, rect, group, label } = setup();
    tracker.onDocumentEvent('opened', document);
    for (const shape of [rect, group, label]) expect(tracker.isModified(shape, document)).toBe(false);
    expect(tracker.isDocumentModified(document)).toBe(false);
  });

  it('新建的节点立即带标记，文档根随之带标记', () => {
    const { document, tracker } = setup();
    tracker.onDocumentEvent('opened', document);
    const fresh = new RectShape('r2', 1, 1, 2, 2);
    document.insert(fresh, document.root);
    edited(tracker, document);
    expect(tracker.isModified(fresh, document)).toBe(true);
    expect(tracker.isDocumentModified(document)).toBe(true);
  });

  it('修改属性、文字、位置都会被发现；没动过的节点不带标记', () => {
    const { document, tracker, rect, group, label } = setup();
    tracker.onDocumentEvent('opened', document);
    rect.setAttr('fill', 'red');
    edited(tracker, document);
    expect(tracker.isModified(rect, document)).toBe(true);
    expect(tracker.isModified(label, document)).toBe(false);

    label.setAttr('text', 'bye');
    edited(tracker, document);
    expect(tracker.isModified(label, document)).toBe(true);

    document.relocate(label, document.root);
    edited(tracker, document);
    expect(tracker.isModified(label, document)).toBe(true);
    expect(tracker.isModified(group, document)).toBe(false);
  });

  it('z 序变化（下标改变）也算差异', () => {
    const { document, tracker, rect } = setup();
    tracker.onDocumentEvent('opened', document);
    document.relocate(rect, document.root, 1);
    edited(tracker, document);
    expect(tracker.isModified(rect, document)).toBe(true);
    expect(tracker.isDocumentModified(document)).toBe(true);
  });

  it('不向祖先传播：子节点变了，父容器自己的指纹没变就不带标记；文档根带标记', () => {
    const { document, tracker, group, label } = setup();
    tracker.onDocumentEvent('opened', document);
    label.setAttr('fill', 'blue');
    edited(tracker, document);
    expect(tracker.isModified(label, document)).toBe(true);
    expect(tracker.isModified(group, document)).toBe(false);
    expect(tracker.isDocumentModified(document)).toBe(true);
  });

  it('saved：重新取基线，所有标记消失；之后再编辑重新出现', () => {
    const { document, tracker, rect } = setup();
    tracker.onDocumentEvent('opened', document);
    rect.setAttr('fill', 'red');
    edited(tracker, document);
    expect(tracker.isModified(rect, document)).toBe(true);

    tracker.onDocumentEvent('saved', document);
    expect(tracker.isModified(rect, document)).toBe(false);
    expect(tracker.isDocumentModified(document)).toBe(false);

    rect.setAttr('fill', 'green');
    edited(tracker, document);
    expect(tracker.isModified(rect, document)).toBe(true);
  });

  it('回到保存点（内容与保存点一致）时标记消失，而不是“编辑过就一直带标记”', () => {
    const { document, tracker, rect } = setup();
    tracker.onDocumentEvent('opened', document);
    rect.setAttr('fill', 'red');
    edited(tracker, document);
    rect.unsetAttr('fill'); // 相当于 undo
    edited(tracker, document);
    expect(tracker.isModified(rect, document)).toBe(false);
    expect(tracker.isDocumentModified(document)).toBe(false);
  });

  it('编辑 → 保存 → 再编辑 → 回到“编辑后保存”的状态：相对新保存点干净，而不是相对打开时', () => {
    const { document, tracker, rect } = setup();
    tracker.onDocumentEvent('opened', document);
    rect.setAttr('fill', 'red');
    edited(tracker, document);
    tracker.onDocumentEvent('saved', document);
    rect.setAttr('fill', 'green');
    edited(tracker, document);
    expect(tracker.isModified(rect, document)).toBe(true);
    rect.setAttr('fill', 'red'); // 回到保存点（此时与打开时不同，但与保存点一致）
    edited(tracker, document);
    expect(tracker.isModified(rect, document)).toBe(false);
    expect(tracker.isDocumentModified(document)).toBe(false);
  });

  it('删除：被删节点不再出现，文档根带标记；删回来（内容一致）后恢复干净', () => {
    const { document, tracker, group, label } = setup();
    tracker.onDocumentEvent('opened', document);
    const placement = document.detach(group);
    edited(tracker, document);
    expect(tracker.isDocumentModified(document)).toBe(true);

    document.insert(group, placement.parent, placement.index);
    edited(tracker, document);
    expect(tracker.isDocumentModified(document)).toBe(false);
    expect(tracker.isModified(group, document)).toBe(false);
    expect(tracker.isModified(label, document)).toBe(false);
  });

  it('画布尺寸变化只让文档根带标记；改回原尺寸后恢复', () => {
    const { document, tracker, rect } = setup();
    tracker.onDocumentEvent('opened', document);
    document.resize(1024, 768);
    edited(tracker, document);
    expect(tracker.isDocumentModified(document)).toBe(true);
    expect(tracker.isModified(rect, document)).toBe(false);
    document.resize(800, 600);
    edited(tracker, document);
    expect(tracker.isDocumentModified(document)).toBe(false);
  });

  it('opened 换成新文档：旧标记全部作废，旧文档不再被标记', () => {
    const first = setup();
    first.tracker.onDocumentEvent('opened', first.document);
    first.rect.setAttr('fill', 'red');
    edited(first.tracker, first.document);

    const replacement = setup();
    first.tracker.onDocumentEvent('opened', replacement.document);
    expect(first.tracker.isDocumentModified(replacement.document)).toBe(false);
    expect(first.tracker.isModified(replacement.rect, replacement.document)).toBe(false);
    // 旧文档不属于当前跟踪对象
    expect(first.tracker.isModified(first.rect, first.document)).toBe(false);
    expect(first.tracker.isDocumentModified(first.document)).toBe(false);
  });

  it('两个跟踪器互相独立（状态在实例里，不在全局）', () => {
    const { document, rect } = setup();
    const a = new ModificationTracker();
    const b = new ModificationTracker();
    a.onDocumentEvent('opened', document);
    b.onDocumentEvent('opened', document);
    rect.setAttr('fill', 'red');
    edited(a, document);
    expect(a.isModified(rect, document)).toBe(true);
    expect(b.isModified(rect, document)).toBe(false);
  });
});

describe('ModifiedStarDecorator 与 TreeRenderer', () => {
  it('星号追加在行尾，文档根行为 `svg (800x600) *`，对齐列不受影响', () => {
    const document = new SvgDocument(800, 600);
    const decorator = new ModifiedStarDecorator();
    decorator.onDocumentEvent('opened', document);
    document.insert(new RectShape('bg', 0, 0, 800, 600), document.root);
    document.insert(new TextShape('title', 20, 40, 'Hi'), document.root);
    decorator.onDocumentEvent('edited', document);
    expect(new TreeRenderer([decorator]).render(document)).toBe(
      [
        'svg (800x600) *',
        '├── rect#bg     x=0 y=0 w=800 h=600 *',
        '└── text#title  (20,40) "Hi" *',
      ].join('\n'),
    );
    decorator.onDocumentEvent('saved', document);
    expect(new TreeRenderer([decorator]).render(document)).toBe(
      new TreeRenderer().render(document),
    );
  });

  it('tree <id> 的首行也按自身状态加标记（它不是文档根）', () => {
    const document = new SvgDocument(800, 600);
    const decorator = new ModifiedStarDecorator();
    const group = new GroupShape('g1');
    document.insert(group, document.root);
    decorator.onDocumentEvent('opened', document);
    document.insert(new RectShape('r1', 0, 0, 1, 1), group);
    decorator.onDocumentEvent('edited', document);
    expect(new TreeRenderer([decorator]).render(document, 'g1').split('\n')).toEqual([
      'g#g1',
      '└── rect#r1  x=0 y=0 w=1 h=1 *',
    ]);
  });
});

/** 带两个标签插件的真实 CLI：覆盖会话事件接线、box 与星号并存。 */
describe('tree-star 与 shape-box 并存（整合会话）', () => {
  let directory: string;
  let original: string;

  beforeEach(() => {
    original = process.cwd();
    directory = mkdtempSync(join(tmpdir(), 'svg-star-'));
    process.chdir(directory); // 会话中的 save / read 写到临时目录
  });

  afterEach(() => {
    process.chdir(original);
    rmSync(directory, { recursive: true, force: true });
  });

  function build(entries: readonly PluginEntry[]) {
    const stdout = new Memory();
    const stderr = new Memory();
    const cli = createCli(stdout as unknown as Writable, stderr as unknown as Writable, entries);
    return (line: string): { out: string; err: string } => {
      stdout.text = '';
      stderr.text = '';
      cli.executeLine(line);
      return { out: stdout.text.replace(/\n$/, ''), err: stderr.text.replace(/\n$/, '') };
    };
  }

  const NODE = 'create box n1 120 100 160 60 "开始"';

  it('刚创建的 box：根、容器与两个内部部件都带 *，容器行是 `(box) *`', () => {
    const run = build([BOX, STAR]);
    run('init 800 600');
    expect(run('tree').out).toBe('svg (800x600)'); // 空白新文档与基线一致
    run(NODE);
    expect(run('tree').out).toBe(
      [
        'svg (800x600) *',
        '└── g#n1 (box) *',
        '    ├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=#4a90d9 *',
        '    └── text#n1-label  (140,135) "开始" *',
      ].join('\n'),
    );
  });

  it('保存后全部清除；set fill 只标记被转发的矩形，不传播到 box 容器，根带标记；undo 回保存点后消失', () => {
    const run = build([BOX, STAR]);
    run('init 800 600');
    run(NODE);
    run('save doc.svg');
    expect(run('tree').out).toBe(
      [
        'svg (800x600)',
        '└── g#n1 (box)',
        '    ├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=#4a90d9',
        '    └── text#n1-label  (140,135) "开始"',
      ].join('\n'),
    );

    run('set n1 fill red');
    expect(run('tree').out).toBe(
      [
        'svg (800x600) *',
        '└── g#n1 (box)',
        '    ├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=red *',
        '    └── text#n1-label  (140,135) "开始"',
      ].join('\n'),
    );

    run('undo');
    expect(run('tree').out).not.toContain('*');
  });

  it('label 改写只标记文字部件；redo 重新出现，undo 再消失', () => {
    const run = build([BOX, STAR]);
    run('init 800 600');
    run(NODE);
    run('save doc.svg');
    run('set n1 label "结束"');
    const dirty = run('tree').out.split('\n');
    expect(dirty[0]).toBe('svg (800x600) *');
    expect(dirty[1]).toBe('└── g#n1 (box)');
    expect(dirty[3]).toBe('    └── text#n1-label  (140,135) "结束" *');
    run('undo');
    expect(run('tree').out).not.toContain('*');
    run('redo');
    expect(run('tree').out).toContain('"结束" *');
  });

  it('编辑 → 保存 → 再编辑 → undo 回保存点：各分支的标记', () => {
    const run = build([BOX, STAR]);
    run('init 800 600');
    run('create rect r1 0 0 10 10');
    expect(run('tree').out.split('\n')).toEqual([
      'svg (800x600) *',
      '└── rect#r1  x=0 y=0 w=10 h=10 *',
    ]);
    run('save a.svg');
    expect(run('tree').out).not.toContain('*');

    run('set r1 fill red');
    expect(run('tree').out.split('\n')[1]).toMatch(/ \*$/);
    run('save a.svg'); // 以编辑后的内容为新保存点
    expect(run('tree').out).not.toContain('*');

    run('move r1 5 5');
    expect(run('tree').out.split('\n')[0]).toBe('svg (800x600) *');
    run('undo'); // undo 是同一份内容，回到保存点
    expect(run('tree').out).not.toContain('*');
  });

  it('delete 之后根行带 *，undo 之后消失；canvas 改尺寸只让根行带 *', () => {
    const run = build([BOX, STAR]);
    run('init 800 600');
    run('create rect r1 0 0 10 10');
    run('save a.svg');
    run('delete r1');
    expect(run('tree').out).toBe('svg (800x600) *');
    run('undo');
    expect(run('tree').out).not.toContain('*');

    run('canvas 1024 768');
    expect(run('tree').out.split('\n')).toEqual([
      'svg (1024x768) *',
      '└── rect#r1  x=0 y=0 w=10 h=10',
    ]);
  });

  it('read 另一个文件会换基线：打开后干净，且不带上一个文档的标记', () => {
    const run = build([BOX, STAR]);
    run('init 800 600');
    run(NODE);
    run('save one.svg');
    run('init 800 600');
    run('create rect r1 0 0 10 10');
    expect(run('tree').out).toContain('*');
    run('read one.svg');
    expect(run('tree').out).not.toContain('*');
    // 读回的 box 仍然是 box，树标签 (box) 与星号互不干扰
    expect(run('tree').out).toContain('g#n1 (box)');
  });

  it('两个标签互不感知：注册顺序决定拼接顺序（box 在前为 `(box) *`，star 在前为 `* (box)`）', () => {
    const boxFirst = build([BOX, STAR]);
    boxFirst('init 800 600');
    boxFirst(NODE);
    expect(boxFirst('tree').out.split('\n')[1]).toBe('└── g#n1 (box) *');

    const starFirst = build([STAR, BOX]);
    starFirst('init 800 600');
    starFirst(NODE);
    expect(starFirst('tree').out.split('\n')[1]).toBe('└── g#n1 * (box)');
  });

  it('只装 box 不装 star：没有任何星号；有 star 的输出去掉行尾 " *" 后与无 star 逐字节相同', () => {
    const script = [
      'init 800 600',
      NODE,
      'create rect r1 10 10 20 20',
      'set n1 fill red',
      'tree',
      'save b.svg',
      'move r1 1 1',
      'tree',
    ];
    const run = (entries: readonly PluginEntry[]): string[] => {
      const exec = build(entries);
      return script.map((line) => exec(line).out);
    };
    const plain = run([BOX]);
    const starred = run([BOX, STAR]);
    expect(plain.join('\n')).not.toContain('*');
    expect(starred.join('\n')).toContain('*');
    const stripped = starred.map((text) =>
      text
        .split('\n')
        .map((line) => line.replace(/ \*$/, ''))
        .join('\n'),
    );
    expect(stripped).toEqual(plain);
  });

  it('只装 star 不装 box：读回带 data-kind 的 g 降级为普通 g，星号照常工作', () => {
    const withBox = build([BOX, STAR]);
    withBox('init 800 600');
    withBox(NODE);
    withBox('save box.svg');

    const starOnly = build([STAR]);
    starOnly('read box.svg');
    const lines = starOnly('tree').out.split('\n');
    expect(lines[0]).toBe('svg (800x600)');
    expect(lines[1]).toBe('└── g#n1');
    starOnly('set n1 fill red');
    expect(starOnly('tree').out.split('\n')[0]).toBe('svg (800x600) *');
  });

  it('失败的命令不改变文档，也不产生标记', () => {
    const run = build([BOX, STAR]);
    run('init 800 600');
    run('create rect r1 0 0 10 10');
    run('save a.svg');
    expect(run('set r1 nonsense 1').err).not.toBe('');
    expect(run('tree').out).not.toContain('*');
  });
});
