/** 把一行命令切成参数；双引号内的空格属于同一个参数。 */
export class Tokenizer {
  tokenize(line: string): string[] {
    const tokens: string[] = [];
    let index = 0;
    while (index < line.length) {
      while (index < line.length && /\s/.test(line[index])) index += 1;
      if (index >= line.length) break;
      if (line[index] === '"') {
        const end = line.indexOf('"', index + 1);
        if (end < 0) throw new Error('unterminated string');
        tokens.push(line.slice(index + 1, end));
        index = end + 1;
        continue;
      }
      let end = index;
      while (end < line.length && !/\s/.test(line[end])) end += 1;
      tokens.push(line.slice(index, end));
      index = end;
    }
    return tokens;
  }
}
