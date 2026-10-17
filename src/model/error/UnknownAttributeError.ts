import { EditorError } from './EditorError';

export class UnknownAttributeError extends EditorError {
  constructor(readonly attr: string) {
    super(`unknown attribute: ${attr}`);
  }
}
