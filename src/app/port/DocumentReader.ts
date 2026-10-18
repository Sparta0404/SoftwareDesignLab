import type { SvgDocument } from '../../model/document/SvgDocument';
import type { WarningSink } from './WarningSink';

/**
 * 文档读取端口，由 io 层实现。
 * 解析外部 SVG 时发现缺失 id 等非致命问题，通过 warningSink 报告。
 */
export interface DocumentReader {
  read(path: string, warningSink: WarningSink): SvgDocument;
}
