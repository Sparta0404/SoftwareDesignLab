import type { SvgDocument } from '../model/document/SvgDocument';

/**
 * show 命令的纯文本渲染器。
 *
 * 图形属性由 Shape.detailLines() 自描述；这里仅添加头行和缩进。
 */
export class ShowRenderer {
  render(document: SvgDocument, id: string): string {
    const shape = document.find(id);
    const lines = [`${shape.label}  parent=${document.parentLabel(shape)}`];
    lines.push(...shape.detailLines().map((line) => `  ${line}`));
    return lines.join('\n');
  }
}
