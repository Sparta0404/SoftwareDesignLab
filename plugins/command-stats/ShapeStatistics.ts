import type { Shape } from '../../src/api';

/** 一份图形统计：叶子按类型计数（类型顺序为首次出现顺序）与容器数。 */
export interface ShapeStatistics {
  /** 叶子类型 -> 数量；Map 的插入顺序就是首次出现顺序。 */
  readonly leaves: ReadonlyMap<string, number>;
  readonly containers: number;
}

/**
 * 从画布根的子节点开始，按当前子节点顺序深度优先统计。
 * 叶子按 `tagName` 计数；容器（普通 `g` 与 box 等复合图形）只计入 containers；根自身不计入。
 */
export function collectStatistics(root: Shape): ShapeStatistics {
  const leaves = new Map<string, number>();
  let containers = 0;

  const visit = (shape: Shape): void => {
    if (shape.isContainer()) {
      containers += 1;
      shape.children().forEach(visit);
    } else {
      leaves.set(shape.tagName, (leaves.get(shape.tagName) ?? 0) + 1);
    }
  };
  root.children().forEach(visit);

  return { leaves, containers };
}

/** `rect: 3  circle: 1  text: 2  (total 6, containers 2)`；没有叶子时只有括号部分。 */
export function formatStatistics(statistics: ShapeStatistics): string {
  let total = 0;
  const parts: string[] = [];
  for (const [type, count] of statistics.leaves) {
    parts.push(`${type}: ${count}`);
    total += count;
  }
  parts.push(`(total ${total}, containers ${statistics.containers})`);
  return parts.join('  ');
}
