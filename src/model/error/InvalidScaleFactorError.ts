import { EditorError } from './EditorError';

export class InvalidScaleFactorError extends EditorError {
  constructor() {
    super('scale factor must be positive');
  }
}
