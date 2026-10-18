/** 接收非致命警告；CLI 实现负责添加 `warning:` 前缀并输出。 */
export interface WarningSink {
  warn(message: string): void;
}
