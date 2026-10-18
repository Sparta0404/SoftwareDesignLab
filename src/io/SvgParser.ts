import type { WarningSink } from '../app/port/WarningSink';
import type { ShapeFactory } from '../factory/ShapeFactory';
import { SvgDocument } from '../model/document/SvgDocument';
import { InvalidValueError } from '../model/error/InvalidValueError';
import { Numbers } from '../model/shape/Numbers';
import type { Shape } from '../model/shape/Shape';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

type OrderedNode = Record<string, unknown>;
type Attributes = Record<string, string>;

/**
 * 把 SVG XML 解析为领域模型。
 *
 * preserveOrder 保留 SVG 子元素顺序（即 z-order）；具体图形构造完全委托给
 * ShapeFactory，因此解析器不认识 rect / circle 等具体类。
 */
export class SvgParser {
  private readonly xmlParser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: '',
    textNodeName: '#text',
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: false,
    ignoreDeclaration: true,
  });

  constructor(private readonly factory: ShapeFactory) {}

  parse(xml: string, warningSink: WarningSink): SvgDocument {
    const validation = XMLValidator.validate(xml);
    if (validation !== true) {
      throw new InvalidValueError(`invalid XML: ${validation.err.msg}`);
    }

    const nodes = this.xmlParser.parse(xml) as OrderedNode[];
    const rootNode = nodes.find((node) => this.elementName(node) !== undefined);
    if (rootNode === undefined || this.elementName(rootNode) !== 'svg') {
      throw new InvalidValueError('root element must be <svg>');
    }

    const rootAttributes = this.attributesOf(rootNode);
    const width = this.dimension(rootAttributes, 'width', 800);
    const height = this.dimension(rootAttributes, 'height', 600);
    const document = new SvgDocument(width, height);
    const children = this.childrenOf(rootNode, 'svg');

    // 先收集全文档显式 id，自动编号不会与后面才出现的显式 id 冲突。
    const usedIds = new Set<string>();
    this.collectExplicitIds(children, usedIds);
    const counters = new Map<string, number>();

    for (const child of children) {
      this.parseElement(child, document, document.root, warningSink, usedIds, counters);
    }
    return document;
  }

  private parseElement(
    node: OrderedNode,
    document: SvgDocument,
    parent: Shape,
    warningSink: WarningSink,
    usedIds: Set<string>,
    counters: Map<string, number>,
  ): void {
    const tagName = this.elementName(node);
    if (tagName === undefined) return; // 缩进文本等非元素节点。

    const attributes = this.attributesOf(node);
    let id = attributes.id;
    if (id === undefined || id.length === 0) {
      id = this.nextId(tagName, usedIds, counters);
      warningSink.warn(`assigned id ${id} to unnamed <${tagName}>`);
    }

    const children = this.childrenOf(node, tagName);
    const text = children
      .filter((child) => Object.hasOwn(child, '#text'))
      .map((child) => String(child['#text']))
      .join('');
    const shape = this.factory.createFromSvg(tagName, id, new Map(Object.entries(attributes)), text);
    document.insert(shape, parent);

    for (const child of children) {
      this.parseElement(child, document, shape, warningSink, usedIds, counters);
    }
  }

  private collectExplicitIds(nodes: readonly OrderedNode[], ids: Set<string>): void {
    for (const node of nodes) {
      const tagName = this.elementName(node);
      if (tagName === undefined) continue;
      const id = this.attributesOf(node).id;
      if (id !== undefined && id.length > 0) ids.add(id);
      this.collectExplicitIds(this.childrenOf(node, tagName), ids);
    }
  }

  private nextId(tagName: string, usedIds: Set<string>, counters: Map<string, number>): string {
    let serial = counters.get(tagName) ?? 0;
    let candidate: string;
    do {
      serial += 1;
      candidate = `${tagName}${serial}`;
    } while (usedIds.has(candidate));
    counters.set(tagName, serial);
    usedIds.add(candidate);
    return candidate;
  }

  private elementName(node: OrderedNode): string | undefined {
    return Object.keys(node).find((key) => key !== ':@' && key !== '#text');
  }

  private attributesOf(node: OrderedNode): Attributes {
    return (node[':@'] as Attributes | undefined) ?? {};
  }

  private childrenOf(node: OrderedNode, tagName: string): OrderedNode[] {
    const value = node[tagName];
    return Array.isArray(value) ? (value as OrderedNode[]) : [];
  }

  private dimension(attributes: Attributes, name: 'width' | 'height', fallback: number): number {
    const raw = attributes[name];
    return raw === undefined ? fallback : Numbers.parse(raw);
  }
}
