import { IdExistsError } from '../error/IdExistsError';
import type { Shape } from '../shape/Shape';

/** id -> 图形 的索引，保证文档内 id 唯一。 */
export class IdIndex {
  private readonly shapes = new Map<string, Shape>();

  get size(): number {
    return this.shapes.size;
  }

  has(id: string): boolean {
    return this.shapes.has(id);
  }

  get(id: string): Shape | undefined {
    return this.shapes.get(id);
  }

  /** 登记一批图形；任何一个 id 冲突（含批内重复）则整体不登记。 */
  addAll(shapes: readonly Shape[]): void {
    const seen = new Set<string>();
    for (const shape of shapes) {
      if (this.shapes.has(shape.id) || seen.has(shape.id)) {
        throw new IdExistsError(shape.id);
      }
      seen.add(shape.id);
    }
    for (const shape of shapes) {
      this.shapes.set(shape.id, shape);
    }
  }

  removeAll(shapes: readonly Shape[]): void {
    for (const shape of shapes) {
      this.shapes.delete(shape.id);
    }
  }
}
