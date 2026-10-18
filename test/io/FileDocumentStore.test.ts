import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WarningSink } from '../../src/app/port/WarningSink';
import { FileError } from '../../src/app/error/FileError';
import { FileDocumentStore } from '../../src/io/FileDocumentStore';
import { SvgParser } from '../../src/io/SvgParser';
import { SvgSerializer } from '../../src/io/SvgSerializer';
import { SvgDocument } from '../../src/model/document/SvgDocument';
import { BuiltinShapes } from '../../src/shapes/BuiltinShapes';
import { RectShape } from '../../src/shapes/rect/RectShape';

class WarningSinkSpy implements WarningSink {
  readonly messages: string[] = [];
  warn(message: string): void {
    this.messages.push(message);
  }
}

describe('FileDocumentStore', () => {
  let directory: string;
  let store: FileDocumentStore;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'svg-editor-'));
    store = new FileDocumentStore(
      new SvgParser(BuiltinShapes.createFactory()),
      new SvgSerializer(),
    );
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('实现 DocumentWriter 与 DocumentReader，文件可完整往返', () => {
    const path = join(directory, 'diagram.svg');
    const document = new SvgDocument(40, 30);
    const rect = new RectShape('r1', 1, 2, 3, 4);
    rect.setAttr('fill', 'red');
    document.insert(rect, document.root);

    store.write(path, document);
    expect(readFileSync(path, 'utf8')).toContain('<rect id="r1"');

    const readBack = store.read(path, new WarningSinkSpy());
    expect([readBack.width, readBack.height]).toEqual([40, 30]);
    expect(readBack.find('r1').summary()).toBe('x=1 y=2 w=3 h=4 fill=red');
  });

  it('不存在的文件转换为 cannot read file', () => {
    const path = join(directory, 'missing.svg');
    expect(() => store.read(path, new WarningSinkSpy())).toThrow(FileError);
    expect(() => store.read(path, new WarningSinkSpy())).toThrow(`cannot read file: ${path}`);
  });

  it('不可写路径转换为 cannot write file', () => {
    // 把目录本身当作目标文件，在 Windows / POSIX 上都会写入失败。
    expect(() => store.write(directory, new SvgDocument())).toThrow(FileError);
    expect(() => store.write(directory, new SvgDocument())).toThrow(
      `cannot write file: ${directory}`,
    );
  });

  it('文件已读到但内容非法时保留解析错误，不伪装成文件读取错误', () => {
    const path = join(directory, 'bad.svg');
    writeFileSync(path, '<svg><g></svg>', 'utf8');

    expect(() => store.read(path, new WarningSinkSpy())).toThrow('invalid XML');
  });
});
