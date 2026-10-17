import { EditorError } from './EditorError';

export class GroupIntoDescendantError extends EditorError {
  /** @param id 作为祖先的那个容器的 id */
  constructor(readonly id: string) {
    super(`cannot group a container into its own descendant: ${id}`);
  }
}
