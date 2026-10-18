import type { SvgDocument } from '../../model/document/SvgDocument';
import type { Shape } from '../../model/shape/Shape';
import type { EditCommand } from '../history/EditCommand';

export type ZOrderDirection = 'front' | 'back';

export class ZOrderCommand implements EditCommand {
  private shape: Shape | undefined;
  private parent: Shape | undefined;
  private oldIndex: number | undefined;

  constructor(
    private readonly document: SvgDocument,
    private readonly id: string,
    private readonly direction: ZOrderDirection,
  ) {}

  execute(): string {
    const shape = this.document.find(this.id);
    const placement = this.document.placementOf(shape);
    this.shape = shape;
    this.parent = placement.parent;
    this.oldIndex = placement.index;
    this.applyDirection();
    return `${shape.label} moved to ${this.direction}`;
  }

  undo(): string {
    const shape = this.requiredShape();
    this.document.relocate(shape, this.requiredParent(), this.requiredOldIndex());
    return `${shape.label} z-order restored`;
  }

  redo(): string {
    const shape = this.requiredShape();
    this.applyDirection();
    return `${shape.label} moved to ${this.direction}`;
  }

  private applyDirection(): void {
    const shape = this.requiredShape();
    const parent = this.requiredParent();
    const index = this.direction === 'back' ? 0 : parent.children().length;
    this.document.relocate(shape, parent, index);
  }

  private requiredShape(): Shape {
    if (this.shape === undefined) throw new Error('command has not been executed');
    return this.shape;
  }

  private requiredParent(): Shape {
    if (this.parent === undefined) throw new Error('command has not been executed');
    return this.parent;
  }

  private requiredOldIndex(): number {
    if (this.oldIndex === undefined) throw new Error('command has not been executed');
    return this.oldIndex;
  }
}
