import type { TreeDecorator, TreeNodeInfo } from '../../src/api';
import { BoxShape } from './BoxShape';

/** 给 box 容器行追加类型标注 `(box)`，其余行不加；无状态，不关心文档事件。 */
export class BoxTypeLabelDecorator implements TreeDecorator {
  readonly name = 'box-type-label';

  decorate(node: TreeNodeInfo): string | undefined {
    return node.shape instanceof BoxShape ? '(box)' : undefined;
  }
}
