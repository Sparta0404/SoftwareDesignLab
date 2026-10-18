import type { SvgDocument } from '../model/document/SvgDocument';
import { Numbers } from '../model/shape/Numbers';
import type { Shape } from '../model/shape/Shape';

/**
 * 通用 SVG 序列化器。
 *
 * 只读取 Shape 的自描述接口，不 import 或判断任何具体图形类型。
 */
export class SvgSerializer {
  serialize(document: SvgDocument): string {
    const width = Numbers.format(document.width);
    const height = Numbers.format(document.height);
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    ];
    for (const shape of document.root.children()) {
      lines.push(...this.serializeShape(shape, 1));
    }
    lines.push('</svg>', '');
    return lines.join('\n');
  }

  private serializeShape(shape: Shape, depth: number): string[] {
    const indent = '  '.repeat(depth);
    const attributes = shape
      .attributes()
      .map(([name, value]) => `${name}="${this.escapeAttribute(value)}"`)
      .join(' ');
    const opening = attributes.length === 0 ? `<${shape.tagName}` : `<${shape.tagName} ${attributes}`;
    const children = shape.children();
    const text = shape.textContent();

    if (children.length === 0 && text === undefined) {
      return [`${indent}${opening}/>`];
    }
    if (children.length === 0) {
      return [`${indent}${opening}>${this.escapeText(text as string)}</${shape.tagName}>`];
    }

    const lines = [`${indent}${opening}>`];
    for (const child of children) {
      lines.push(...this.serializeShape(child, depth + 1));
    }
    lines.push(`${indent}</${shape.tagName}>`);
    return lines;
  }

  private escapeAttribute(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  private escapeText(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }
}
