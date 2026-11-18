import crypto from 'node:crypto';
import ical from 'node-ical';
import { db } from './db.js';
import { dateStringToUtcTs, toDateString } from './dates.js';
import type { SourceRow, SyncResult } from './types.js';

const WINDOW_PAST_MS = 90 * 24 * 60 * 60 * 1000;
const WINDOW_FUTURE_MS = 365 * 24 * 60 * 60 * 1000;

interface NormalizedEvent {
  externalId: string;
  recurrenceId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startDisplay: string;
  endDisplay: string;
  startTs: number;
  endTs: number;
  allDay: boolean;
  timezone: string | null;
  status: string | null;
  organizer: string | null;
}

function normalizeEvent(input: {
  uid: string;
  recurrenceId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  timezone: string | null;
  status: string | null;
  organizer: string | null;
}): NormalizedEvent {
  if (input.allDay) {
    // The server runs in UTC (see tz.ts), so node-ical parses VALUE=DATE
    // entries as UTC midnight. Derive the calendar date in UTC so the
    // all-day date stays stable regardless of the display timezone.
    const startDate = toDateString(input.start, 'UTC');
    let endDate = toDateString(input.end, 'UTC');
    if (endDate <= startDate) {
      const d = new Date(input.start);
      d.setUTCDate(d.getUTCDate() + 1);
      endDate = toDateString(d, 'UTC');
    }
    return {
      externalId: input.uid,
      recurrenceId: input.recurrenceId,
      title: input.title,
      description: input.description,
      location: input.location,
      startDisplay: startDate,
      endDisplay: endDate,
      startTs: dateStringToUtcTs(startDate),
      endTs: dateStringToUtcTs(endDate),
      allDay: true,
      timezone: input.timezone,
      status: input.status,
      organizer: input.organizer,
    };
  }

  return {
    externalId: input.uid,
    recurrenceId: input.recurrenceId,
    title: input.title,
    description: input.description,
    location: input.location,
    startDisplay: input.start.toISOString(),
    endDisplay: input.end.toISOString(),
    startTs: input.start.getTime(),
    endTs: input.end.getTime(),
    allDay: false,
    timezone: input.timezone,
    status: input.status,
    organizer: input.organizer,
  };
}

function findOverride(
  occurrence: Date,
  allDay: boolean,
  overrides: Record<string, any> | undefined,
): any | undefined {
  if (!overrides) return undefined;
  const occDate = toDateString(occurrence, 'UTC');
  const occTs = occurrence.getTime();
  for (const [key, ov] of Object.entries(overrides)) {
    if (allDay) {
      if (key.slice(0, 10) === occDate) return ov;
    } else {
      const t = new Date(key).getTime();
      if (!Number.isNaN(t) && Math.abs(t - occTs) < 60_000) return ov;
    }
  }
  return undefined;
}

