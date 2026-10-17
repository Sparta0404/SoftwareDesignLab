import { EditorError } from './EditorError';

/** 文件读写失败；消息如 `cannot read file: a.svg`。 */
export class FileError extends EditorError {}
