import type { EditorSession } from '../app/EditorSession';
import { Cli } from '../cli/Cli';
import type { Command } from '../cli/Command';
import { CommandRegistry } from '../cli/CommandRegistry';
import type { TextOutput } from '../cli/TextOutput';
import type { AttributeHandler } from '../command/attribute/AttributeHandler';
import { AttributeHandlerRegistry } from '../command/attribute/AttributeHandlerRegistry';
import type { ShapeFactory } from '../factory/ShapeFactory';
import type { ShapeProvider } from '../factory/ShapeProvider';
import type { TreeDecorator } from '../view/TreeDecorator';
import { TreeDecoratorRegistry } from '../view/TreeDecoratorRegistry';
import {
  CONTRIBUTION_KINDS,
  type ContributionKind,
  type Plugin,
  type PluginContext,
  type PluginManifest,
} from './Plugin';
import {
  DuplicateRegistrationError,
  PluginActivationError,
  PluginManifestMismatchError,
} from './error/PluginError';

/** 宿主自己持有的注册表。只用于装配内置插件（它们的命令需要引用这些注册表）。 */
export interface KernelServices {
  readonly factory: ShapeFactory;
  readonly attributeHandlers: AttributeHandlerRegistry;
  readonly treeDecorators: TreeDecoratorRegistry;
}

export interface PluginHostDependencies {
  readonly session: EditorSession;
  readonly factory: ShapeFactory;
}

/** 内核自带、插件不得占用的命令名（help 由 Cli 最后注册）。 */
const RESERVED_COMMANDS: readonly string[] = ['help'];

type Staged<T> = ReadonlyArray<{ readonly name: string; readonly item: T }>;

/** 一次 `activate` 期间的暂存区；内容在提交之前对内核完全不可见。 */
class StagingContext implements PluginContext {
  readonly shapes: Array<{ name: string; item: ShapeProvider }> = [];
  readonly commands: Array<{ name: string; item: Command }> = [];
  readonly attributeHandlers: Array<{ name: string; item: AttributeHandler }> = [];
  readonly treeDecorators: Array<{ name: string; item: TreeDecorator }> = [];
  private open = true;

  registerShape(provider: ShapeProvider): void {
    this.stage(this.shapes, 'shapes', provider.typeName, provider);
  }

  registerCommand(command: Command): void {
    this.stage(this.commands, 'commands', command.name, command);
  }

  registerAttributeHandler(handler: AttributeHandler): void {
    this.stage(this.attributeHandlers, 'attributeHandlers', handler.name, handler);
  }

  registerTreeDecorator(decorator: TreeDecorator): void {
    this.stage(this.treeDecorators, 'treeDecorators', decorator.name, decorator);
  }

  close(): void {
    this.open = false;
  }

  names(kind: ContributionKind): string[] {
    return this[kind].map((entry) => entry.name);
  }

  private stage<T>(
    target: Array<{ name: string; item: T }>,
    kind: ContributionKind,
    name: unknown,
    item: T,
  ): void {
    if (!this.open) {
      throw new Error(`plugin context is closed (${kind} registration after activate)`);
    }
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error(`${kind} registration without a name`);
    }
    target.push({ name, item });
  }
}

/**
 * 插件宿主：内核唯一的插件装配入口。
 * 代码装配（main.ts）与配置装配（loader）都只调用 `install`，所以校验规则只有一份。
 *
 * `install` 的流程（原子的，失败时内核状态完全不变）：
 * 1. 校验清单自身；
 * 2. `activate` 把扩展项登记到暂存区（抛错 → `plugin failed to activate`）；
 * 3. 暂存内容必须与清单声明一致（否则 `plugin manifest mismatch`）；
 * 4. 与已提交内容及暂存内容内部的重名检测（否则 `duplicate registration`）；
 * 5. 提交到各注册表；带 `onDocumentEvent` 的树装饰器同时订阅会话事件。
 *
 * 提交后，装饰器只会收到之后发生的文档事件；插件应在打开文档之前装配。
 */
export class PluginHost {
  private readonly session: EditorSession;
  private readonly attributeHandlerRegistry = new AttributeHandlerRegistry();
  private readonly treeDecoratorRegistry = new TreeDecoratorRegistry();
  private readonly commands: Command[] = [];
  private readonly pluginNames = new Set<string>();
  readonly services: KernelServices;

  constructor(dependencies: PluginHostDependencies) {
    this.session = dependencies.session;
    this.services = {
      factory: dependencies.factory,
      attributeHandlers: this.attributeHandlerRegistry,
      treeDecorators: this.treeDecoratorRegistry,
    };
  }

