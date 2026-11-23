import { describe, expect, it, vi } from 'vitest';
import type { CancellationToken, DocumentSymbol, TextDocument } from 'vscode';
import { SymbolKind } from 'vscode';
import { SvgDocumentSymbolProvider } from '../../src/outline/SvgDocumentSymbolProvider';

vi.mock('vscode', () => {
  class Range {
    constructor(
      readonly startLine: number,
      readonly startCharacter: number,
      readonly endLine: number,
      readonly endCharacter: number,
    ) {}
  }

  class DocumentSymbol {
    children: DocumentSymbol[] = [];

    constructor(
      readonly name: string,
      readonly detail: string,
      readonly kind: number,
      readonly range: Range,
      readonly selectionRange: Range,
    ) {}
  }

  return {
    SymbolKind: { Namespace: 2, Field: 7 },
    Range,
    DocumentSymbol,
  };
});

interface SymbolView {
  name: string;
  detail: string;
  kind: number;
  range: readonly [number, number, number, number];
  selectionRange: readonly [number, number, number, number];
  children: SymbolView[];
}

function document(text: string): TextDocument {
  return { getText: () => text } as TextDocument;
}

function token(cancelled = false): CancellationToken {
  return { isCancellationRequested: cancelled } as CancellationToken;
}

function view(symbols: readonly DocumentSymbol[]): SymbolView[] {
  return symbols.map((symbol) => {
    const range = symbol.range as unknown as {
      startLine: number;
      startCharacter: number;
      endLine: number;
      endCharacter: number;
    };
    const selection = symbol.selectionRange as unknown as typeof range;
    return {
      name: symbol.name,
      detail: symbol.detail,
      kind: symbol.kind,
      range: [range.startLine, range.startCharacter, range.endLine, range.endCharacter],
      selectionRange: [
        selection.startLine,
        selection.startCharacter,
        selection.endLine,
        selection.endCharacter,
      ],
      children: view(symbol.children),
    };
  });
}

describe('SvgDocumentSymbolProvider', () => {
  const provider = new SvgDocumentSymbolProvider();

  it('把嵌套元素转成层级符号，容器与叶子使用不同 SymbolKind', () => {
    const text = [
      '<svg>',
      '  <g id="outer">',
      '    <g>',
      '      <rect id="start" x="0" y="0" width="10" height="10"/>',
      '    </g>',
      '  </g>',
      '  <text>label</text>',
      '</svg>',
    ].join('\n');

    const symbols = view(provider.provideDocumentSymbols(document(text), token()));

    expect(symbols).toEqual([
      {
        name: 'svg',
        detail: '',
        kind: SymbolKind.Namespace,
        range: [0, 0, 7, 6],
        selectionRange: [0, 1, 0, 4],
        children: [
          {
            name: 'g#outer',
            detail: '',
            kind: SymbolKind.Namespace,
            range: [1, 2, 5, 6],
            selectionRange: [1, 3, 1, 4],
            children: [
              {
                name: 'g',
                detail: '',
                kind: SymbolKind.Namespace,
                range: [2, 4, 4, 8],
                selectionRange: [2, 5, 2, 6],
                children: [
                  {
                    name: 'rect#start',
                    detail: '',
                    kind: SymbolKind.Field,
                    range: [3, 6, 3, 59],
                    selectionRange: [3, 7, 3, 11],
                    children: [],
                  },
                ],
              },
            ],
          },
          {
            name: 'text',
            detail: '',
            kind: SymbolKind.Field,
            range: [6, 2, 6, 20],
            selectionRange: [6, 3, 6, 7],
            children: [],
          },
        ],
      },
    ]);
  });

  it('没有子元素的根也按叶子处理，连续调用不保留上一次结果', () => {
    const first = view(
      provider.provideDocumentSymbols(document('<svg/>'), token()),
    );
    const second = view(
      provider.provideDocumentSymbols(document('<svg><circle id="end"/></svg>'), token()),
    );

    expect(first).toEqual([
      {
        name: 'svg',
        detail: '',
        kind: SymbolKind.Field,
        range: [0, 0, 0, 6],
        selectionRange: [0, 1, 0, 4],
        children: [],
      },
    ]);
    expect(second[0].kind).toBe(SymbolKind.Namespace);
    expect(second[0].children.map((child) => [child.name, child.kind])).toEqual([
      ['circle#end', SymbolKind.Field],
    ]);
  });

  it('已取消或不完整 XML 返回空数组且不抛错', () => {
    const broken = '<svg><rect>';

    expect(() => provider.provideDocumentSymbols(document(broken), token())).not.toThrow();
    expect(provider.provideDocumentSymbols(document(broken), token())).toEqual([]);
    expect(provider.provideDocumentSymbols(document('<svg/>'), token(true))).toEqual([]);
  });
});
