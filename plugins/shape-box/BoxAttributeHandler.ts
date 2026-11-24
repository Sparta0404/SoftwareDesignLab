import type { AttributeHandler, AttributeOutcome, Shape } from '../../src/api';
import { BoxShape } from './BoxShape';

/** box 上 `fill` 与 `label` 的领域语义。 */
export const BOX_FILL = 'fill';
export const BOX_LABEL = 'label';

/**
 * box 的 AttributeHandler：
 * - `fill`  传播到内部矩形（沿用已有属性名，但语义是“框体的填充色”）；
 * - `label` 是 box 的便捷属性，改写内部标题文字的内容，不进入内核白名单。
 *
 * 处理器只通过 Shape 公开的方法修改已有子部件；撤销、重做与失败回滚由内核对子树的备忘录完成，
 * 所以这里只需要给出回显文案。
 */
export class BoxAttributeHandler implements AttributeHandler {
  readonly name = 'box-attributes';

  handles(target: Shape, attr: string): boolean {
    return target instanceof BoxShape && (attr === BOX_FILL || attr === BOX_LABEL);
  }

  apply(target: Shape, attr: string, value: string): AttributeOutcome {
    if (!(target instanceof BoxShape)) {
      throw new Error(`box-attributes cannot handle ${target.label}`);
    }
    return attr === BOX_FILL ? this.applyFill(target, value) : this.applyLabel(target, value);
  }

  private applyFill(box: BoxShape, value: string): AttributeOutcome {
    const rect = box.part('rect');
    const previous = rect.getAttr(BOX_FILL);
    rect.setAttr(BOX_FILL, value);
    return {
      message: `${box.displayLabel} fill propagated to ${rect.id}`,
      undoMessage: `${box.displayLabel} fill restored: ${previous ?? '(unset)'}`,
    };
  }

  private applyLabel(box: BoxShape, value: string): AttributeOutcome {
    const text = box.part('label');
    const previous = text.getAttr('text');
    text.setAttr('text', value);
    return {
      message: `${box.displayLabel} label updated: "${value}"`,
      undoMessage: `${box.displayLabel} label restored: "${previous}"`,
    };
  }
}
