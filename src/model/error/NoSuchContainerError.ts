import { EditorError } from './EditorError';

export class NoSuchContainerError extends EditorError {
  constructor(readonly id: string) {
    super(`no such container: ${id}`);
  }
}
