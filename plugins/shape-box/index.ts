import type { Plugin, PluginContext, PluginManifest } from '../../src/api';
import { BoxAttributeHandler } from './BoxAttributeHandler';
import { BoxProvider } from './BoxProvider';
import { BoxTypeLabelDecorator } from './BoxTypeLabelDecorator';
import packageJson from './package.json';

export { BoxAttributeHandler } from './BoxAttributeHandler';
export { BoxProvider, DEFAULT_BOX_FILL, InvalidBoxError } from './BoxProvider';
export { BoxPartRequiredError, BoxShape } from './BoxShape';
export { BoxTypeLabelDecorator } from './BoxTypeLabelDecorator';

/** 清单取自本包的 package.json，与方式 B 的加载器读到的内容一致。 */
export const manifest: PluginManifest = {
  name: packageJson.name,
  contributes: packageJson.contributes,
};

/** box 插件：一个图形提供者、一个属性处理器、一个树标签，三者共同定义 box。 */
export class ShapeBoxPlugin implements Plugin {
  activate(context: PluginContext): void {
    context.registerShape(new BoxProvider());
    context.registerAttributeHandler(new BoxAttributeHandler());
    context.registerTreeDecorator(new BoxTypeLabelDecorator());
  }
}

export default new ShapeBoxPlugin();
