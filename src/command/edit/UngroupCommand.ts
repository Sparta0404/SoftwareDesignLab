import type { Placement } from '../../model/document/Placement';
import type { SvgDocument } from '../../model/document/SvgDocument';
import type { Shape } from '../../model/shape/Shape';
import { UngroupCompositeError } from '../error/UngroupCompositeError';
import { UngroupTopLevelError } from '../error/UngroupTopLevelError';
import type { EditCommand } from '../history/EditCommand';

export class UngroupCommand implements EditCommand {
  private group: Shape | undefined;
  private children: Shape[] = [];
  private placement: Placement | undefined;

  constructor(
    private readonly document: SvgDocument,
    private readonly id: string,
  ) {}

  execute(): string {
    const group = this.document.findContainer(this.id);
    if (group.isComposite()) {
      throw new UngroupCompositeError(group.id);
    }
    const placement = this.document.placementOf(group);
    if (placement.parent === this.document.root) {
      throw new UngroupTopLevelError(group.id);
    }
    this.group = group;
    this.children = [...group.children()];
    this.placement = placement;
    this.applyUngroup();
    return `${group.label} ungrouped`;
  }

  undo(): string {
    const group = this.requiredGroup();
    const placement = this.requiredPlacement();
    for (const child of this.children) {
      this.document.detach(child);
    }
    this.document.insert(group, placement.parent, placement.index);
    for (const child of this.children) {
      this.document.insert(child, group);
    }
    return `${group.label} restored with ${this.children.length} children`;
  }

  redo(): string {
    const group = this.requiredGroup();
    this.applyUngroup();
    return `${group.label} ungrouped`;
  }

  private applyUngroup(): void {
    const group = this.requiredGroup();
    const placement = this.requiredPlacement();
    this.document.detach(group);
    for (const child of this.children) {
      group.removeChild(child);
    }
    this.children.forEach((child, offset) => {
      this.document.insert(child, placement.parent, placement.index + offset);
    });
  }

  private requiredGroup(): Shape {
    if (this.group === undefined) throw new Error('command has not been executed');
    return this.group;
  }

  private requiredPlacement(): Placement {
    if (this.placement === undefined) throw new Error('command has not been executed');
    return this.placement;
  }
}
