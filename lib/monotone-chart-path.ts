export interface ChartPathPoint {
  x: number;
  y: number;
}

export function monotonePath(points: ChartPathPoint[]): string {
  if (points.length < 2) return '';
  const count = points.length;
  const slopes: number[] = [];

  for (let index = 0; index < count - 1; index++) {
    const dx = points[index + 1].x - points[index].x;
    slopes.push(dx !== 0 ? (points[index + 1].y - points[index].y) / dx : 0);
  }

  const tangents: number[] = [];
  tangents[0] = slopes[0];
  tangents[count - 1] = slopes[count - 2];
  for (let index = 1; index < count - 1; index++) {
    if (slopes[index - 1] * slopes[index] <= 0) {
      tangents[index] = 0;
    } else {
      const dx = points[index + 1].x - points[index - 1].x;
      tangents[index] = dx !== 0
        ? (points[index + 1].y - points[index - 1].y) / dx
        : 0;
    }
  }

  let path = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let index = 0; index < count - 1; index++) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end.x - start.x;
    const control1X = start.x + dx / 3;
    const control1Y = start.y + tangents[index] * dx / 3;
    const control2X = end.x - dx / 3;
    const control2Y = end.y - tangents[index + 1] * dx / 3;
    path += ` C ${control1X.toFixed(1)},${control1Y.toFixed(1)} ${control2X.toFixed(1)},${control2Y.toFixed(1)} ${end.x.toFixed(1)},${end.y.toFixed(1)}`;
  }
  return path;
}
