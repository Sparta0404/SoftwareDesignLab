import type { Plugin, PluginContext, PluginManifest } from '../api';
import type { Command } from '../cli/Command';
import { AddToHandler } from '../cli/handler/AddToHandler';
import { CanvasHandler } from '../cli/handler/CanvasHandler';
import { CreateHandler } from '../cli/handler/CreateHandler';
import { DeleteHandler } from '../cli/handler/DeleteHandler';
import { GroupHandler } from '../cli/handler/GroupHandler';
import { InitHandler } from '../cli/handler/InitHandler';
import { MoveHandler } from '../cli/handler/MoveHandler';
import { ReadHandler } from '../cli/handler/ReadHandler';
import { RedoHandler } from '../cli/handler/RedoHandler';
import { SaveHandler } from '../cli/handler/SaveHandler';
import { ScaleHandler } from '../cli/handler/ScaleHandler';
import { SetHandler } from '../cli/handler/SetHandler';
import { ShowHandler } from '../cli/handler/ShowHandler';
import { TreeHandler } from '../cli/handler/TreeHandler';
import { UndoHandler } from '../cli/handler/UndoHandler';
import { UngroupHandler } from '../cli/handler/UngroupHandler';
import { ZOrderHandler } from '../cli/handler/ZOrderHandler';
import type { KernelServices } from '../plugin/PluginHost';

export const BUILTIN_COMMANDS_MANIFEST: PluginManifest = {
  name: 'builtin-commands',
  contributes: {
    commands: [
      'init', 'read', 'save', 'canvas', 'create', 'delete', 'move', 'scale', 'set',
      'group', 'ungroup', 'addto', 'front', 'back', 'tree', 'show', 'undo', 'redo',
    ],
  },
};

/**
 * Phase 1 的全部命令。注册顺序就是 help 的展示顺序，必须与重构前一致。
 * `set` / `tree` 持有宿主的属性处理器与树装饰器注册表，插件之后登记的扩展项自然对它们可见。
 */
export class BuiltinCommandsPlugin implements Plugin {
  constructor(private readonly services: KernelServices) {}

  activate(context: PluginContext): void {
    for (const command of this.commands()) {
      context.registerCommand(command);
    }
  }

  private commands(): Command[] {
    const { factory, attributeHandlers, treeDecorators } = this.services;
    return [
      new InitHandler(),
      new ReadHandler(),
      new SaveHandler(),
      new CanvasHandler(),
      new CreateHandler(factory),
      new DeleteHandler(),
      new MoveHandler(),
      new ScaleHandler(),
      new SetHandler(attributeHandlers),
      new GroupHandler(),
      new UngroupHandler(),
      new AddToHandler(),
      new ZOrderHandler('front'),
      new ZOrderHandler('back'),
      new TreeHandler(treeDecorators),
      new ShowHandler(),
      new UndoHandler(),
      new RedoHandler(),
    ];
  }
}
