import {
  EditorError,
  InvalidArgumentsError,
  Numbers,
  Shape,
  type ShapeBuilder,
  type ShapeProvider,
} from '../../src/api';
import { BOX_KIND, BOX_KIND_ATTRIBUTE, BoxShape } from './BoxShape';

/** 子部件模板：矩形默认填充色与文字相对矩形左边/垂直中线的偏移（居中靠模板，不靠手算）。 */
export const DEFAULT_BOX_FILL = '#4a90d9';
const LABEL_OFFSET_X = 20;
const LABEL_BASELINE_OFFSET_Y = 5;

/** 读入的 `<g data-kind="box">` 结构不完整或类型错误时抛出：整个读入被拒绝。 */
export class InvalidBoxError extends EditorError {
  constructor(id: string, reason: string) {
    super(`invalid box: ${id} (${reason})`);
  }
}

/**
 * box 的 ShapeProvider：负责 create 与读回。
 * 内部的 rect / text 都通过内核提供的 ShapeBuilder 创建，不 import 任何内置图形。
 */
export class BoxProvider implements ShapeProvider {
  readonly typeName = BOX_KIND;
  readonly usage = 'create box <id> <x> <y> <w> <h> "<title>"';

  fromArgs(id: string, args: readonly string[], builder: ShapeBuilder): Shape {
    if (args.length !== 5) {
      throw new InvalidArgumentsError(`usage: ${this.usage}`);
    }
    const [x, y, , h] = args.slice(0, 4).map((arg) => Numbers.parse(arg));
    const title = args[4];
    // 先造全部部件再组装：任何一步失败都不会留下半成品（box 只存在于内存，尚未进入文档）。
    const rect = builder.create('rect', BoxShape.rectId(id), [...args.slice(0, 4), DEFAULT_BOX_FILL]);
    const label = builder.create('text', BoxShape.labelId(id), [
      Numbers.format(x + LABEL_OFFSET_X),
      Numbers.format(y + h / 2 + LABEL_BASELINE_OFFSET_Y),
      title,
    ]);
    const box = new BoxShape(id);
    box.insertChild(rect);
    box.insertChild(label);
    return box;
  }

  matches(tag: string, attrs: ReadonlyMap<string, string>): boolean {
    return tag === 'g' && attrs.get(BOX_KIND_ATTRIBUTE) === BOX_KIND;
  }

  fromSvgTree(
    id: string,
    attrs: ReadonlyMap<string, string>,
    _text: string,
    children: readonly Shape[],
  ): Shape {
    this.requirePart(id, children, BoxShape.rectId(id), 'rect');
    this.requirePart(id, children, BoxShape.labelId(id), 'text');
    const box = new BoxShape(id);
    for (const [name, value] of attrs) {
      if (name === BOX_KIND_ATTRIBUTE) continue; // 由 BoxShape 自己序列化，不当成未知属性保存。
      if (Shape.STYLE_ATTRS.includes(name)) {
        box.setAttr(name, value);
      } else {
        box.setExtra(name, value);
      }
    }
    // 保持文档顺序（含用户后来放进 box 的其他子图形）。
    for (const child of children) {
      box.insertChild(child);
    }
    return box;
  }

  private requirePart(
    boxId: string,
    children: readonly Shape[],
    partId: string,
    tagName: string,
  ): void {
    const part = children.find((child) => child.id === partId);
    if (part === undefined) {
      throw new InvalidBoxError(boxId, `missing ${tagName} ${partId}`);
    }
    if (part.tagName !== tagName) {
      throw new InvalidBoxError(boxId, `${partId} must be <${tagName}>, found <${part.tagName}>`);
    }
  }
}
