import { dirname, resolve } from 'node:path';
import type { Plugin, PluginManifest } from '../plugin/Plugin';
import { readPluginConfig } from './PluginConfig';
import { NodePluginModuleLoader, type PluginModuleLoader } from './PluginModuleLoader';

/** 加载器只需要宿主的 `install`，不关心宿主其他能力。 */
export interface PluginInstaller {
  install(plugin: Plugin, manifest: PluginManifest, options?: unknown): void;
}

export interface LoadReport {
  /** 成功安装的模块名（配置里的写法），按配置顺序。 */
  readonly installed: readonly string[];
  /** 被 `enabled: false` 跳过的模块名。 */
  readonly skipped: readonly string[];
}

/**
 * 配置装配（方式 B）：读取配置文件，按顺序把每个启用的模块交给 `installer.install`。
 * 本类只做“字符串 → 模块 → install”，不含任何具体插件名、映射或分支。
 *
 * 失败策略：
 * - 配置整体非法或不可读：抛 `InvalidPluginConfigError`，一个插件都不装；调用方应以内置能力启动；
 * - 单个插件的任何失败（找不到、求值失败、缺默认导出、清单不一致、activate 抛错、重复注册）：
 *   通过 `onError` 报告并继续后续插件。该插件的暂存注册由 PluginHost 保证已全部丢弃。
 */
export class PluginLoader {
  constructor(
    private readonly installer: PluginInstaller,
    private readonly onError: (message: string) => void,
    private readonly modules: PluginModuleLoader = new NodePluginModuleLoader(),
  ) {}

  loadFromConfig(configPath: string): LoadReport {
    const absolute = resolve(configPath);
    const entries = readPluginConfig(absolute);
    const baseDir = dirname(absolute);
    const installed: string[] = [];
    const skipped: string[] = [];
    for (const entry of entries) {
      if (!entry.enabled) {
        skipped.push(entry.module);
        continue;
      }
      try {
        const { plugin, manifest } = this.modules.load(entry.module, baseDir);
        this.installer.install(plugin, manifest, entry.options);
        installed.push(entry.module);
      } catch (error) {
        this.onError(error instanceof Error ? error.message : String(error));
      }
    }
    return { installed, skipped };
  }
}
