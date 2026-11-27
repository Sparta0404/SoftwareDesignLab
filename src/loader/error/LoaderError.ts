import { EditorError } from '../../model/error/EditorError';

/** 配置文件不可读、不是合法 JSON，或结构不符合约定。装配方应退回只有内置能力的状态。 */
export class InvalidPluginConfigError extends EditorError {
  constructor(configPath: string, reason: string) {
    super(`invalid plugin config: ${configPath} (${reason})`);
  }
}

/** 模块名无法解析到任何文件。只有“解析失败”才用这条，求值失败不算。 */
export class PluginNotFoundError extends EditorError {
  constructor(moduleName: string) {
    super(`plugin not found: ${moduleName}`);
  }
}

/** 模块能加载，但没有 `default` 导出的插件对象。 */
export class PluginMissingDefaultExportError extends EditorError {
  constructor(moduleName: string) {
    super(`plugin has no default export: ${moduleName}`);
  }
}

/** 命令行入口参数不合法。 */
export class InvalidLaunchArgumentsError extends EditorError {}
