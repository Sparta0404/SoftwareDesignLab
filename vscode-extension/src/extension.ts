import * as vscode from 'vscode';
import { SvgFileDecorationProvider } from './badge/SvgFileDecorationProvider';
import { SvgDocumentSymbolProvider } from './outline/SvgDocumentSymbolProvider';

/** 组合根：扩展激活后在这里注册文件标记与大纲 provider。 */
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(new SvgFileDecorationProvider()),
    // .svg 的默认语言 id 是 xml，因此按文件名和 language id 各注册一次。
    vscode.languages.registerDocumentSymbolProvider(
      [{ scheme: 'file', pattern: '**/*.svg' }, { language: 'svg' }],
      new SvgDocumentSymbolProvider(),
    ),
  );
}

export function deactivate(): void {}
