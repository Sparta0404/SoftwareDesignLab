import type { Plugin, PluginContext, PluginManifest } from '../../src/api';
import { DirCommand, type CurrentDirectoryProvider } from './DirCommand';
import type { DirectoryLister } from './DirectoryLister';
import { NodeFsDirectoryAdapter } from './NodeFsDirectoryAdapter';
import packageJson from './package.json';

export { DirCommand, DirectoryReadError, type CurrentDirectoryProvider } from './DirCommand';
export type { DirectoryEntry, DirectoryEntryKind, DirectoryLister } from './DirectoryLister';
export { NodeFsDirectoryAdapter } from './NodeFsDirectoryAdapter';

/** 清单取自本包的 package.json，与方式 B 的加载器读到的内容一致。 */
export const manifest: PluginManifest = {
  name: packageJson.name,
  contributes: packageJson.contributes,
};

/** 默认使用真实文件系统适配器与进程当前目录；两个依赖都可以替换。 */
export class DirPlugin implements Plugin {
  constructor(
    private readonly lister: DirectoryLister = new NodeFsDirectoryAdapter(),
    private readonly currentDirectory: CurrentDirectoryProvider = () => process.cwd(),
  ) {}

  activate(context: PluginContext): void {
    context.registerCommand(new DirCommand(this.lister, this.currentDirectory));
  }
}

export default new DirPlugin();
