import { InvalidArgumentsError } from '../factory/error/InvalidArgumentsError';

export function requireArgCount(
  args: readonly string[],
  min: number,
  max: number,
  usage: string,
): void {
  if (args.length < min || args.length > max) {
    throw new InvalidArgumentsError(`usage: ${usage}`);
  }
}

export function parseNumber(text: string): number {
  const trimmed = text.trim();
  const value = Number(trimmed);
  if (trimmed === '' || !Number.isFinite(value)) {
    throw new Error(`invalid number: ${text}`);
  }
  return value;
}
