export type GridPos = { gridCol: number; gridRow: number };

/**
 * Cluster values into buckets where values within `threshold` of each other
 * are grouped together. Returns the representative value for each bucket.
 */
export function cluster(values: number[], threshold: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const buckets: number[] = [];
  for (const v of sorted) {
    if (buckets.length === 0 || Math.abs(v - buckets[buckets.length - 1]) > threshold) {
      buckets.push(v);
    }
  }
  return buckets;
}

export type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Given a list of rectangles, infer their grid column and row by clustering
 * their center-X (columns) and top-Y (rows) coordinates.
 */
export function computeGridPositions(
  rects: RectLike[],
  threshold = 40
): GridPos[] {
  const xs = rects.map((r) => r.left + r.width / 2);
  const colBuckets = cluster(xs, threshold);

  const ys = rects.map((r) => r.top);
  const rowBuckets = cluster(ys, threshold);

  return rects.map((r) => {
    const cx = r.left + r.width / 2;
    const top = r.top;
    return {
      gridCol: colBuckets.findIndex((b) => Math.abs(b - cx) <= threshold),
      gridRow: rowBuckets.findIndex((b) => Math.abs(b - top) <= threshold),
    };
  });
}
