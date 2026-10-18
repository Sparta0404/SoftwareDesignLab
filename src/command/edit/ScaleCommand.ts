import type { SvgDocument } from '../../model/document/SvgDocument';
import { Numbers } from '../../model/shape/Numbers';
import type { Shape } from '../../model/shape/Shape';
import { InvalidScaleFactorError } from '../error/InvalidScaleFactorError';
import type { EditCommand } from '../history/EditCommand';
import { captureGeometry, restoreGeometry } from './CommandSnapshots';

export class ScaleCommand implements EditCommand {
  private shape: Shape | undefined;
  private before: ReturnType<typeof captureGeometry> = [];

  constructor(
    private readonly document: SvgDocument,
    private readonly id: string,
    private readonly factor: number,
  ) {}

  execute(): string {
    if (!(this.factor > 0) || !Number.isFinite(this.factor)) {
      throw new InvalidScaleFactorError();
    }
    this.shape = this.document.find(this.id);
    this.before = captureGeometry(this.shape);
    this.shape.scale(this.factor);
    return this.scaledMessage();
  }

  undo(): string {
    const shape = this.requiredShape();
    restoreGeometry(this.before);
    return `${shape.label} scale restored`;
  }

  redo(): string {
    this.requiredShape().scale(this.factor);
    return this.scaledMessage();
  }

  private scaledMessage(): string {
    return `${this.requiredShape().label} scaled by ${Numbers.format(this.factor)}`;
  }

  private requiredShape(): Shape {
    if (this.shape === undefined) throw new Error('command has not been executed');
    return this.shape;
  }
}
