import type { Plugin, PluginContext, PluginManifest } from '../../src/api';
import { ModifiedStarDecorator } from './ModifiedStarDecorator';
import packageJson from './package.json';

export { ModificationTracker } from './ModificationTracker';
export { ModifiedStarDecorator } from './ModifiedStarDecorator';

/** 清单取自本包的 package.json，与方式 B 的加载器读到的内容一致。 */
export const manifest: PluginManifest = {
  name: packageJson.name,
  contributes: packageJson.contributes,
};

/** tree-star 插件：只贡献一个有状态的树装饰器 `modified-star`。 */
export class TreeStarPlugin implements Plugin {
  activate(context: PluginContext): void {
    context.registerTreeDecorator(new ModifiedStarDecorator());
  }
}

export default new TreeStarPlugin();
