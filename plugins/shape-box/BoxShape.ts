import { ContractViolationError, EditorError, GroupShape, type Shape } from '../../src/api';

/** 试图把 box 的必要子部件（矩形或标题文字）摘走时抛出，保持 box 的不变量。 */
export class BoxPartRequiredError extends EditorError {
  constructor(partId: string, boxLabel: string) {
    super(`cannot detach ${partId} from ${boxLabel}`);
  }
}

/** 序列化时写在 `<g>` 上的类型标记：`data-kind="box"`。 */
export const BOX_KIND_ATTRIBUTE = 'data-kind';
export const BOX_KIND = 'box';

export type BoxPart = 'rect' | 'label';

/**
 * 带标题的矩形框（Composite 模式中的复合节点）。
 *
 * 结构：一个 `<g data-kind="box">`，前两个子节点是派生 id 的矩形 `<id>-rect` 与文字 `<id>-label`，
 * 之后还可以再放任意子图形（含嵌套的 box）。它仍是容器，所以 move / scale / delete / group
 * 全部沿用 GroupShape 的递归语义；box 只额外承担三件事：
 * - 回显名为 `box#<id>`（树与 show 仍用 `g#<id>`，与 SVG 标签一致）；
 * - 保护两个必要子部件，不允许被摘走（delete / addto / group / 前后置都会经过 `removeChild`）；
 * - 序列化时带上 `data-kind="box"`，读回时由提供者凭它还原。
 */
export class BoxShape extends GroupShape {
  static rectId(boxId: string): string {
    return `${boxId}-rect`;
  }

  static labelId(boxId: string): string {
    return `${boxId}-label`;
  }

  get rectId(): string {
    return BoxShape.rectId(this.id);
  }

  get labelId(): string {
    return BoxShape.labelId(this.id);
  }

  override get displayLabel(): string {
    return `box#${this.id}`;
  }

  override isComposite(): boolean {
    return true;
  }

  override creationNote(): string {
    return `(g#${this.id} + rect#${this.rectId} + text#${this.labelId})`;
  }

  /** 内部矩形或标题文字；box 缺少它说明不变量已被破坏。 */
  part(part: BoxPart): Shape {
    const id = part === 'rect' ? this.rectId : this.labelId;
    const found = this.children().find((child) => child.id === id);
    if (found === undefined) {
      throw new ContractViolationError(`${this.displayLabel} lost its part ${id}`);
    }
    return found;
  }

  override attributes(): Array<[string, string]> {
    const [first, ...rest] = super.attributes();
    return [first, [BOX_KIND_ATTRIBUTE, BOX_KIND], ...rest];
  }

  override removeChild(child: Shape): number {
    if (child.id === this.rectId || child.id === this.labelId) {
      throw new BoxPartRequiredError(child.id, this.displayLabel);
    }
    return super.removeChild(child);
  }
}
