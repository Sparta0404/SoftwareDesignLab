/**
 * 会话对外广播的文档生命周期事件：
 * - opened：init / read 之后，当前文档被替换；
 * - saved：save 成功写出之后；
 * - edited：execute / undo / redo 成功，或画布尺寸被修改之后。
 */
export type DocumentEvent = 'opened' | 'saved' | 'edited';
