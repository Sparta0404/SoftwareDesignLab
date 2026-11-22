import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { SvgFileDecorationProvider } from '../../src/badge/SvgFileDecorationProvider';

interface SymbolView {
  name: string;
  kind: vscode.SymbolKind;
  children: SymbolView[];
}

function extension(): vscode.Extension<unknown> {
  const found = vscode.extensions.all.find((item) => item.packageJSON.name === 'svg-vscode');
  if (found === undefined) {
    assert.fail('svg-vscode 未加载');
  }
  return found;
}

function names(symbols: readonly vscode.DocumentSymbol[]): SymbolView[] {
  return symbols.map((symbol) => ({
    name: symbol.name,
    kind: symbol.kind,
    children: names(symbol.children),
  }));
}

async function symbolsOf(uri: vscode.Uri): Promise<vscode.DocumentSymbol[]> {
  const result = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
    'vscode.executeDocumentSymbolProvider',
    uri,
  );
  return result ?? [];
}

describe('SVG 扩展宿主冒烟', () => {
  const provider = new SvgFileDecorationProvider();
  const token = new vscode.CancellationTokenSource().token;
  let tempDir = '';

  before(async () => {
    await extension().activate();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'svg-vscode-'));
  });

  after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('为 sample.svg 提供嵌套大纲，rect#start 位于源码第 4 行', async () => {
    const sample = vscode.Uri.file(path.join(extension().extensionPath, 'examples', 'sample.svg'));
    const document = await vscode.workspace.openTextDocument(sample);
    await vscode.window.showTextDocument(document, { preview: false });

    const symbols = await symbolsOf(sample);

    assert.deepStrictEqual(names(symbols), [
      {
        name: 'svg',
        kind: vscode.SymbolKind.Namespace,
        children: [
          {
            name: 'g#layer',
            kind: vscode.SymbolKind.Namespace,
            children: [
              {
                name: 'g',
                kind: vscode.SymbolKind.Namespace,
                children: [
                  { name: 'rect#start', kind: vscode.SymbolKind.Field, children: [] },
                  { name: 'text', kind: vscode.SymbolKind.Field, children: [] },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const rect = symbols[0]?.children[0]?.children[0]?.children[0];
    assert.ok(rect);
    assert.strictEqual(rect.name, 'rect#start');
    assert.strictEqual(rect.selectionRange.start.line, 3);
    assert.strictEqual(rect.selectionRange.end.line, 3);
  });

  it('编辑文档后大纲换成新内容', async () => {
    const file = path.join(tempDir, 'edit.svg');
    await fs.writeFile(file, '<svg><rect id="start"/></svg>', 'utf8');
    const uri = vscode.Uri.file(file);
    const document = await vscode.workspace.openTextDocument(uri);

    assert.deepStrictEqual(names(await symbolsOf(uri)), [
      {
        name: 'svg',
        kind: vscode.SymbolKind.Namespace,
        children: [{ name: 'rect#start', kind: vscode.SymbolKind.Field, children: [] }],
      },
    ]);

    const end = document.lineAt(document.lineCount - 1).range.end;
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      uri,
      new vscode.Range(new vscode.Position(0, 0), end),
      '<svg><circle id="end"/></svg>',
    );
    assert.strictEqual(await vscode.workspace.applyEdit(edit), true);

    assert.deepStrictEqual(names(await symbolsOf(uri)), [
      {
        name: 'svg',
        kind: vscode.SymbolKind.Namespace,
        children: [{ name: 'circle#end', kind: vscode.SymbolKind.Field, children: [] }],
      },
    ]);
  });

  it('不完整 XML 返回空大纲', async () => {
    const samples = ['<svg><rect>', '<svg', ''];

    for (const [index, text] of samples.entries()) {
      const file = path.join(tempDir, `broken-${index}.svg`);
      await fs.writeFile(file, text, 'utf8');
      const uri = vscode.Uri.file(file);
      await vscode.workspace.openTextDocument(uri);
      assert.deepStrictEqual(await symbolsOf(uri), []);
    }
  });

  it('只给 .svg 文件加 [] 标记，目录和普通文件没有标记，且不改文件内容', async () => {
    const samplePath = path.join(extension().extensionPath, 'examples', 'sample.svg');
    const before = await fs.readFile(samplePath);
    const decoration = await provider.provideFileDecoration(vscode.Uri.file(samplePath), token);
    const after = await fs.readFile(samplePath);

    assert.deepStrictEqual(after, before);
    if (decoration === undefined || decoration === null) {
      assert.fail('sample.svg 应显示 [] 标记');
    }
    assert.strictEqual(decoration.badge, '[]');
    assert.strictEqual(decoration.tooltip, 'SVG file');

    const upper = path.join(tempDir, 'ICON.SVG');
    await fs.writeFile(upper, '<svg/>', 'utf8');
    const upperDecoration = await provider.provideFileDecoration(vscode.Uri.file(upper), token);
    assert.strictEqual(upperDecoration?.badge, '[]');

    const textPath = path.join(tempDir, 'notes.txt');
    await fs.writeFile(textPath, 'hello', 'utf8');
    assert.strictEqual(
      await provider.provideFileDecoration(vscode.Uri.file(textPath), token),
      undefined,
    );

    const dirPath = path.join(tempDir, 'x.svg');
    await fs.mkdir(dirPath);
    assert.strictEqual(
      await provider.provideFileDecoration(vscode.Uri.file(dirPath), token),
      undefined,
    );

    assert.strictEqual(
      await provider.provideFileDecoration(vscode.Uri.parse('untitled:example.svg'), token),
      undefined,
    );
  });
});
