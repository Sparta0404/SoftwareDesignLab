import { EditorError } from './EditorError';

export class IdExistsError extends EditorError {
  constructor(readonly id: string) {
    super(`id already exists: ${id}`);
  }
}
