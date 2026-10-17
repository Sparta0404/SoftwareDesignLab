import { EditorError } from './EditorError';

export class NotContainerError extends EditorError {
  constructor(readonly id: string) {
    super(`not a container: ${id}`);
  }
}
