import { describe, expect, it } from 'vitest';
import type { OutlineNode, OutlineRange } from '../../src/outline/SvgOutlineNode';
import { SvgOutlineParser } from '../../src/outline/SvgOutlineParser';

function labels(nodes: readonly OutlineNode[]): unknown {
  return nodes.map((node) => ({
    label: node.label,
    children: labels(node.children),
  }));
}

/** 与解析器分开写的直线扫描，用来核对行列是否按源码换行计算。 */
function offsetAt(text: string, line: number, character: number): number {
  let currentLine = 0;
  let index = 0;
  while (currentLine < line) {
    const code = text.charCodeAt(index);
    if (code === 10) {
      index += 1;
      currentLine += 1;
    } else if (code === 13) {
      index += 1;
      if (text.charCodeAt(index) === 10) index += 1;
      currentLine += 1;
    } else {
      index += 1;
    }
  }
  return index + character;
}

function slice(text: string, range: OutlineRange): string {
  return text.slice(
    offsetAt(text, range.start.line, range.start.character),
    offsetAt(text, range.end.line, range.end.character),
  );
}

function tagOf(label: string): string {
  const hash = label.indexOf('#');
  return hash === -1 ? label : label.slice(0, hash);
}

function assertRanges(text: string, nodes: readonly OutlineNode[]): void {
  for (const node of nodes) {
    const tagName = tagOf(node.label);
    const [start, end] = [
      offsetAt(text, node.range.start.line, node.range.start.character),
      offsetAt(text, node.range.end.line, node.range.end.character),
    ];
    const [selectionStart, selectionEnd] = [
      offsetAt(text, node.selectionRange.start.line, node.selectionRange.start.character),
      offsetAt(text, node.selectionRange.end.line, node.selectionRange.end.character),
    ];

    expect(selectionStart).toBeGreaterThanOrEqual(start);
    expect(selectionEnd).toBeLessThanOrEqual(end);
    expect(text.slice(selectionStart, selectionEnd)).toBe(tagName);
    expect(text.slice(start, end).startsWith(`<${tagName}`)).toBe(true);
    expect(text.slice(start, end).endsWith('>')).toBe(true);

    for (const child of node.children) {
      const childStart = offsetAt(text, child.range.start.line, child.range.start.character);
      const childEnd = offsetAt(text, child.range.end.line, child.range.end.character);
      expect(childStart).toBeGreaterThan(start);
      expect(childEnd).toBeLessThan(end);
    }
    assertRanges(text, node.children);
  }
}

