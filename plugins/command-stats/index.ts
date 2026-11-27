import type { Plugin, PluginContext, PluginManifest } from '../../src/api';
import packageJson from './package.json';
import { StatsCommand } from './StatsCommand';

export { StatsCommand } from './StatsCommand';
export { collectStatistics, formatStatistics, type ShapeStatistics } from './ShapeStatistics';

/** 清单取自本包的 package.json，与方式 B 的加载器读到的内容一致。 */
export const manifest: PluginManifest = {
  name: packageJson.name,
  contributes: packageJson.contributes,
};

export class StatsPlugin implements Plugin {
  activate(context: PluginContext): void {
    context.registerCommand(new StatsCommand());
  }
}

export default new StatsPlugin();
