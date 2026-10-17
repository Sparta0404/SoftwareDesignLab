/** 所有“可预期的编辑错误”的基类；消息不含 `error:` 前缀，由 CLI 层统一加前缀。 */
export class EditorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
