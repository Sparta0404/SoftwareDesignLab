import * as vscode from 'vscode';
import type { OutlineNode, OutlineRange } from './SvgOutlineNode';
import { SvgOutlineParser } from './SvgOutlineParser';

/**
 * 把 SVG 文本适配成 VSCode 大纲要求的 DocumentSymbol。
 *
 * Adaptee 是 SvgOutlineParser 的 OutlineNode。本类不保留文档或上次结果，
 * 编辑后由宿主重新调用 provideDocumentSymbols。
 */
export class SvgDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.DocumentSymbol[] {
    if (token.isCancellationRequested) {
      return [];
    }
    try {
      return new SvgOutlineParser().parse(document.getText()).map(toDocumentSymbol);
    } catch {
      return [];
    }
  }
}

/** 有子元素的节点用容器符号，叶子用字段符号。根 svg 与其他元素适用同一规则。 */
function symbolKind(node: OutlineNode): vscode.SymbolKind {
  return node.children.length > 0 ? vscode.SymbolKind.Namespace : vscode.SymbolKind.Field;
}

function toDocumentSymbol(node: OutlineNode): vscode.DocumentSymbol {
  const symbol = new vscode.DocumentSymbol(
    node.label,
    '',
    symbolKind(node),
    toRange(node.range),
    toRange(node.selectionRange),
  );
  symbol.children = node.children.map(toDocumentSymbol);
  return symbol;
}

function toRange(range: OutlineRange): vscode.Range {
  return new vscode.Range(
    range.start.line,
    range.start.character,
    range.end.line,
    range.end.character,
  );
}
