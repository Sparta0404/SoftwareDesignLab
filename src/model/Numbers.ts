import { InvalidValueError } from './error/InvalidValueError';

/** 数字的统一格式化与解析：显示时去掉浮点噪声，解析时拒绝非数字。 */
export class Numbers {
  static format(value: number): string {
    const rounded = Math.round(value * 1e6) / 1e6;
    return String(Object.is(rounded, -0) ? 0 : rounded);
  }

  static parse(text: string): number {
    const trimmed = text.trim();
    const value = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(value)) {
      throw new InvalidValueError(`invalid number: ${text}`);
    }
    return value;
  }
}
