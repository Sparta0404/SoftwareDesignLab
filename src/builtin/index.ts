import type { PluginHost } from '../plugin/PluginHost';
import { BuiltinCommandsPlugin, BUILTIN_COMMANDS_MANIFEST } from './BuiltinCommandsPlugin';
import { BuiltinShapesPlugin, BUILTIN_SHAPES_MANIFEST } from './BuiltinShapesPlugin';

/**
 * 把内置能力（六种图形、Phase 1 命令）作为插件装入宿主。
 * 它们与外部插件走同一个 `PluginHost.install`，因此也受同样的清单与重复检测约束。
 */
export function installBuiltins(host: PluginHost): void {
  host.install(new BuiltinShapesPlugin(), BUILTIN_SHAPES_MANIFEST);
  host.install(new BuiltinCommandsPlugin(host.services), BUILTIN_COMMANDS_MANIFEST);
}
