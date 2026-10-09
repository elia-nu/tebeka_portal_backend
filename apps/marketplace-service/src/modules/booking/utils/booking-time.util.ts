export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatMinutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function generateTimeIntervals(
  startTime: string,
  endTime: string,
  durationMinutes: number
): Array<{ startTime: string; endTime: string }> {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  const slots: Array<{ startTime: string; endTime: string }> = [];

  let current = startMin;
  while (current + durationMinutes <= endMin) {
    slots.push({
      startTime: formatMinutesToTime(current),
      endTime: formatMinutesToTime(current + durationMinutes),
    });
    current += durationMinutes;
  }

  return slots;
}
