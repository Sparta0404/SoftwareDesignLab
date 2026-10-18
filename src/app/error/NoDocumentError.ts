import { EditorError } from '../../model/error/EditorError';

export class NoDocumentError extends EditorError {
  constructor() {
    super("no document. use 'init' or 'read' first");
  }
}
