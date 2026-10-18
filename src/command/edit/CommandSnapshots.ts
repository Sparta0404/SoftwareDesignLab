import type { Shape } from '../../model/shape/Shape';

interface GeometrySnapshot {
  readonly shape: Shape;
  readonly values: readonly number[];
}

/** 捕获一棵子树中每个节点自身的几何值，用于无浮点误差地撤销 move / scale。 */
export function captureGeometry(shape: Shape): GeometrySnapshot[] {
  return shape.walk().map((item) => ({ shape: item, values: item.geometryValues() }));
}

export function restoreGeometry(snapshots: readonly GeometrySnapshot[]): void {
  for (const snapshot of snapshots) {
    snapshot.shape.restoreGeometry(snapshot.values);
  }
}
