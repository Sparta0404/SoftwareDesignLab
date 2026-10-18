import type { SvgDocument } from '../model/document/SvgDocument';
import { Numbers } from '../model/shape/Numbers';
import type { Shape } from '../model/shape/Shape';

interface TreeRow {
  readonly shape: Shape;
  readonly prefix: string;
  readonly connector: '├── ' | '└── ';
}

/**
 * tree 命令的纯文本渲染器。
 *
 * 它只负责遍历、连接符和对齐；每种图形显示什么由 Shape.summary() 决定。
 */
export class TreeRenderer {
  render(document: SvgDocument, rootId?: string): string {
    if (rootId === undefined) {
      const lines = [`svg (${Numbers.format(document.width)}x${Numbers.format(document.height)})`];
      lines.push(...this.renderDescendants(document.root));
      return lines.join('\n');
    }

    const root = document.find(rootId);
    const lines = [this.rootLine(root)];
    lines.push(...this.renderDescendants(root));
    return lines.join('\n');
  }

  private renderDescendants(root: Shape): string[] {
    const rows: TreeRow[] = [];
    this.collectRows(root.children(), '', rows);
    if (rows.length === 0) return [];

    // 非容器的几何摘要在整棵可见树中使用同一列；容器的类型注记
    // （例如插件的 `g#n1 (box)`）紧跟标签，不被深层子节点拉开。
    const summaryColumn = rows.reduce((max, row) => {
      if (row.shape.isContainer() || row.shape.summary() === '') return max;
      return Math.max(max, this.baseLength(row) + 2);
    }, 0);

    return rows.map((row) => this.formatRow(row, summaryColumn));
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

  private rootLine(shape: Shape): string {
    const summary = shape.summary();
    return summary === '' ? shape.label : `${shape.label} ${summary}`;
  }

  private baseLength(row: TreeRow): number {
    return row.prefix.length + row.connector.length + row.shape.label.length;
  }
}
