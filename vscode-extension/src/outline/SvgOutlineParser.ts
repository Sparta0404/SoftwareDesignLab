import { XMLValidator } from 'fast-xml-parser';
import { Parser } from 'htmlparser2';
import type { OutlineNode, OutlinePosition, OutlineRange } from './SvgOutlineNode';

interface OpenElement {
  readonly tagName: string;
  readonly label: string;
  readonly openStart: number;
  readonly nameStart: number;
  readonly nameEnd: number;
  readonly children: OutlineNode[];
}

/**
 * 把 SVG 文本解析成带源码位置的元素树。
 *
 * 供大纲点击定位使用，不引用 vscode。节点只保留标签、id 和嵌套；
 * 缺少 id 的元素保持原标签名。文本不良构，或解析过程中出现异常时，返回空数组。
 */
export class SvgOutlineParser {
  parse(text: string): OutlineNode[] {
    try {
      if (typeof text !== 'string' || text.length === 0) {
        return [];
      }
      if (XMLValidator.validate(text) !== true) {
        return [];
      }
      return buildTree(text);
    } catch {
      return [];
    }
  }
}

/**
 * htmlparser2 会补全或忽略不合法的标签，所以只有校验通过后才走这里。
 * 它给出的 endIndex 含当前字符；结束标签名和 `>` 之间可以有空白（`</g >`），
 * 这时 endIndex 停在空白上，需要再扫到真正的 `>`。
 */
function buildTree(text: string): OutlineNode[] {
  const lineStarts = lineStartOffsets(text);
  const stack: OpenElement[] = [];
  const roots: OutlineNode[] = [];
  let failed = false;

  const parser = new Parser(
    {
      onopentag(name, attributes, isImplied) {
        if (failed) return;
        const openStart = parser.startIndex;
        const nameStart = openStart + 1;
        const nameEnd = nameStart + name.length;
        if (
          isImplied ||
          openStart < 0 ||
          nameEnd > parser.endIndex ||
          text.slice(nameStart, nameEnd) !== name
        ) {
          failed = true;
          return;
        }
        stack.push({
          tagName: name,
          label: elementLabel(name, attributes),
          openStart,
          nameStart,
          nameEnd,
          children: [],
        });
      },
      onclosetag(name) {
        if (failed) return;
        const frame = stack.pop();
        const end = frame === undefined ? -1 : exclusiveTagEnd(text, parser.endIndex);
        if (frame === undefined || frame.tagName !== name || end <= frame.nameEnd) {
          failed = true;
          return;
        }
        const node: OutlineNode = {
          label: frame.label,
          range: rangeBetween(lineStarts, frame.openStart, end),
          selectionRange: rangeBetween(lineStarts, frame.nameStart, frame.nameEnd),
          children: frame.children,
        };
        const parent = stack[stack.length - 1];
        if (parent === undefined) {
          roots.push(node);
        } else {
          parent.children.push(node);
        }
      },
      onerror() {
        failed = true;
      },
    },
    { xmlMode: true },
  );

  parser.end(text);
  if (failed || stack.length > 0) {
    return [];
  }
  return roots;
}

/** 有 id 时用 `tag#id`，空 id 与缺 id 一样只保留标签名。 */
function elementLabel(tagName: string, attributes: Readonly<Record<string, string>>): string {
  const id = attributes.id;
  if (id === undefined || id.length === 0) {
    return tagName;
  }
  return `${tagName}#${id}`;
}

/** 把 htmlparser2 的含端点下标转换成排他的结束下标。找不到 `>` 时返回 -1。 */
function exclusiveTagEnd(text: string, inclusiveHint: number): number {
  if (inclusiveHint < 0 || inclusiveHint >= text.length) {
    return -1;
  }
  if (text[inclusiveHint] === '>') {
    return inclusiveHint + 1;
  }
  const closer = text.indexOf('>', inclusiveHint);
  return closer < 0 ? -1 : closer + 1;
}

/** 每行第一个字符的下标，同时认 `\n`、`\r\n` 和单独的 `\r`。 */
function lineStartOffsets(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 10) {
      starts.push(index + 1);
    } else if (code === 13) {
      if (text.charCodeAt(index + 1) === 10) {
        index += 1;
      }
      starts.push(index + 1);
    }
  }
  return starts;
}

function positionAt(lineStarts: readonly number[], offset: number): OutlinePosition {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (lineStarts[mid] <= offset) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return { line: low, character: offset - lineStarts[low] };
}

function rangeBetween(lineStarts: readonly number[], start: number, end: number): OutlineRange {
  return {
    start: positionAt(lineStarts, start),
    end: positionAt(lineStarts, end),
  };
}
