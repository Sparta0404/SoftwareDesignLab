import { readFileSync } from 'node:fs';
import { InvalidPluginConfigError } from './error/LoaderError';

/** 配置文件中的一项：`{ "module": "...", "enabled": true, "options": ... }`。 */
export interface PluginConfigEntry {
  /** 相对路径（以 `.` 开头）以配置文件所在目录为基准；其他写法按包名由 Node 解析。 */
  readonly module: string;
  /** 缺省为 true；false 时整项被跳过，不加载、不校验模块。 */
  readonly enabled: boolean;
  /** 原样作为 `activate(ctx, options)` 的第二个参数。 */
  readonly options?: unknown;
}

/**
 * 读取并校验 `plugins.config.json`。
 * 格式：`{ "plugins": [ { "module": string, "enabled"?: boolean, "options"?: any }, ... ] }`
 * 任何问题（读不到、JSON 非法、结构不符）都抛 `InvalidPluginConfigError`。
 */
export function readPluginConfig(configPath: string): PluginConfigEntry[] {
  let text: string;
  try {
    text = readFileSync(configPath, 'utf8');
  } catch (error) {
    throw new InvalidPluginConfigError(configPath, `cannot read file: ${describe(error)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new InvalidPluginConfigError(configPath, `not valid JSON: ${describe(error)}`);
  }
  return validate(configPath, parsed);
}

function validate(configPath: string, root: unknown): PluginConfigEntry[] {
  const fail = (reason: string): never => {
    throw new InvalidPluginConfigError(configPath, reason);
  };
  if (!isRecord(root)) return fail('top level must be an object');
  const plugins = root.plugins;
  if (!Array.isArray(plugins)) return fail('"plugins" must be an array');
  return plugins.map((item: unknown, index): PluginConfigEntry => {
    const where = `plugins[${index}]`;
    if (!isRecord(item)) return fail(`${where} must be an object`);
    if (typeof item.module !== 'string' || item.module.trim() === '') {
      return fail(`${where}.module must be a non-empty string`);
    }
    if (item.enabled !== undefined && typeof item.enabled !== 'boolean') {
      return fail(`${where}.enabled must be a boolean`);
    }
    return { module: item.module, enabled: item.enabled ?? true, options: item.options };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
