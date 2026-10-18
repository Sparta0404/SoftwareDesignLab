import type { EditorSession } from '../app/EditorSession';
import type { ShapeFactory } from '../factory/ShapeFactory';
import type { TextOutput } from './TextOutput';

/** 一条 CLI 命令执行时可以使用的协作对象。 */
export interface CliContext {
  readonly session: EditorSession;
  readonly factory: ShapeFactory;
  readonly output: TextOutput;
}
