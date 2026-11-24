import type { SvgDocument } from '../model/document/SvgDocument';
import { Numbers } from '../model/shape/Numbers';
import type { Shape } from '../model/shape/Shape';
import { TreeDecoratorError } from './error/TreeDecoratorError';
import type { TreeDecorator } from './TreeDecorator';

interface TreeRow {
  readonly shape: Shape;
  readonly prefix: string;
  readonly connector: '├── ' | '└── ';
}

/**
 * tree 命令的纯文本渲染器。
 *
 * 它只负责遍历、连接符和对齐；每种图形显示什么由 Shape.summary() 决定，
 * 行尾标签由注册的 TreeDecorator 追加（没有装饰器时输出与无扩展点时逐字节相同）。
 */
export class TreeRenderer {
  constructor(private readonly decorators: readonly TreeDecorator[] = []) {}

  render(document: SvgDocument, rootId?: string): string {
    if (rootId === undefined) {
      const head = `svg (${Numbers.format(document.width)}x${Numbers.format(document.height)})`;
      const lines = [this.withTags(head, document.root, document, true)];
      lines.push(...this.renderDescendants(document.root, document));
      return lines.join('\n');
    }

    const root = document.find(rootId);
    const lines = [this.rootLine(root, document)];
    lines.push(...this.renderDescendants(root, document));
    return lines.join('\n');
  }

  private renderDescendants(root: Shape, document: SvgDocument): string[] {
    const rows: TreeRow[] = [];
    this.collectRows(root.children(), '', rows);
    if (rows.length === 0) return [];

    // 非容器的几何摘要在整棵可见树中使用同一列；容器的类型注记
    // （例如插件的 `g#n1 (box)`）紧跟标签，不被深层子节点拉开。
    // 对齐只看 summary，行尾标签不参与。
    const summaryColumn = rows.reduce((max, row) => {
      if (row.shape.isContainer() || row.shape.summary() === '') return max;
      return Math.max(max, this.baseLength(row) + 2);
    }, 0);

    return rows.map((row) =>
      this.withTags(this.formatRow(row, summaryColumn), row.shape, document, false),
    );
  }

  private collectRows(children: readonly Shape[], prefix: string, rows: TreeRow[]): void {
    children.forEach((shape, index) => {
      const last = index === children.length - 1;
      rows.push({ shape, prefix, connector: last ? '└── ' : '├── ' });
      this.collectRows(shape.children(), `${prefix}${last ? '    ' : '│   '}`, rows);
    });
  }

  private formatRow(row: TreeRow, summaryColumn: number): string {
    const head = `${row.prefix}${row.connector}${row.shape.label}`;
    const summary = row.shape.summary();
    if (summary === '') return head;
    if (row.shape.isContainer()) return `${head} ${summary}`;
    const spaces = Math.max(1, summaryColumn - this.baseLength(row));
    return `${head}${' '.repeat(spaces)}${summary}`;
  }

  private rootLine(shape: Shape, document: SvgDocument): string {
    const summary = shape.summary();
    const line = summary === '' ? shape.label : `${shape.label} ${summary}`;
    return this.withTags(line, shape, document, false);
  }

  /** 按注册顺序收集各装饰器的标签，以空格拼接后追加到行尾。 */
  private withTags(
    line: string,
    shape: Shape,
    document: SvgDocument,
    isDocumentRoot: boolean,
  ): string {
    const tags: string[] = [];
    for (const decorator of this.decorators) {
      let tag: string | undefined;
      try {
        tag = decorator.decorate({ shape, document, isDocumentRoot });
      } catch (error) {
        throw new TreeDecoratorError(decorator.name, error);
      }
      if (tag !== undefined && tag !== '') tags.push(tag);
    }
    return tags.length === 0 ? line : `${line} ${tags.join(' ')}`;
  }

  private baseLength(row: TreeRow): number {
    return row.prefix.length + row.connector.length + row.shape.label.length;
  }
}
