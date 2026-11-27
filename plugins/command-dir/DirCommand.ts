import { EditorError, requireArgCount, type Command, type CommandContext } from '../../src/api';
import type { DirectoryEntry, DirectoryLister } from './DirectoryLister';

/** 提供“当前工作目录”；生产环境是 `process.cwd`，测试用固定值。 */
export type CurrentDirectoryProvider = () => string;

export class DirectoryReadError extends EditorError {
  constructor(path: string) {
    super(`cannot read directory: ${path}`);
  }
}

/**
 * `dir`：列出进程当前工作目录的直接子项。
 *
 * 适配器模式中的 Client：只依赖 `DirectoryLister`（Target），不认识 `node:fs`。
 * 不触碰 session，因此没有文档时可用，也不影响文档、dirty 状态与 undo/redo 历史。
 */
export class DirCommand implements Command {
  readonly name = 'dir';
  readonly usage = 'dir';

  constructor(
    private readonly lister: DirectoryLister,
    private readonly currentDirectory: CurrentDirectoryProvider,
  ) {}

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 0, 0, this.usage);
    const path = this.currentDirectory();
    let entries: readonly DirectoryEntry[];
    try {
      entries = this.lister.list(path);
    } catch {
      throw new DirectoryReadError(path);
    }
    context.output.write(format(entries));
  }
}

/** 目录在前、文件在后，各组按名称的 Unicode 码点升序；同一输入输出稳定。 */
function format(entries: readonly DirectoryEntry[]): string {
  if (entries.length === 0) return '(empty directory)';
  const sorted = [...entries].sort(
    (a, b) => rank(a) - rank(b) || compareCodePoints(a.name, b.name),
  );
  return sorted
    .map((entry) => (entry.kind === 'directory' ? `[DIR]  ${entry.name}` : `[FILE] ${entry.name}`))
    .join('\n');
}

function rank(entry: DirectoryEntry): number {
  return entry.kind === 'directory' ? 0 : 1;
}

/** 按码点（而不是 UTF-16 码元）比较，与区域设置无关。 */
function compareCodePoints(a: string, b: string): number {
  const left = Array.from(a, (char) => char.codePointAt(0) as number);
  const right = Array.from(b, (char) => char.codePointAt(0) as number);
  const shared = Math.min(left.length, right.length);
  for (let i = 0; i < shared; i += 1) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return left.length - right.length;
}
