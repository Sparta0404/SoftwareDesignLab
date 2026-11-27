import { readdirSync } from 'node:fs';
import type { DirectoryEntry, DirectoryLister } from './DirectoryLister';

/**
 * 适配器模式中的 Adapter：把 Adaptee（`node:fs` 的 `readdirSync`）适配成 `DirectoryLister`。
 *
 * `withFileTypes` 得到的 Dirent 与 `lstat` 语义一致：不跟随符号链接，
 * 所以符号链接（无论指向文件还是目录）的 `isDirectory()` 为 false，被归为 `file`。
 */
export class NodeFsDirectoryAdapter implements DirectoryLister {
  list(path: string): readonly DirectoryEntry[] {
    return readdirSync(path, { withFileTypes: true }).map(
      (entry): DirectoryEntry => ({
        name: entry.name,
        kind: entry.isDirectory() ? 'directory' : 'file',
      }),
    );
  }
}
