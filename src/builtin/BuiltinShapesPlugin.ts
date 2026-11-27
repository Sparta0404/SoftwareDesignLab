import type { Plugin, PluginContext, PluginManifest } from '../api';
import { BuiltinShapes } from '../shapes/BuiltinShapes';

export const BUILTIN_SHAPES_MANIFEST: PluginManifest = {
  name: 'builtin-shapes',
  contributes: { shapes: ['rect', 'circle', 'ellipse', 'line', 'text', 'g'] },
};

/** 把六种内置图形包装成插件，与外部插件走同一条注册路径。 */
export class BuiltinShapesPlugin implements Plugin {
  activate(context: PluginContext): void {
    for (const provider of BuiltinShapes.providers()) {
      context.registerShape(provider);
    }
  }
}