  /** 已成功安装的插件名，按安装顺序。 */
  installed(): string[] {
    return [...this.pluginNames];
  }

  install(plugin: Plugin, manifest: PluginManifest, options?: unknown): void {
    this.validateManifest(manifest);
    const pluginName = manifest.name;
    if (this.pluginNames.has(pluginName)) {
      throw new DuplicateRegistrationError(`plugins/${pluginName}`);
    }
    const staging = this.activate(plugin, pluginName, options);
    this.checkManifest(manifest, staging);
    this.checkDuplicates(staging);
    this.commit(pluginName, staging);
  }

  /** 把已提交的命令装成一个 Cli；help 由内核最后注册。可以重复调用，互不影响。 */
  createCli(output: TextOutput): Cli {
    const registry = new CommandRegistry();
    for (const command of this.commands) {
      registry.register(command);
    }
    return Cli.create(registry, this.services.factory, this.session, output);
  }

  private validateManifest(manifest: PluginManifest): void {
    const name = (manifest as { name?: unknown } | undefined)?.name;
    if (typeof name !== 'string' || name.trim() === '') {
      throw new PluginManifestMismatchError('<unnamed>', 'manifest has no name');
    }
    const contributes = (manifest as { contributes?: unknown }).contributes;
    if (typeof contributes !== 'object' || contributes === null) {
      throw new PluginManifestMismatchError(name, 'manifest has no contributes');
    }
    for (const kind of CONTRIBUTION_KINDS) {
      const declared = (contributes as Record<string, unknown>)[kind];
      if (declared === undefined) continue;
      if (!Array.isArray(declared) || declared.some((item) => typeof item !== 'string')) {
        throw new PluginManifestMismatchError(name, `contributes.${kind} must be a string array`);
      }
    }
  }

  private activate(plugin: Plugin, pluginName: string, options: unknown): StagingContext {
    const staging = new StagingContext();
    try {
      if (typeof (plugin as { activate?: unknown } | undefined)?.activate !== 'function') {
        throw new Error('missing activate');
      }
      plugin.activate(staging, options);
    } catch (error) {
      throw new PluginActivationError(pluginName, error);
    } finally {
      staging.close();
    }
    return staging;
  }

  private checkManifest(manifest: PluginManifest, staging: StagingContext): void {
    const problems: string[] = [];
    for (const kind of CONTRIBUTION_KINDS) {
      const declared = new Set(manifest.contributes[kind] ?? []);
      const registered = new Set(staging.names(kind));
      for (const name of registered) {
        if (!declared.has(name)) problems.push(`registered but not declared: ${kind}/${name}`);
      }
      for (const name of declared) {
        if (!registered.has(name)) problems.push(`declared but not registered: ${kind}/${name}`);
      }
    }
    if (problems.length > 0) {
      throw new PluginManifestMismatchError(manifest.name, problems.join('; '));
    }
  }

  private checkDuplicates(staging: StagingContext): void {
    for (const kind of CONTRIBUTION_KINDS) {
      const taken = new Set(this.committedNames(kind));
      for (const name of staging.names(kind)) {
        if (taken.has(name)) {
          throw new DuplicateRegistrationError(`${kind}/${name}`);
        }
        taken.add(name);
      }
    }
  }

  private committedNames(kind: ContributionKind): string[] {
    switch (kind) {
      case 'shapes':
        return this.services.factory.typeNames();
      case 'commands':
        return [...RESERVED_COMMANDS, ...this.commands.map((command) => command.name)];
      case 'attributeHandlers':
        return this.attributeHandlerRegistry.all().map((handler) => handler.name);
      case 'treeDecorators':
        return this.treeDecoratorRegistry.all().map((decorator) => decorator.name);
    }
  }

  /** 前面的检测保证以下注册不会失败，所以这里不需要回滚。 */
  private commit(pluginName: string, staging: StagingContext): void {
    this.each(staging.shapes, (provider) => this.services.factory.register(provider));
    this.each(staging.commands, (command) => this.commands.push(command));
    this.each(staging.attributeHandlers, (handler) => this.attributeHandlerRegistry.register(handler));
    this.each(staging.treeDecorators, (decorator) => this.commitDecorator(decorator));
    this.pluginNames.add(pluginName);
  }

  private commitDecorator(decorator: TreeDecorator): void {
    this.treeDecoratorRegistry.register(decorator);
    if (typeof decorator.onDocumentEvent === 'function') {
      this.session.subscribe((event, document) => decorator.onDocumentEvent?.(event, document));
    }
  }

  private each<T>(staged: Staged<T>, action: (item: T) => unknown): void {
    for (const entry of staged) {
      action(entry.item);
    }
  }
}
