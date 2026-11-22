import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

/** 下载或复用 VS Code，在扩展宿主里跑冒烟测试。 */
async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../..');
    const extensionTestsPath = path.resolve(__dirname, './index');
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions', '--disable-workspace-trust'],
    });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

void main();
