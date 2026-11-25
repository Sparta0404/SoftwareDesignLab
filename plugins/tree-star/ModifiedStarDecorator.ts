import type { DocumentEvent, SvgDocument, TreeDecorator, TreeNodeInfo } from '../../src/api';
import { ModificationTracker } from './ModificationTracker';

/** 在与保存点不一致的行尾追加 `*`；状态由自己的 ModificationTracker 维护，经会话事件更新。 */
export class ModifiedStarDecorator implements TreeDecorator {
  readonly name = 'modified-star';
  private readonly tracker = new ModificationTracker();

  decorate(node: TreeNodeInfo): string | undefined {
    const modified = node.isDocumentRoot
      ? this.tracker.isDocumentModified(node.document)
      : this.tracker.isModified(node.shape, node.document);
    return modified ? '*' : undefined;
  }

  onDocumentEvent(event: DocumentEvent, document: SvgDocument): void {
    this.tracker.onDocumentEvent(event, document);
  }
}
