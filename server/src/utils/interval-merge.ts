export interface TimeInterval {
  startTime: Date;
  endTime: Date;
}

export function mergeAdjacentIntervals(_intervals: TimeInterval[]): TimeInterval[] {
  throw new Error('Not implemented: mergeAdjacentIntervals');
}