describe('SvgOutlineParser', () => {
  const parser = new SvgOutlineParser();

  it('按嵌套建立 svg > g > g > rect，有 id 时使用 tag#id', () => {
    const text = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <g id="outer">
    <g>
      <rect id="start" x="0" y="0" width="10" height="10"/>
    </g>
  </g>
</svg>`;

    const outline = parser.parse(text);

    expect(labels(outline)).toEqual([
      {
        label: 'svg',
        children: [
          {
            label: 'g#outer',
            children: [
              {
                label: 'g',
                children: [{ label: 'rect#start', children: [] }],
              },
            ],
          },
        ],
      },
    ]);
    assertRanges(text, outline);
  });

  it('没有 id 或 id 为空时只显示标签名', () => {
    const text = '<svg><text>plain</text><text id="">also plain</text></svg>';

    expect(labels(parser.parse(text))).toEqual([
      {
        label: 'svg',
        children: [
          { label: 'text', children: [] },
          { label: 'text', children: [] },
        ],
      },
    ]);
  });

  it('自闭合元素的 range 覆盖整个标签，selectionRange 覆盖标签名', () => {
    const text = '<svg><rect id="start"/></svg>';
    const rect = parser.parse(text)[0].children[0];

    expect(rect.label).toBe('rect#start');
    expect(slice(text, rect.range)).toBe('<rect id="start"/>');
    expect(slice(text, rect.selectionRange)).toBe('rect');
    expect(rect.children).toEqual([]);
  });

  it('跨行开始标签仍把 selectionRange 放在标签名上', () => {
    const text = `<svg>
  <rect
    id="start"
    x="0"/>
</svg>`;
    const rect = parser.parse(text)[0].children[0];

    expect(rect.label).toBe('rect#start');
    expect(rect.selectionRange.start.line).toBe(1);
    expect(slice(text, rect.selectionRange)).toBe('rect');
    expect(slice(text, rect.range)).toBe('<rect\n    id="start"\n    x="0"/>');
  });

  it('忽略注释、文本、CDATA、处理指令和文档声明', () => {
    const text = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg>
<svg>
  before
  <!-- <rect id="ghost"/> -->
  <text id="label">A &amp; B</text>
  <![CDATA[<circle id="hidden"/>]]>
  <?note ignore?>
  <g id="g1"><rect id="start"/></g>
</svg>`;

    expect(labels(parser.parse(text))).toEqual([
      {
        label: 'svg',
        children: [
          { label: 'text#label', children: [] },
          {
            label: 'g#g1',
            children: [{ label: 'rect#start', children: [] }],
          },
        ],
      },
    ]);
    assertRanges(text, parser.parse(text));
  });

  it('selectionRange 落在第 3 行的 rect#start 上', () => {
    const text = [
      '<svg>',
      '  <g id="layer">',
      '    <rect id="start" x="0" y="0" width="10" height="10"/>',
      '  </g>',
      '</svg>',
    ].join('\n');
    const svg = parser.parse(text)[0];
    const group = svg.children[0];
    const rect = group.children[0];
    const rectLine = text.split('\n')[2];

    expect(rect.label).toBe('rect#start');
    expect(rect.range.start.line).toBe(2);
    expect(rect.selectionRange.start.line).toBe(2);
    expect(rect.selectionRange.end.line).toBe(2);
    expect(rectLine[rect.range.start.character]).toBe('<');
    expect(
      rectLine.slice(rect.selectionRange.start.character, rect.selectionRange.end.character),
    ).toBe('rect');
    expect(rectLine.slice(rect.range.start.character, rect.range.end.character)).toBe(
      '<rect id="start" x="0" y="0" width="10" height="10"/>',
    );
    expect(slice(text, group.range)).toBe(
      '<g id="layer">\n    <rect id="start" x="0" y="0" width="10" height="10"/>\n  </g>',
    );
    expect(slice(text, group.selectionRange)).toBe('g');
    expect(slice(text, svg.selectionRange)).toBe('svg');
  });

  it('按 CRLF 计算行号', () => {
    const text = '<svg>\r\n  <rect id="start"/>\r\n</svg>';
    const rect = parser.parse(text)[0].children[0];

    expect(rect.selectionRange.start.line).toBe(1);
    expect(slice(text, rect.range)).toBe('<rect id="start"/>');
    expect(slice(text, parser.parse(text)[0].range)).toBe(text);
  });

  it('结束标签的 > 前有空白时 range 仍包含整个元素', () => {
    const text = '<svg><g id="layer">\n  <rect id="start"/>\n</g ></svg>';
    const group = parser.parse(text)[0].children[0];

    expect(slice(text, group.range)).toBe('<g id="layer">\n  <rect id="start"/>\n</g >');
    expect(slice(text, group.selectionRange)).toBe('g');
  });

  it('同一个解析器对编辑前后的文本给出不同结果', () => {
    const before = '<svg><rect id="start"/></svg>';
    const after = '<svg><rect id="start"/><circle id="end"/></svg>';

    const first = parser.parse(before);
    const second = parser.parse(after);
    const again = parser.parse(before);

    expect(labels(first)).toEqual([
      { label: 'svg', children: [{ label: 'rect#start', children: [] }] },
    ]);
    expect(labels(second)).toEqual([
      {
        label: 'svg',
        children: [
          { label: 'rect#start', children: [] },
          { label: 'circle#end', children: [] },
        ],
      },
    ]);
    expect(again).toEqual(first);
  });

  it('不完整 XML 返回空数组且不抛错', () => {
    const samples = [
      '',
      '   ',
      '<svg>',
      '<svg',
      '<svg><rect></svg>',
      '<svg><rect></rect>',
      '<svg><rect></rect></svg',
      'plain text',
    ];

    for (const text of samples) {
      expect(() => parser.parse(text)).not.toThrow();
      expect(parser.parse(text)).toEqual([]);
    }
  });

  it('属性值里的实体按 XML 规则解码，但不改变源码范围', () => {
    const text = '<svg><rect id="a&amp;b"/></svg>';
    const rect = parser.parse(text)[0].children[0];

    expect(rect.label).toBe('rect#a&b');
    expect(slice(text, rect.range)).toBe('<rect id="a&amp;b"/>');
  });
});
