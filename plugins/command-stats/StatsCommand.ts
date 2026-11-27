import { requireArgCount, type Command, type CommandContext } from '../../src/api';
import { collectStatistics, formatStatistics } from './ShapeStatistics';

/**
 * `stats`：输出当前文档的图形统计。
 * 只通过 `session.inspect` 读取文档，不调用 `session.execute`，所以不进入 undo 栈；
 * 没有文档时由会话抛出 `no document` 错误。
 */
export class StatsCommand implements Command {
  readonly name = 'stats';
  readonly usage = 'stats';

  execute(args: readonly string[], context: CommandContext): void {
    requireArgCount(args, 0, 0, this.usage);
    const text = context.session.inspect((document) =>
      formatStatistics(collectStatistics(document.root)),
    );
    context.output.write(text);
  }
}
