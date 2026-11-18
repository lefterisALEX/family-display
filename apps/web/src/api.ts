import type { CalendarEvent, Source } from './types';

const BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed.message ?? parsed.error ?? text;
    } catch {
      // keep raw text
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function jsonHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json' };
}

export const api = {
  getSources: () => fetch(`${BASE}/sources`).then((r) => json<Source[]>(r)),

  addSource: (body: { name: string; url: string; color?: string }) =>
    fetch(`${BASE}/sources`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    }).then((r) => json<Source>(r)),

  updateSource: (
    id: string,
    body: Partial<{ name: string; url: string; color: string; enabled: boolean }>,
  ) =>
    fetch(`${BASE}/sources/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    }).then((r) => json<Source>(r)),

  deleteSource: (id: string) =>
    fetch(`${BASE}/sources/${encodeURIComponent(id)}`, { method: 'DELETE' }).then((r) =>
      json<{ ok: boolean }>(r),
    ),

  getEvents: (start: string, end: string, sourceIds?: string[]) => {
    const params = new URLSearchParams({ start, end });
    if (sourceIds && sourceIds.length > 0) {
      params.set('sources', sourceIds.join(','));
    }
    return fetch(`${BASE}/events?${params.toString()}`).then((r) =>
      json<CalendarEvent[]>(r),
    );
  },

  sync: () =>
    fetch(`${BASE}/sync`, { method: 'POST' }).then((r) =>
      json<{ results: unknown[] }>(r),
    ),

  getSettings: () =>
    fetch(`${BASE}/settings`).then((r) => json<{ timezone: string }>(r)),

  updateSettings: (body: { timezone: string }) =>
    fetch(`${BASE}/settings`, {
      method: 'PUT',
      headers: jsonHeaders(),
      body: JSON.stringify(body),
    }).then((r) => json<{ timezone: string }>(r)),
};
