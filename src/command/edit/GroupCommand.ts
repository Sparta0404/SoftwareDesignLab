import type { Placement } from '../../model/document/Placement';
import type { SvgDocument } from '../../model/document/SvgDocument';
import { IdExistsError } from '../../model/error/IdExistsError';
import { EditorError } from '../../model/error/EditorError';
import { GroupShape } from '../../model/shape/GroupShape';
import type { Shape } from '../../model/shape/Shape';
import { GroupIntoDescendantError } from '../error/GroupIntoDescendantError';
import type { EditCommand } from '../history/EditCommand';

interface SelectedShape {
  readonly shape: Shape;
  readonly placement: Placement;
}

export class GroupCommand implements EditCommand {
  private readonly group: GroupShape;
  private selected: SelectedShape[] = [];
  private groupPlacement: Placement | undefined;

  constructor(
    private readonly document: SvgDocument,
    groupId: string,
    private readonly ids: readonly string[],
  ) {
    this.group = new GroupShape(groupId);
  }

  execute(): string {
    this.validateAndCapture();
    this.applyGroup();
    return this.createdMessage();
  }

  undo(): string {
    this.document.detach(this.group);
    for (const item of this.selected) {
      this.group.removeChild(item.shape);
    }
    // selected 已按文档先序排列；同一父节点的原索引也必然升序。
    for (const item of this.selected) {
      this.document.insert(item.shape, item.placement.parent, item.placement.index);
    }
    return `${this.group.displayLabel} ungrouped`;
  }

  redo(): string {
    this.applyGroup();
    return this.createdMessage();
  }

  private validateAndCapture(): void {
    if (this.document.has(this.group.id)) {
      throw new IdExistsError(this.group.id);
    }
    const seen = new Set<string>();
    const shapes: Shape[] = [];
    for (const id of this.ids) {
      if (seen.has(id)) {
        throw new EditorError(`duplicate shape id: ${id}`);
      }
      seen.add(id);
      shapes.push(this.document.find(id));
    }
    if (shapes.length === 0) {
      throw new EditorError('group requires at least one shape');
    }

    for (const ancestor of shapes) {
      if (shapes.some((other) => other !== ancestor && other.isDescendantOf(ancestor))) {
        throw new GroupIntoDescendantError(ancestor.id);
      }
    }

    const order = new Map(this.document.root.walk().map((shape, index) => [shape, index]));
    shapes.sort((a, b) => (order.get(a) as number) - (order.get(b) as number));
    this.selected = shapes.map((shape) => ({
      shape,
      placement: this.document.placementOf(shape),
    }));
    this.groupPlacement = this.selected[0].placement;
  }

  private applyGroup(): void {
    const placement = this.requiredGroupPlacement();
    const moved: SelectedShape[] = [];
    try {
      for (const item of this.selected) {
        // detach 经过父节点的 removeChild，复合图形可能在此拒绝；失败时该图形仍在原处。
        this.document.detach(item.shape);
        this.group.insertChild(item.shape);
        moved.push(item);
      }
    } catch (error) {
      this.putBack(moved);
      throw error;
    }
    this.document.insert(this.group, placement.parent, placement.index);
  }

  /** 中途失败时把已经搬进新组的图形按原下标放回，使整条命令保持原子。 */
  private putBack(moved: readonly SelectedShape[]): void {
    for (const item of moved) {
      this.group.removeChild(item.shape);
    }
    for (const item of moved) {
      this.document.insert(item.shape, item.placement.parent, item.placement.index);
    }
  }

  private createdMessage(): string {
    return `${this.group.displayLabel} created with ${this.selected.length} children`;
  }

  private requiredGroupPlacement(): Placement {
    if (this.groupPlacement === undefined) throw new Error('command has not been executed');
    return this.groupPlacement;
  }
}
