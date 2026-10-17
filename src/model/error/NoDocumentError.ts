import { EditorError } from './EditorError';

export class NoDocumentError extends EditorError {
  constructor() {
    super("no document. use 'init' or 'read' first");
  }
}
