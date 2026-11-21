import './tz.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { db, setSetting } from './db.js';
import { syncAll, syncSource } from './sync.js';
import { pickColor } from './colors.js';
import { toDateString } from './dates.js';
import { getTimezone, isValidTimezone } from './timezone.js';
import { fetchWeather, getWeatherConfig, invalidateWeatherCache } from './weather.js';
import type {
  CalendarEvent,
  EventRow,
  Source,
  SourceRow,
} from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

const STATIC_DIR = process.env.STATIC_DIR ?? path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(STATIC_DIR)) {
  await app.register(fastifyStatic, { root: STATIC_DIR, prefix: '/' });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return (reply as any).sendFile('index.html');
  });
}

function mapSource(row: SourceRow): Source {
  return {
    id: row.id,
    name: row.name,
    type: row.type as Source['type'],
    url: row.url,
    color: row.color,
    enabled: row.enabled === 1,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
    createdAt: row.created_at,
  };
}

function mapEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceName: row.source_name,
    sourceColor: row.source_color,
    title: row.title,
    description: row.description,
    location: row.location,
    start: row.start_display,
    end: row.end_display,
    startTs: row.start_ts,
    endTs: row.end_ts,
    allDay: row.all_day === 1,
    timezone: row.timezone,
    status: row.status,
    organizer: row.organizer,
    recurrenceId: row.recurrence_id,
  };
}

function assertHttpUrl(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http and https URLs are supported');
  }
  return value;
}

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

app.get('/api/health', async () => ({ ok: true, time: new Date().toISOString() }));

app.get('/api/settings', async () => ({
  timezone: getTimezone(),
  weather: getWeatherConfig(),
}));

const weatherUnitsSchema = z.enum(['c', 'f']);

app.put('/api/settings', async (req) => {
  const body = z.object({
    timezone: z.string().trim().min(1).max(100).optional(),
    weather: z.object({
      latitude: z.union([z.number(), z.string()]).optional(),
      longitude: z.union([z.number(), z.string()]).optional(),
      units: weatherUnitsSchema.optional(),
    }).optional(),
  }).parse(req.body);

  if (body.timezone !== undefined) {
    if (!isValidTimezone(body.timezone)) {
      throw new Error(`Invalid timezone: ${body.timezone}`);
    }
    setSetting('timezone', body.timezone);
  }

  if (body.weather) {
    if (body.weather.latitude !== undefined) setSetting('weather.latitude', String(body.weather.latitude));
    if (body.weather.longitude !== undefined) setSetting('weather.longitude', String(body.weather.longitude));
    if (body.weather.units !== undefined) setSetting('weather.units', body.weather.units);
    invalidateWeatherCache();
  }

  return {
    timezone: getTimezone(),
    weather: getWeatherConfig(),
  };
});

app.get('/api/weather', async () => fetchWeather());

app.get('/api/sources', async () => {
  const rows = db.prepare('SELECT * FROM sources ORDER BY created_at ASC').all() as SourceRow[];
  return rows.map(mapSource);
});

app.post('/api/sources', async (req) => {
  const body = z.object({
    name: z.string().trim().min(1).max(100),
    url: z.string().url(),
    color: colorSchema.optional(),
  }).parse(req.body);

  assertHttpUrl(body.url);

  const existing = db.prepare('SELECT color FROM sources').all() as { color: string }[];
  const color = body.color ?? pickColor(existing.map((r) => r.color));
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO sources (id, name, type, url, color, enabled, created_at)
    VALUES (?, ?, 'ics', ?, ?, 1, ?)
  `).run(id, body.name, body.url, color, createdAt);

  await syncSource(id);

  const row = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as SourceRow;
  return mapSource(row);
});

app.patch('/api/sources/:id', async (req) => {
  const { id } = req.params as { id: string };
  const body = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    url: z.string().url().optional(),
    color: colorSchema.optional(),
    enabled: z.boolean().optional(),
  }).parse(req.body);

  const updates: string[] = [];
  const params: any[] = [];

  if (body.name !== undefined) {
    updates.push('name = ?');
    params.push(body.name);
  }
  if (body.url !== undefined) {
    assertHttpUrl(body.url);
    updates.push('url = ?');
    params.push(body.url);
  }
  if (body.color !== undefined) {
    updates.push('color = ?');
    params.push(body.color);
  }
  if (body.enabled !== undefined) {
    updates.push('enabled = ?');
    params.push(body.enabled ? 1 : 0);
  }

  const current = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as SourceRow | undefined;
  if (!current) {
    throw new Error('Source not found');
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE sources SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  if (body.url !== undefined) {
    await syncSource(id);
  }

  const row = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as SourceRow;
  return mapSource(row);
});

app.delete('/api/sources/:id', async (req) => {
  const { id } = req.params as { id: string };
  db.prepare('DELETE FROM sources WHERE id = ?').run(id);
  return { ok: true };
});

app.post('/api/sync', async () => {
  const results = await syncAll();
  return { results };
});

app.get('/api/events', async (req) => {
  const q = z.object({
    start: z.string().optional(),
    end: z.string().optional(),
    sources: z.string().optional(),
  }).parse(req.query);

  const startDate = q.start ? new Date(q.start) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const endDate = q.end ? new Date(q.end) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('Invalid start or end date');
  }

  const startTs = startDate.getTime();
  const endTs = endDate.getTime();
  const startStr = toDateString(startDate);
  const endStr = toDateString(endDate);

  const sourceIds = q.sources ? q.sources.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const params: any[] = [endStr, startStr, endTs, startTs];

  let sql = `
    SELECT e.*, s.name AS source_name, s.color AS source_color
    FROM events e
    JOIN sources s ON s.id = e.source_id
    WHERE (
      (e.all_day = 1 AND e.start_display < ? AND e.end_display > ?)
      OR
      (e.all_day = 0 AND e.start_ts < ? AND e.end_ts > ?)
    )
  `;

  if (sourceIds.length > 0) {
    sql += ` AND e.source_id IN (${sourceIds.map(() => '?').join(',')})`;
    params.push(...sourceIds);
  }

  sql += ' ORDER BY e.all_day DESC, e.start_ts ASC';

  const rows = db.prepare(sql).all(...params) as EventRow[];
  return rows.map(mapEvent);
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

await app.listen({ port, host });

const syncInterval = Number(process.env.SYNC_INTERVAL_MS ?? 15 * 60 * 1000);
setInterval(() => {
  syncAll().catch((err) => app.log.error({ err }, 'background sync failed'));
}, syncInterval).unref();

syncAll().catch((err) => app.log.error({ err }, 'initial sync failed'));
