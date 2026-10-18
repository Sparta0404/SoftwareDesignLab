import { EditorError } from '../../model/error/EditorError';

/** 命令参数个数或形式不对；消息通常是 `usage: ...`。 */
export class InvalidArgumentsError extends EditorError {}
