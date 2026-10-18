/** CLI 的文本输出端口。成功文本原样输出，前缀由具体实现添加。 */
export interface TextOutput {
  write(text: string): void;
  writeError(message: string): void;
}
