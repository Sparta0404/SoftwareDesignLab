/** 0 起算的源码位置。character 按 UTF-16 码元计，与 vscode.Position 一致。 */
export interface OutlinePosition {
  readonly line: number;
  readonly character: number;
}

/** 半开区间 [start, end)，与 vscode.Range 一致。 */
export interface OutlineRange {
  readonly start: OutlinePosition;
  readonly end: OutlinePosition;
}

/**
 * 大纲中的一个元素。
 *
 * label 为 `tag#id`；没有 id 时只有标签名。range 覆盖从开始标签到结束标签的整个元素，
 * selectionRange 只覆盖开始标签名，点击后定位到该元素所在行。
 */
export interface OutlineNode {
  readonly label: string;
  readonly range: OutlineRange;
  readonly selectionRange: OutlineRange;
  readonly children: readonly OutlineNode[];
}
