import { EditorError } from './EditorError';

/** 属性值或参数值不合法（如非数字）；消息由抛出方给出完整描述。 */
export class InvalidValueError extends EditorError {}
