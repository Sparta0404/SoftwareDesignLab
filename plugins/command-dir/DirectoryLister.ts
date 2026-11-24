/** 目录项的种类；符号链接等特殊项统一归为 `file`（不跟随链接）。 */
export type DirectoryEntryKind = 'directory' | 'file';

export interface DirectoryEntry {
  readonly name: string;
  readonly kind: DirectoryEntryKind;
}

/**
 * 适配器模式中的 Target：`DirCommand`（Client）期望的目录访问接口。
 *
 * 契约：返回 `path` 下的全部直接子项（含隐藏项，不含 `.` 与 `..`），顺序不作保证；
 * 无法读取时抛出任意错误，由 `DirCommand` 统一转换成 `cannot read directory: <path>`。
 */
export interface DirectoryLister {
  list(path: string): readonly DirectoryEntry[];
}
