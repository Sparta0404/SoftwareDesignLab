import type { SvgDocument } from '../../model/document/SvgDocument';
import { ContractViolationError } from '../../model/error/ContractViolationError';
import { Shape, type ShapeState } from '../../model/shape/Shape';
import type { AttributeHandler, AttributeOutcome } from '../attribute/AttributeHandler';
import type { AttributeHandlerRegistry } from '../attribute/AttributeHandlerRegistry';
import { AttributeHandlerConflictError } from '../error/AttributeHandlerConflictError';
import type { EditCommand } from '../history/EditCommand';

/** 属性处理器接管的一次修改：对整棵子树前后各做一次备忘录。 */
interface HandledEdit {
  readonly nodes: readonly Shape[];
  readonly before: readonly ShapeState[];
  readonly after: readonly ShapeState[];
  readonly outcome: AttributeOutcome;
}

/**
 * `set` 命令。
 *
 * - 没有任何属性处理器声明处理该 (图形, 属性)：走 Phase 1 的默认路径（白名单 + 单属性撤销）；
 * - 恰有一个处理器命中：整棵子树做备忘录，处理器出错则整体回滚、原样抛出，
 *   undo / redo 靠快照整体恢复，天然是一个撤销单元；
 * - 两个及以上命中：冲突，拒绝执行。
 */
export class SetAttrCommand implements EditCommand {
  private shape: Shape | undefined;
  private oldValue: string | undefined;
  private handled: HandledEdit | undefined;

  constructor(
    private readonly document: SvgDocument,
    private readonly id: string,
    private readonly name: string,
    private readonly value: string,
    private readonly handlers?: AttributeHandlerRegistry,
  ) {}

  execute(): string {
    const shape = this.document.find(this.id);
    const matched = this.handlers?.matching(shape, this.name) ?? [];
    if (matched.length > 1) {
      throw new AttributeHandlerConflictError(
        shape.id,
        this.name,
        matched.map((handler) => handler.name),
      );
    }
    this.shape = shape;
    if (matched.length === 1) {
      return this.executeHandled(shape, matched[0]);
    }
    // getAttr 同时完成白名单校验；必须在写入前执行。
    this.oldValue = shape.getAttr(this.name);
    shape.setAttr(this.name, this.value);
    return this.updatedMessage();
  }

  undo(): string {
    if (this.handled !== undefined) {
      this.restore(this.handled.nodes, this.handled.before);
      return this.handled.outcome.undoMessage;
    }
    const shape = this.requiredShape();
    if (this.oldValue === undefined && Shape.STYLE_ATTRS.includes(this.name)) {
      shape.unsetAttr(this.name);
    } else {
      shape.setAttr(this.name, this.oldValue as string);
    }
    return this.updatedMessage();
  }

  redo(): string {
    if (this.handled !== undefined) {
      this.restore(this.handled.nodes, this.handled.after);
      return this.handled.outcome.message;
    }
    this.requiredShape().setAttr(this.name, this.value);
    return this.updatedMessage();
  }

  private executeHandled(shape: Shape, handler: AttributeHandler): string {
    const nodes = shape.walk();
    const layout = nodes.map((node) => [...node.children()]);
    const before = nodes.map((node) => node.captureState());

    let outcome: AttributeOutcome;
    try {
      outcome = handler.apply(shape, this.name, this.value);
    } catch (error) {
      this.restore(nodes, before);
      throw error;
    }

    if (!this.sameStructure(nodes, layout, shape)) {
      this.restoreStructure(nodes, layout);
      this.restore(nodes, before);
      throw new ContractViolationError(
        `attribute handler ${handler.name} changed the structure of ${shape.displayLabel}`,
      );
    }
    this.handled = { nodes, before, after: nodes.map((node) => node.captureState()), outcome };
    return outcome.message;
  }

  private restore(nodes: readonly Shape[], states: readonly ShapeState[]): void {
    nodes.forEach((node, index) => node.restoreState(states[index]));
  }

  private sameStructure(
    nodes: readonly Shape[],
    layout: ReadonlyArray<readonly Shape[]>,
    root: Shape,
  ): boolean {
    const now = root.walk();
    if (now.length !== nodes.length || now.some((node, index) => node !== nodes[index])) {
      return false;
    }
    return nodes.every((node, index) => {
      const children = node.children();
      return (
        children.length === layout[index].length &&
        children.every((child, at) => child === layout[index][at])
      );
    });
  }

  /** 尽力把被处理器改动的子树结构放回去；放不回去的部分保持现状（这是处理器自己的 bug）。 */
  private restoreStructure(
    nodes: readonly Shape[],
    layout: ReadonlyArray<readonly Shape[]>,
  ): void {
    nodes.forEach((node, index) => {
      for (const child of [...node.children()]) {
        if (!layout[index].includes(child)) this.attempt(() => node.removeChild(child));
      }
    });
    nodes.forEach((node, index) => {
      layout[index].forEach((child, at) => {
        if (!node.children().includes(child)) this.attempt(() => node.insertChild(child, at));
      });
    });
  }

  private attempt(action: () => unknown): void {
    try {
      action();
    } catch {
      // 回滚是尽力而为；原始的契约违反错误会被照常抛出。
    }
  }

  private updatedMessage(): string {
    const shape = this.requiredShape();
    return `${shape.displayLabel} updated: ${shape.attrDisplay(this.name)}`;
  }

  private requiredShape(): Shape {
    if (this.shape === undefined) throw new Error('command has not been executed');
    return this.shape;
  }
}
