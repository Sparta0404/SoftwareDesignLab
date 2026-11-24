import type { SvgDocument } from '../../model/document/SvgDocument';
import { NotContainerError } from '../../model/error/NotContainerError';
import type { Shape } from '../../model/shape/Shape';
import type { EditCommand } from '../history/EditCommand';

export class CreateCommand implements EditCommand {
  private index: number | undefined;

  constructor(
    private readonly document: SvgDocument,
    private readonly shape: Shape,
    private readonly parent: Shape = document.root,
  ) {}

  execute(): string {
    this.validateParent();
    this.index = this.parent.children().length;
    this.document.insert(this.shape, this.parent, this.index);
    return this.createdMessage();
  }

  undo(): string {
    this.document.detach(this.shape);
    return `${this.shape.displayLabel} deleted`;
  }

  redo(): string {
    this.validateParent();
    this.document.insert(this.shape, this.parent, this.index);
    return this.createdMessage();
  }

  private validateParent(): void {
    if (!this.parent.isContainer()) {
      throw new NotContainerError(this.parent.id);
    }
  }

  private createdMessage(): string {
    const base =
      this.parent === this.document.root
        ? `${this.shape.displayLabel} created`
        : `${this.shape.displayLabel} created in ${this.parent.displayLabel}`;
    const note = this.shape.creationNote();
    return note === undefined ? base : `${base} ${note}`;
  }
}
