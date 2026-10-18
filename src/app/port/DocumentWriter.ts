import type { SvgDocument } from '../../model/document/SvgDocument';

/** 文档写入端口，由 io 层实现。 */
export interface DocumentWriter {
  write(path: string, document: SvgDocument): void;
}
