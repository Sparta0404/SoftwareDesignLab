import { describe, expect, it } from 'vitest';
import { Tokenizer } from '../../src/cli/Tokenizer';

describe('Tokenizer', () => {
  const tokenizer = new Tokenizer();

  it('按空白切分普通参数', () => {
    expect(tokenizer.tokenize('  move   c1  30   0 ')).toEqual(['move', 'c1', '30', '0']);
  });

  it('双引号保留内部空格和中文', () => {
    expect(tokenizer.tokenize('create text title 20 40 "My Diagram"')).toEqual([
      'create',
      'text',
      'title',
      '20',
      '40',
      'My Diagram',
    ]);
    expect(tokenizer.tokenize('set label text "处理数据 v2"')).toEqual([
      'set',
      'label',
      'text',
      '处理数据 v2',
    ]);
  });

  it('允许空字符串参数', () => {
    expect(tokenizer.tokenize('set t text ""')).toEqual(['set', 't', 'text', '']);
  });

  it('未闭合的引号报错', () => {
    expect(() => tokenizer.tokenize('create text t 1 2 "hello')).toThrow('unterminated string');
  });
});
