import { EditorError } from './EditorError';

export class EmptyHistoryError extends EditorError {
  constructor(action: 'undo' | 'redo') {
    super(`nothing to ${action}`);
  }
}
