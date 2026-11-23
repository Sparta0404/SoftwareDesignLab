import { describe, expect, it } from 'vitest';
import { isSvgPath } from '../../src/badge/isSvgPath';

describe('isSvgPath', () => {
  it('识别 .svg 与 .SVG，拒绝其他扩展名、无扩展名和目录', () => {
    const cases: Array<[string, boolean, boolean]> = [
      ['example.svg', false, true],
      ['folder/example.svg', false, true],
      ['folder\\example.SVG', false, true],
      ['notes.txt', false, false],
      ['README', false, false],
      ['a.svg.bak', false, false],
      ['x.svg', true, false],
      ['notes.txt', true, false],
    ];

    for (const [filePath, isDirectory, expected] of cases) {
      expect(isSvgPath(filePath, isDirectory)).toBe(expected);
    }
  });
});
