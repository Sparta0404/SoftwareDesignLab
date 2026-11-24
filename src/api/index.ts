/**
 * 插件公开门面：插件（plugins/*）只允许依赖这个文件，由 dependency-cruiser 规则保证。
 * 这里只再导出扩展点接口与公开的领域抽象；内核的其余部分（注册表、宿主、命令历史……）都不公开。
 */

// 插件协议
export type {
  ContributionKind,
  Plugin,
  PluginContext,
  PluginContributions,
  PluginManifest,
} from '../plugin/Plugin';

// 扩展点：图形、命令、属性、树装饰器
export type { ShapeBuilder, ShapeProvider } from '../factory/ShapeProvider';
export { AbstractShapeCreator } from '../factory/AbstractShapeCreator';
export type { Command, CommandContext } from '../cli/Command';
export type { TextOutput } from '../cli/TextOutput';
export { parseNumber, requireArgCount } from '../cli/Arguments';
export type { AttributeHandler, AttributeOutcome } from '../command/attribute/AttributeHandler';
export type { TreeDecorator, TreeNodeInfo } from '../view/TreeDecorator';

// 命令可以通过会话读取文档
export type { DocumentInspector, DocumentListener, EditorSession } from '../app/EditorSession';
export type { DocumentEvent } from '../model/document/DocumentEvent';
export { SvgDocument } from '../model/document/SvgDocument';

// 领域抽象
export { Shape } from '../model/shape/Shape';
export type { ShapeState } from '../model/shape/Shape';
export { GeometryShape } from '../model/shape/GeometryShape';
export { GroupShape } from '../model/shape/GroupShape';
export { Numbers } from '../model/shape/Numbers';

// 错误：插件抛出这些错误，CLI 统一输出 `error: <message>`
export { EditorError } from '../model/error/EditorError';
export { ContractViolationError } from '../model/error/ContractViolationError';
export { IdExistsError } from '../model/error/IdExistsError';
export { InvalidValueError } from '../model/error/InvalidValueError';
export { NoSuchShapeError } from '../model/error/NoSuchShapeError';
export { NotContainerError } from '../model/error/NotContainerError';
export { UnknownAttributeError } from '../model/error/UnknownAttributeError';
export { InvalidArgumentsError } from '../factory/error/InvalidArgumentsError';
