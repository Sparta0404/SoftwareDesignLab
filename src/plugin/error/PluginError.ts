import { EditorError } from '../../model/error/EditorError';

/** 插件装配阶段的错误基类；消息不含 `error:` 前缀。 */
export class PluginError extends EditorError {}

/** 两个注册项占用了同一个名字（扩展点种类/名字），例如 `shapes/box`。 */
export class DuplicateRegistrationError extends PluginError {
  constructor(slot: string) {
    super(`duplicate registration: ${slot}`);
  }
}

/** 插件声明（清单）与它激活时实际注册的内容不一致，或清单本身不合法。 */
export class PluginManifestMismatchError extends PluginError {
  constructor(pluginName: string, detail: string) {
    super(`plugin manifest mismatch: ${pluginName} (${detail})`);
  }
}

/** 插件的 activate 抛错、缺失，或在激活期间违反注册约束。 */
export class PluginActivationError extends PluginError {
  constructor(pluginName: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`plugin failed to activate: ${pluginName} (${reason})`);
  }
}
