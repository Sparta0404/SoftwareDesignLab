import { EditorError } from '../../model/error/EditorError';

export class EmptyHistoryError extends EditorError {
  constructor(action: 'undo' | 'redo') {
    super(`nothing to ${action}`);
  }
}