function expandEvents(parsed: Record<string, any>): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  const now = Date.now();
  const windowStart = new Date(now - WINDOW_PAST_MS);
  const windowEnd = new Date(now + WINDOW_FUTURE_MS);

  for (const key of Object.keys(parsed)) {
    const vevent = parsed[key];
    if (!vevent || vevent.type !== 'VEVENT') continue;

    const allDay = vevent.datetype === 'date';
    const masterStart = vevent.start instanceof Date ? vevent.start : new Date(vevent.start);
    if (Number.isNaN(masterStart.getTime())) continue;

    const fallbackDuration = allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const masterEnd = vevent.end instanceof Date
      ? vevent.end
      : vevent.end
        ? new Date(vevent.end)
        : new Date(masterStart.getTime() + fallbackDuration);
    const durationMs = Math.max(0, masterEnd.getTime() - masterStart.getTime());

    const title = typeof vevent.summary === 'string' ? vevent.summary : '(No title)';
    const description = typeof vevent.description === 'string' ? vevent.description : null;
    const location = typeof vevent.location === 'string' ? vevent.location : null;
    const timezone = (masterStart as any)?.tz ?? null;
    const status = typeof vevent.status === 'string' ? vevent.status : null;
    const organizer = typeof vevent.organizer === 'string'
      ? vevent.organizer
      : (vevent.organizer?.val ?? null);
    const uid = typeof vevent.uid === 'string'
      ? vevent.uid
      : `${title}-${masterStart.toISOString()}`;

    const rrule = vevent.rrule;
    const hasRule = rrule && typeof rrule.between === 'function';

    if (hasRule) {
      let occurrences: Date[] = [];
      try {
        occurrences = rrule.between(windowStart, windowEnd, true);
      } catch {
        occurrences = [];
      }

      const exdates = new Set<number>();
      if (vevent.exdate) {
        for (const k of Object.keys(vevent.exdate)) {
          const d = vevent.exdate[k];
          if (d instanceof Date) exdates.add(d.getTime());
          else if (typeof d === 'string') {
            const t = new Date(d).getTime();
            if (!Number.isNaN(t)) exdates.add(t);
          }
        }
      }

      for (const occ of occurrences) {
        if (exdates.has(occ.getTime())) continue;

        const override = findOverride(occ, allDay, vevent.recurrences);
        if (override) {
          const ovStart = override.start instanceof Date
            ? override.start
            : new Date(override.start);
          if (Number.isNaN(ovStart.getTime())) continue;
          const ovEnd = override.end instanceof Date
            ? override.end
            : override.end
              ? new Date(override.end)
              : new Date(ovStart.getTime() + durationMs);

          out.push(normalizeEvent({
            uid,
            recurrenceId: occ.toISOString(),
            title: typeof override.summary === 'string' ? override.summary : title,
            description: typeof override.description === 'string' ? override.description : description,
            location: typeof override.location === 'string' ? override.location : location,
            start: ovStart,
            end: ovEnd,
            allDay,
            timezone,
            status: typeof override.status === 'string' ? override.status : status,
            organizer,
          }));
        } else {
          out.push(normalizeEvent({
            uid,
            recurrenceId: occ.toISOString(),
            title,
            description,
            location,
            start: occ,
            end: new Date(occ.getTime() + durationMs),
            allDay,
            timezone,
            status,
            organizer,
          }));
        }
      }
    } else {
      out.push(normalizeEvent({
        uid,
        recurrenceId: null,
        title,
        description,
        location,
        start: masterStart,
        end: masterEnd,
        allDay,
        timezone,
        status,
        organizer,
      }));
    }
  }

  return out;
}

function eventId(sourceId: string, externalId: string, recurrenceId: string | null): string {
  return crypto
    .createHash('sha256')
    .update(`${sourceId}\u0000${externalId}\u0000${recurrenceId ?? ''}`)
    .digest('hex')
    .slice(0, 32);
}

export async function syncSource(sourceId: string): Promise<SyncResult> {
  const row = db.prepare('SELECT * FROM sources WHERE id = ?').get(sourceId) as SourceRow | undefined;
  if (!row) throw new Error(`Source not found: ${sourceId}`);

  const started = Date.now();

  try {
    const res = await fetch(row.url, {
      headers: {
        'User-Agent': 'family-calendar/0.1',
        Accept: 'text/calendar, text/plain, */*',
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    const parsed = ical.parseICS(text) as Record<string, any>;
    const events = expandEvents(parsed);

    const now = new Date().toISOString();
    const deleteEvents = db.prepare('DELETE FROM events WHERE source_id = ?');
    const insert = db.prepare(`
      INSERT INTO events (
        id, source_id, external_id, recurrence_id, title, description, location,
        start_display, end_display, start_ts, end_ts, all_day, timezone, status, organizer, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction((items: NormalizedEvent[]) => {
      deleteEvents.run(sourceId);
      for (const e of items) {
        insert.run(
          eventId(sourceId, e.externalId, e.recurrenceId),
          sourceId,
          e.externalId,
          e.recurrenceId,
          e.title,
          e.description,
          e.location,
          e.startDisplay,
          e.endDisplay,
          e.startTs,
          e.endTs,
          e.allDay ? 1 : 0,
          e.timezone,
          e.status,
          e.organizer,
          now,
        );
      }
    });

    tx(events);

    db.prepare('UPDATE sources SET last_synced_at = ?, last_error = NULL WHERE id = ?')
      .run(now, sourceId);

    return {
      sourceId,
      sourceName: row.name,
      count: events.length,
      ok: true,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.prepare('UPDATE sources SET last_error = ? WHERE id = ?').run(message, sourceId);
    return {
      sourceId,
      sourceName: row.name,
      count: 0,
      ok: false,
      error: message,
      durationMs: Date.now() - started,
    };
  }
}

export async function syncAll(): Promise<SyncResult[]> {
  const rows = db.prepare('SELECT * FROM sources WHERE enabled = 1').all() as SourceRow[];
  const results: SyncResult[] = [];
  for (const row of rows) {
    results.push(await syncSource(row.id));
  }
  return results;
}
