import { InvalidValueError } from '../error/InvalidValueError';
import { NoSuchContainerError } from '../error/NoSuchContainerError';
import { NoSuchShapeError } from '../error/NoSuchShapeError';
import { NotContainerError } from '../error/NotContainerError';
import { GroupShape } from '../shape/GroupShape';
import type { Shape } from '../shape/Shape';
import { IdIndex } from './IdIndex';
import type { Placement } from './Placement';

/**
 * 一份 SVG 文档：画布尺寸 + 图形树 + id 索引。
 * 所有改变树结构的操作都经过这里，从而由文档统一维护 id 唯一性。
 */
export class SvgDocument {
  /** 根节点对应 `<svg>` 元素本身，不是用户图形，不进入 id 索引。 */
  readonly root = new GroupShape('svg');

  private readonly index = new IdIndex();
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(width = 800, height = 600) {
    SvgDocument.checkSize(width, height);
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  get width(): number {
    return this.canvasWidth;
  }

  get height(): number {
    return this.canvasHeight;
  }

  /** 修改画布尺寸；省略的维度保持不变。 */
  resize(width: number = this.canvasWidth, height: number = this.canvasHeight): void {
    SvgDocument.checkSize(width, height);
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  /** 文档中的图形总数（不含根）。 */
  get shapeCount(): number {
    return this.index.size;
  }

  has(id: string): boolean {
    return this.index.has(id);
  }

  find(id: string): Shape {
    const shape = this.index.get(id);
    if (shape === undefined) {
      throw new NoSuchShapeError(id);
    }
    return shape;
  }

  /** 查找容器：不存在或不是容器都会抛出对应错误。 */
  findContainer(id: string): Shape {
    const shape = this.index.get(id);
    if (shape === undefined) {
      throw new NoSuchContainerError(id);
    }
    if (!shape.isContainer()) {
      throw new NotContainerError(id);
    }
    return shape;
  }

  /** 把一棵子树插入到容器中并登记其全部 id；id 冲突时不改变任何状态。 */
  insert(shape: Shape, parent: Shape, index?: number): void {
    this.index.addAll(shape.walk());
    parent.insertChild(shape, index);
  }

  /** 把一棵子树从文档摘除并注销其全部 id，返回它原来的位置。 */
  detach(shape: Shape): Placement {
    const placement = this.placementOf(shape);
    placement.parent.removeChild(shape);
    this.index.removeAll(shape.walk());
    return placement;
  }

  /** 把已在文档中的图形挪到另一位置（id 登记不变）。index 指摘除后在新父节点中的下标。 */
  relocate(shape: Shape, newParent: Shape, index?: number): void {
    if (newParent === shape || newParent.isDescendantOf(shape)) {
      throw new Error(`cannot move ${shape.id} into itself`);
    }
    this.placementOf(shape).parent.removeChild(shape);
    newParent.insertChild(shape, index);
  }

  placementOf(shape: Shape): Placement {
    const parent = shape.parent;
    if (parent === null) {
      throw new Error(`shape is not attached: ${shape.id}`);
    }
    return { parent, index: parent.indexOf(shape) };
  }

  /** 父节点的显示名：根节点叫 `svg`，其余为 `tag#id`。 */
  parentLabel(shape: Shape): string {
    const parent = shape.parent;
    return parent === null || parent === this.root ? 'svg' : parent.label;
  }

  private static checkSize(width: number, height: number): void {
    if (!(width > 0) || !(height > 0)) {
      throw new InvalidValueError('canvas size must be positive');
    }
  }
}
