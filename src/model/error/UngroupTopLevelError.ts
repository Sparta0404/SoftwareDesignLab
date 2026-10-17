import { EditorError } from './EditorError';

export class UngroupTopLevelError extends EditorError {
  constructor(readonly id: string) {
    super(`cannot ungroup top-level container: ${id}`);
  }
}
