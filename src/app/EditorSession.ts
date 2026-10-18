import { CommandHistory } from '../command/history/CommandHistory';
import type { EditCommand } from '../command/history/EditCommand';
import { SvgDocument } from '../model/document/SvgDocument';
import { Numbers } from '../model/shape/Numbers';
import { FileError } from './error/FileError';
import { NoDocumentError } from './error/NoDocumentError';
import type { DocumentReader } from './port/DocumentReader';
import type { DocumentWriter } from './port/DocumentWriter';
import type { WarningSink } from './port/WarningSink';

export type CommandFactory = (document: SvgDocument) => EditCommand;
export type DocumentInspector<T> = (document: SvgDocument) => T;

/**
 * 编辑会话外观（Facade）。
 *
 * 它是外层通道访问当前文档与历史的唯一入口。CLI 用回调构造命令，
 * 因而无需直接 import model；文件读写则通过 app 自己定义的端口完成，
 * app 不依赖任何 io 实现。
 */
export class EditorSession {
  private document: SvgDocument | undefined;
  private currentPath: string | undefined;
  private readonly history = new CommandHistory();

  constructor(
    private readonly reader: DocumentReader,
    private readonly writer: DocumentWriter,
    private readonly warningSink: WarningSink,
  ) {}

  init(width = 800, height = 600): string {
    // 构造成功后才替换当前文档，非法尺寸不会破坏原会话。
    const next = new SvgDocument(width, height);
    this.document = next;
    this.currentPath = undefined;
    this.history.lockByIo();
    return `canvas ${this.size(next)} created`;
  }

  read(path: string): string {
    // 端口失败时保留旧文档、路径和历史。
    const next = this.reader.read(path, this.warningSink);
    this.document = next;
    this.currentPath = path;
    this.history.lockByIo();
    return `read ${path} (${next.shapeCount} elements)`;
  }

  save(path?: string): string {
    const document = this.requireDocument();
    const target = path ?? this.currentPath;
    if (target === undefined) {
      throw new FileError("no file path. use 'save <file.svg>' first");
    }
    // 写入成功后才更新默认路径并建立历史边界。
    this.writer.write(target, document);
    this.currentPath = target;
    this.history.lockByIo();
    return `saved to ${target} (${document.shapeCount} elements)`;
  }

  /** 无参数只查询；传入尺寸则修改画布并建立不可跨越的历史边界。 */
  canvas(width?: number, height?: number): string {
    const document = this.requireDocument();
    if (width === undefined && height === undefined) {
      return `canvas ${this.size(document)}`;
    }
    document.resize(width, height);
    this.history.lockByIo();
    return `canvas resized to ${this.size(document)}`;
  }

  execute(factory: CommandFactory): string {
    const document = this.requireDocument();
    const command = factory(document);
    return this.history.execute(command);
  }

  undo(): string {
    this.requireDocument();
    return this.history.undo();
  }

  redo(): string {
    this.requireDocument();
    return this.history.redo();
  }

  /** 只读用例（tree / show / 测试）通过回调访问当前文档，不暴露可空状态。 */
  inspect<T>(inspector: DocumentInspector<T>): T {
    return inspector(this.requireDocument());
  }

  private requireDocument(): SvgDocument {
    if (this.document === undefined) {
      throw new NoDocumentError();
    }
    return this.document;
  }

  private size(document: SvgDocument): string {
    return `${Numbers.format(document.width)}x${Numbers.format(document.height)}`;
  }
}
