import type { Placement } from '../../model/document/Placement';
import type { SvgDocument } from '../../model/document/SvgDocument';
import type { Shape } from '../../model/shape/Shape';
import type { EditCommand } from '../history/EditCommand';

export class DeleteCommand implements EditCommand {
  private shape: Shape | undefined;
  private placement: Placement | undefined;

  constructor(
    private readonly document: SvgDocument,
    private readonly id: string,
  ) {}

  execute(): string {
    this.shape = this.document.find(this.id);
    this.placement = this.document.detach(this.shape);
    return `${this.shape.label} deleted`;
  }

  undo(): string {
    const shape = this.requiredShape();
    const placement = this.requiredPlacement();
    this.document.insert(shape, placement.parent, placement.index);
    return `${shape.label} restored into ${this.document.parentLabel(shape)}`;
  }

  redo(): string {
    const shape = this.requiredShape();
    this.document.detach(shape);
    return `${shape.label} deleted`;
  }

  private requiredShape(): Shape {
    if (this.shape === undefined) throw new Error('command has not been executed');
    return this.shape;
  }

  private requiredPlacement(): Placement {
    if (this.placement === undefined) throw new Error('command has not been executed');
    return this.placement;
  }
}
