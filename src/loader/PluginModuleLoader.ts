import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { Plugin, PluginManifest } from '../plugin/Plugin';
import { PluginActivationError, PluginManifestMismatchError } from '../plugin/error/PluginError';
import { PluginMissingDefaultExportError, PluginNotFoundError } from './error/LoaderError';

/** 从一个模块名得到的插件对象与它的清单。 */
export interface LoadedPlugin {
  readonly plugin: Plugin;
  readonly manifest: PluginManifest;
}

/** “字符串 → 模块”的接缝；加载器只依赖它，测试可以替换。 */
export interface PluginModuleLoader {
  /** `baseDir` 是相对路径与包名解析的起点（配置文件所在目录）。 */
  load(moduleName: string, baseDir: string): LoadedPlugin;
}

/**
 * 用 Node 的模块解析加载插件。步骤与各自的失败含义：
 * 1. `resolve`：解析失败才是 `plugin not found`；
 * 2. `require`：求值或依赖失败 → `plugin failed to activate`，不误报 not found；
 * 3. 取 `default` 导出作为插件，没有则报缺少默认导出；
 * 4. 清单：模块若导出 `manifest` 则用它，否则读插件包的 `package.json`。
 * 清单是否与实际注册一致、是否重名，都由 PluginHost.install 统一判断。
 */
export class NodePluginModuleLoader implements PluginModuleLoader {
  load(moduleName: string, baseDir: string): LoadedPlugin {
    const nodeRequire = createRequire(join(baseDir, 'plugins.config.json'));
    const request = isPathLike(moduleName) ? resolve(baseDir, moduleName) : moduleName;

    let entry: string;
    try {
      entry = nodeRequire.resolve(request);
    } catch {
      throw new PluginNotFoundError(moduleName);
    }

    let loaded: unknown;
    try {
      loaded = nodeRequire(entry);
    } catch (error) {
      throw new PluginActivationError(moduleName, error);
    }

    const exported = loaded as { default?: unknown; manifest?: unknown } | null | undefined;
    const plugin = exported?.default;
    if (plugin === undefined || plugin === null) {
      throw new PluginMissingDefaultExportError(moduleName);
    }
    const manifest = isObject(exported?.manifest)
      ? exported.manifest
      : this.readPackageManifest(moduleName, request, entry, nodeRequire);
    return { plugin: plugin as Plugin, manifest: manifest as PluginManifest };
  }

  private readPackageManifest(
    moduleName: string,
    request: string,
    entry: string,
    nodeRequire: NodeJS.Require,
  ): unknown {
    const file = this.findPackageJson(request, entry, nodeRequire);
    if (file === undefined) {
      throw new PluginManifestMismatchError(moduleName, 'no package.json with contributes found');
    }
    try {
      const { name, contributes } = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
      return { name, contributes };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new PluginManifestMismatchError(moduleName, `cannot read ${file}: ${reason}`);
    }
  }

  /**
   * 插件包的 `main` 指向编译产物（如 dist/plugins/x/index.js），
   * 所以不能从入口文件往上找，要先从“请求”本身定位包目录。
   */
  private findPackageJson(
    request: string,
    entry: string,
    nodeRequire: NodeJS.Require,
  ): string | undefined {
    if (isAbsolute(request)) {
      if (isDirectory(request) && existsSync(join(request, 'package.json'))) {
        return join(request, 'package.json');
      }
    } else {
      try {
        return nodeRequire.resolve(`${request}/package.json`);
      } catch {
        // 包没有导出 package.json：退回到从入口向上查找
      }
    }
    return this.walkUpForManifest(dirname(entry));
  }

  private walkUpForManifest(start: string): string | undefined {
    let dir = start;
    for (;;) {
      const candidate = join(dir, 'package.json');
      if (existsSync(candidate) && hasContributes(candidate)) return candidate;
      const parent = dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
    }
  }
}

function isPathLike(moduleName: string): boolean {
  return /^\.{1,2}([\\/]|$)/.test(moduleName) || isAbsolute(moduleName);
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function hasContributes(file: string): boolean {
  try {
    return 'contributes' in (JSON.parse(readFileSync(file, 'utf8')) as object);
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}
