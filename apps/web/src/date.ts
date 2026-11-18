import type { CalendarEvent } from './types';

export function startOfWeek(input: Date): Date {
  const d = new Date(input);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(input: Date, days: number): Date {
  const d = new Date(input);
  d.setDate(d.getDate() + days);
  return d;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// en-CA yields YYYY-MM-DD; when a timeZone is supplied the date is computed
// in that zone instead of the browser's local zone.
export function toDateString(d: Date, timeZone?: string): string {
  if (timeZone) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(d: Date, timeZone?: string): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  });
}

export function formatTime(d: Date, timeZone?: string): string {
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  });
}

export function eventOverlapsDay(
  event: CalendarEvent,
  day: Date,
  timeZone?: string,
): boolean {
  if (event.allDay) {
    const dayStr = toDateString(day, timeZone);
    return dayStr >= event.start && dayStr < event.end;
  }

  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = addDays(dayStart, 1);

  const start = new Date(event.start);
  const end = new Date(event.end);

  return start < dayEnd && end > dayStart;
}

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.startTs - b.startTs;
  });
}
