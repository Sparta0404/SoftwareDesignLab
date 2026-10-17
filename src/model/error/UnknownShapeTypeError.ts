import { EditorError } from './EditorError';

export class UnknownShapeTypeError extends EditorError {
  constructor(readonly typeName: string) {
    super(`unknown shape type: ${typeName} (is the plugin loaded?)`);
  }
}
