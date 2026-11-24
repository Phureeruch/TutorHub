export interface TimeInterval {
  startTime: Date;
  endTime: Date;
}

/**
 * BR-13: Sorts intervals by startTime and merges any consecutive intervals
 * whose boundary touches (`prev.endTime.getTime() === curr.startTime.getTime()`).
 */
export function mergeAdjacentIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals]
    .map((item) => ({
      startTime: new Date(item.startTime.getTime()),
      endTime: new Date(item.endTime.getTime()),
    }))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const merged: TimeInterval[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i]!;
    const last = merged[merged.length - 1]!;

    if (last.endTime.getTime() === current.startTime.getTime()) {
      last.endTime = new Date(Math.max(last.endTime.getTime(), current.endTime.getTime()));
    } else {
      merged.push(current);
    }
  }

  return merged;
}
