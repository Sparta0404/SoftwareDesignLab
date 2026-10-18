import type { SvgDocument } from '../../model/document/SvgDocument';
import { Numbers } from '../../model/shape/Numbers';
import type { Shape } from '../../model/shape/Shape';
import { captureGeometry, restoreGeometry } from './CommandSnapshots';
import type { EditCommand } from '../history/EditCommand';

export class MoveCommand implements EditCommand {
  private shape: Shape | undefined;
  private before: ReturnType<typeof captureGeometry> = [];
  private originalAnchor: [number, number] | undefined;

  constructor(
    private readonly document: SvgDocument,
    private readonly id: string,
    private readonly dx: number,
    private readonly dy: number,
  ) {}

  execute(): string {
    this.shape = this.document.find(this.id);
    this.before = captureGeometry(this.shape);
    this.originalAnchor = this.shape.anchor();
    this.shape.move(this.dx, this.dy);
    return this.movedMessage();
  }

  undo(): string {
    const shape = this.requiredShape();
    restoreGeometry(this.before);
    if (this.originalAnchor !== undefined) {
      return `${shape.label} moved back to (${this.point(this.originalAnchor)})`;
    }
    return `${shape.label} moved back by (${Numbers.format(-this.dx)},${Numbers.format(-this.dy)})`;
  }

  redo(): string {
    this.requiredShape().move(this.dx, this.dy);
    return this.movedMessage();
  }

  private movedMessage(): string {
    const shape = this.requiredShape();
    const anchor = shape.anchor();
    if (anchor !== undefined) {
      return `${shape.label} moved to (${this.point(anchor)})`;
    }
    return `${shape.label} moved by (${Numbers.format(this.dx)},${Numbers.format(this.dy)})`;
  }

  private point([x, y]: readonly [number, number]): string {
    return `${Numbers.format(x)},${Numbers.format(y)}`;
  }

  private requiredShape(): Shape {
    if (this.shape === undefined) throw new Error('command has not been executed');
    return this.shape;
  }
}
