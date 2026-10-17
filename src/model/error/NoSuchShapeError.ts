import { EditorError } from './EditorError';

export class NoSuchShapeError extends EditorError {
  constructor(readonly id: string) {
    super(`no such shape: ${id}`);
  }
}
