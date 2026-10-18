import { readFileSync, writeFileSync } from 'node:fs';
import type { DocumentReader } from '../app/port/DocumentReader';
import type { DocumentWriter } from '../app/port/DocumentWriter';
import type { WarningSink } from '../app/port/WarningSink';
import { FileError } from '../app/error/FileError';
import type { SvgDocument } from '../model/document/SvgDocument';
import type { SvgParser } from './SvgParser';
import type { SvgSerializer } from './SvgSerializer';

/** 基于本地文件系统的文档端口适配器。 */
export class FileDocumentStore implements DocumentReader, DocumentWriter {
  constructor(
    private readonly parser: SvgParser,
    private readonly serializer: SvgSerializer,
  ) {}

  read(path: string, warningSink: WarningSink): SvgDocument {
    let xml: string;
    try {
      xml = readFileSync(path, 'utf8');
    } catch {
      throw new FileError(`cannot read file: ${path}`);
    }
    // 内容错误属于解析错误，不伪装成文件系统错误。
    return this.parser.parse(xml, warningSink);
  }

  write(path: string, document: SvgDocument): void {
    const xml = this.serializer.serialize(document);
    try {
      writeFileSync(path, xml, 'utf8');
    } catch {
      throw new FileError(`cannot write file: ${path}`);
    }
  }
}
