import { EditorError } from './EditorError';

export class UngroupCompositeError extends EditorError {
  constructor(readonly id: string) {
    super(`cannot ungroup composite shape: ${id}`);
  }
}
