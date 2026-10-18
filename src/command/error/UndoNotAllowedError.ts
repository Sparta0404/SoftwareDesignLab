import { EditorError } from '../../model/error/EditorError';

export class UndoNotAllowedError extends EditorError {
  constructor() {
    super('undo not allowed after io command');
  }
}
