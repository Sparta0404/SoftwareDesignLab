import { EditorError } from '../../model/error/EditorError';

/** 两个及以上属性处理器同时声明处理同一个 (图形, 属性)。 */
export class AttributeHandlerConflictError extends EditorError {
  constructor(shapeId: string, attr: string, handlerNames: readonly string[]) {
    super(
      `attribute handler conflict: ${shapeId}.${attr} is claimed by ${handlerNames.join(', ')}`,
    );
  }
}
