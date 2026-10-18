import type { SvgDocument } from '../../model/document/SvgDocument';
import { Shape } from '../../model/shape/Shape';
import type { EditCommand } from '../history/EditCommand';

export class SetAttrCommand implements EditCommand {
  private shape: Shape | undefined;
  private oldValue: string | undefined;

  constructor(
    private readonly document: SvgDocument,
    private readonly id: string,
    private readonly name: string,
    private readonly value: string,
  ) {}

  execute(): string {
    this.shape = this.document.find(this.id);
    // getAttr 同时完成白名单校验；必须在写入前执行。
    this.oldValue = this.shape.getAttr(this.name);
    this.shape.setAttr(this.name, this.value);
    return this.updatedMessage();
  }

  undo(): string {
    const shape = this.requiredShape();
    if (this.oldValue === undefined && Shape.STYLE_ATTRS.includes(this.name)) {
      shape.unsetAttr(this.name);
    } else {
      shape.setAttr(this.name, this.oldValue as string);
    }
    return this.updatedMessage();
  }

  redo(): string {
    this.requiredShape().setAttr(this.name, this.value);
    return this.updatedMessage();
  }

  private updatedMessage(): string {
    const shape = this.requiredShape();
    return `${shape.label} updated: ${shape.attrDisplay(this.name)}`;
  }

  private requiredShape(): Shape {
    if (this.shape === undefined) throw new Error('command has not been executed');
    return this.shape;
  }
}
