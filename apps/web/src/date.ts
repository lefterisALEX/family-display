import type { CalendarEvent } from './types';

const DAYS_FROM_MONDAY: Record<string, number> = {
  Sun: 6,
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
};

function shiftDateStr(dateStr: string, days: number): string {
  return new Date(Date.parse(`${dateStr}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function zonedOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUTC - date.getTime();
}

// Returns a Date for 00:00 local time on the given YYYY-MM-DD date in timeZone.
function zonedMidnight(dateStr: string, timeZone: string): Date {
  const noon = new Date(`${dateStr}T12:00:00Z`);
  const offset = zonedOffsetMs(noon, timeZone);
  const midnight = new Date(noon.getTime() - offset - 12 * 3_600_000);
  const midnightOffset = zonedOffsetMs(midnight, timeZone);
  if (midnightOffset !== offset) {
    return new Date(midnight.getTime() + (offset - midnightOffset));
  }
  return midnight;
}

export function startOfWeek(input: Date, timeZone?: string): Date {
  if (timeZone) {
    const dateStr = toDateString(input, timeZone);
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
    }).format(input);
    const diff = DAYS_FROM_MONDAY[weekday] ?? 0;
    return zonedMidnight(shiftDateStr(dateStr, -diff), timeZone);
  }

  const d = new Date(input);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfCurrentWeek(timeZone?: string): Date {
  return startOfWeek(new Date(), timeZone);
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
