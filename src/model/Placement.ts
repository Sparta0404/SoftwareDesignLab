import type { Shape } from './Shape';

/** 图形在树中的位置：所属父节点 + 在父节点子列表中的下标。 */
export interface Placement {
  readonly parent: Shape;
  readonly index: number;
}
