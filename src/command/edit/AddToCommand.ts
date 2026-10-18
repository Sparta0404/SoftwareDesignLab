import type { Placement } from '../../model/document/Placement';
import type { SvgDocument } from '../../model/document/SvgDocument';
import type { Shape } from '../../model/shape/Shape';
import { GroupIntoDescendantError } from '../error/GroupIntoDescendantError';
import type { EditCommand } from '../history/EditCommand';

export class AddToCommand implements EditCommand {
  private shape: Shape | undefined;
  private container: Shape | undefined;
  private oldPlacement: Placement | undefined;

  constructor(
    private readonly document: SvgDocument,
    private readonly containerId: string,
    private readonly shapeId: string,
  ) {}

  execute(): string {
    const container = this.document.findContainer(this.containerId);
    const shape = this.document.find(this.shapeId);
    if (container === shape || container.isDescendantOf(shape)) {
      throw new GroupIntoDescendantError(shape.id);
    }
    this.shape = shape;
    this.container = container;
    this.oldPlacement = this.document.placementOf(shape);
    this.document.relocate(shape, container);
    return `${shape.label} moved into ${container.label}`;
  }

  undo(): string {
    const shape = this.requiredShape();
    const placement = this.requiredPlacement();
    this.document.relocate(shape, placement.parent, placement.index);
    return `${shape.label} moved back to ${this.document.parentLabel(shape)}`;
  }

  redo(): string {
    const shape = this.requiredShape();
    const container = this.requiredContainer();
    this.document.relocate(shape, container);
    return `${shape.label} moved into ${container.label}`;
  }

  private requiredShape(): Shape {
    if (this.shape === undefined) throw new Error('command has not been executed');
    return this.shape;
  }

  private requiredContainer(): Shape {
    if (this.container === undefined) throw new Error('command has not been executed');
    return this.container;
  }

  private requiredPlacement(): Placement {
    if (this.oldPlacement === undefined) throw new Error('command has not been executed');
    return this.oldPlacement;
  }
}
