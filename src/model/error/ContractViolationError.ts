import { EditorError } from './EditorError';

/** 扩展点实现（图形提供者、属性处理器……）违反了内核规定的契约。 */
export class ContractViolationError extends EditorError {
  constructor(detail: string) {
    super(`contract violation: ${detail}`);
  }
}
