import { InvalidLaunchArgumentsError } from './error/LoaderError';

/**
 * 进程入口的插件装配选择：
 * - `code`：代码装配列表（默认）；
 * - `config`：读 `--config <file>` 指定的配置文件；
 * - `none`：`--no-plugins`，只留内置能力（用于与 Phase 1 基线逐字节对照）。
 */
export type PluginSource =
  | { readonly kind: 'code' }
  | { readonly kind: 'config'; readonly configPath: string }
  | { readonly kind: 'none' };

export const LAUNCH_USAGE = 'usage: main [--config <file> | --no-plugins]';

/** 解析 `process.argv.slice(2)`；不认识的参数、缺值或互斥选项都抛 `InvalidLaunchArgumentsError`。 */
export function parseLaunchArguments(argv: readonly string[]): PluginSource {
  let configPath: string | undefined;
  let noPlugins = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--no-plugins') {
      noPlugins = true;
    } else if (arg === '--config') {
      const value = argv[++i];
      if (value === undefined || value === '' || value.startsWith('--')) {
        throw new InvalidLaunchArgumentsError(`--config requires a file path; ${LAUNCH_USAGE}`);
      }
      configPath = setOnce(configPath, value);
    } else if (arg.startsWith('--config=') && arg.length > '--config='.length) {
      configPath = setOnce(configPath, arg.slice('--config='.length));
    } else {
      throw new InvalidLaunchArgumentsError(`unknown argument: ${arg}; ${LAUNCH_USAGE}`);
    }
  }
  if (noPlugins && configPath !== undefined) {
    throw new InvalidLaunchArgumentsError(`--config and --no-plugins cannot be combined; ${LAUNCH_USAGE}`);
  }
  if (noPlugins) return { kind: 'none' };
  if (configPath !== undefined) return { kind: 'config', configPath };
  return { kind: 'code' };
}

function setOnce(current: string | undefined, value: string): string {
  if (current !== undefined) {
    throw new InvalidLaunchArgumentsError(`--config given more than once; ${LAUNCH_USAGE}`);
  }
  return value;
}
