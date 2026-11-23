import * as vscode from 'vscode';
import { isSvgPath } from './isSvgPath';

/** 在资源管理器中为 .svg 文件追加 `[]` 标记，不修改文件名和内容。 */
export class SvgFileDecorationProvider implements vscode.FileDecorationProvider {
  provideFileDecoration(
    uri: vscode.Uri,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.FileDecoration> {
    if (token.isCancellationRequested || uri.scheme !== 'file' || !isSvgPath(uri.fsPath)) {
      return undefined;
    }
    return this.decorationForSvgFile(uri, token);
  }

  private async decorationForSvgFile(
    uri: vscode.Uri,
    token: vscode.CancellationToken,
  ): Promise<vscode.FileDecoration | undefined> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (token.isCancellationRequested) {
        return undefined;
      }
      const isDirectory = (stat.type & vscode.FileType.Directory) !== 0;
      if (!isSvgPath(uri.fsPath, isDirectory)) {
        return undefined;
      }
      return new vscode.FileDecoration('[]', 'SVG file');
    } catch {
      return undefined;
    }
  }
}
