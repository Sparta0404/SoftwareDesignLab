/**
 * 判断路径是否应显示 SVG 文件标记。
 *
 * 只比较扩展名（大小写不敏感），不读取文件内容。名为 `x.svg` 的目录也不标记，
 * 是否为目录由调用方根据 `stat` 结果传入。
 */
export function isSvgPath(filePath: string, isDirectory = false): boolean {
  if (isDirectory) {
    return false;
  }
  return fileExtension(filePath).toLowerCase() === '.svg';
}

/** 最后一个路径段的扩展名，规则与 Node `path.extname` 一致。 */
function fileExtension(filePath: string): string {
  let end = filePath.length;
  while (end > 0 && isSeparator(filePath.charCodeAt(end - 1))) {
    end -= 1;
  }

  let start = end;
  while (start > 0 && !isSeparator(filePath.charCodeAt(start - 1))) {
    start -= 1;
  }

  const dot = filePath.lastIndexOf('.', end - 1);
  if (dot <= start) {
    return '';
  }
  return filePath.slice(dot, end);
}

function isSeparator(code: number): boolean {
  return code === 47 || code === 92;
}
