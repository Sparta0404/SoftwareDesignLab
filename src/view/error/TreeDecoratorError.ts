import { EditorError } from '../../model/error/EditorError';

/** 某个树装饰器在渲染时抛错。 */
export class TreeDecoratorError extends EditorError {
  constructor(decoratorName: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`tree decorator failed: ${decoratorName} (${reason})`);
  }
}
