import type { DocumentEvent, Shape, SvgDocument } from '../../src/api';

/** 保存点（或刚打开时）的文档状态：画布尺寸 + 每个图形的指纹。 */
interface Baseline {
  readonly width: number;
  readonly height: number;
  readonly fingerprints: ReadonlyMap<string, string>;
}

/** 与基线比较后的结果。 */
interface Difference {
  /** 与基线不同或基线里没有的图形 id。 */
  readonly modified: ReadonlySet<string>;
  /** 文档整体是否与基线不同（含删除、画布尺寸变化）。 */
  readonly documentModified: boolean;
}

const CLEAN: Difference = { modified: new Set(), documentModified: false };

/**
 * “与保存点是否一致”的状态机。状态全在实例字段里，没有任何全局或静态状态。
 *
 *   untracked ──opened──▶ tracking(baseline = 当前内容, 无差异)
 *   tracking  ──saved───▶ tracking(baseline = 当前内容, 无差异)
 *   tracking  ──edited──▶ tracking(baseline 不变, 重算差异)
 *   tracking  ──opened──▶ tracking(换成新文档的基线)
 *
 * 语义是“内容与保存点一致”而不是“有没有编辑过”：编辑之后再 undo 回保存点，标记自然消失。
 * 图形的指纹由 `attributes()`、`textContent()`、父节点 id 与在父节点中的下标组成，
 * 所以改属性、改文字、挪位置、改 z 序（下标）、换父节点都会被发现；新建的节点基线里没有，立刻带标记。
 * 标记不向祖先传播：容器只在自身指纹变化时才带标记；文档根行则在任何差异下都带标记。
 *
 * 在 `opened` 之前装入的跟踪器（没有基线）不标记任何东西，直到下一次 `opened`。
 */
export class ModificationTracker {
  private tracked: SvgDocument | undefined;
  private baseline: Baseline | undefined;
  private difference: Difference = CLEAN;

  /** 会话事件入口。 */
  onDocumentEvent(event: DocumentEvent, document: SvgDocument): void {
    switch (event) {
      case 'opened':
      case 'saved':
        this.tracked = document;
        this.baseline = ModificationTracker.snapshot(document);
        this.difference = CLEAN;
        return;
      case 'edited':
        // 没有这份文档的基线（装得太晚）：不猜测，等下一次 opened。
        if (this.baseline === undefined || this.tracked !== document) return;
        this.difference = ModificationTracker.compare(this.baseline, document);
        return;
    }
  }

  /** 这个图形是否与基线不同；不属于被跟踪文档时为 false。 */
  isModified(shape: Shape, document: SvgDocument): boolean {
    return this.tracked === document && this.difference.modified.has(shape.id);
  }

  /** 文档整体是否与基线不同；不属于被跟踪文档时为 false。 */
  isDocumentModified(document: SvgDocument): boolean {
    return this.tracked === document && this.difference.documentModified;
  }

  private static snapshot(document: SvgDocument): Baseline {
    return {
      width: document.width,
      height: document.height,
      fingerprints: ModificationTracker.fingerprints(document),
    };
  }

  private static compare(baseline: Baseline, document: SvgDocument): Difference {
    const current = ModificationTracker.fingerprints(document);
    const modified = new Set<string>();
    for (const [id, fingerprint] of current) {
      if (baseline.fingerprints.get(id) !== fingerprint) modified.add(id);
    }
    const removed = [...baseline.fingerprints.keys()].some((id) => !current.has(id));
    const resized = baseline.width !== document.width || baseline.height !== document.height;
    return { modified, documentModified: modified.size > 0 || removed || resized };
  }

  /** 文档根以下每个图形的指纹；根本身不是用户图形，不参与。 */
  private static fingerprints(document: SvgDocument): Map<string, string> {
    const result = new Map<string, string>();
    const visit = (parent: Shape): void => {
      for (const [index, child] of parent.children().entries()) {
        result.set(
          child.id,
          JSON.stringify([child.attributes(), child.textContent() ?? null, parent.id, index]),
        );
        visit(child);
      }
    };
    visit(document.root);
    return result;
  }
}
