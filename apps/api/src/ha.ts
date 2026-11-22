import { getSetting, setSetting } from './db.js';

export interface HaEntityRef {
  id: string;
  name: string;
}

export interface HaEntityConfig {
  temperatures: HaEntityRef[];
  lights: HaEntityRef[];
  scenes: HaEntityRef[];
}

const DEFAULT_CONFIG: HaEntityConfig = {
  temperatures: [],
  lights: [],
  scenes: [],
};

export function getHaConfig(): { url: string; configured: boolean; entities: HaEntityConfig } {
  const url = getSetting('ha.url') ?? '';
  const raw = getSetting('ha.entities');
  let entities = DEFAULT_CONFIG;
  if (raw) {
    try {
      entities = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      entities = DEFAULT_CONFIG;
    }
  }
  return { url, configured: Boolean(url && getSetting('ha.token')), entities };
}

export function saveHaConfig(input: {
  url?: string;
  token?: string;
  entities?: HaEntityConfig;
}): { url: string; configured: boolean; entities: HaEntityConfig } {
  if (input.url !== undefined) setSetting('ha.url', input.url.trim());
  if (input.token !== undefined && input.token.trim() !== '') {
    setSetting('ha.token', input.token.trim());
  }
  if (input.entities !== undefined) {
    setSetting('ha.entities', JSON.stringify(input.entities));
  }
  return getHaConfig();
}

export function clearHaToken(): void {
  setSetting('ha.token', '');
}

interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

async function haFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = getSetting('ha.url');
  const token = getSetting('ha.token');
  if (!url || !token) {
    throw new Error('Home Assistant is not configured');
  }
  const res = await fetch(`${url.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Home Assistant HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  return res;
}

function friendlyName(state: HaState): string {
  const name = state.attributes.friendly_name;
  return typeof name === 'string' && name.trim() ? name.trim() : state.entity_id;
}

export async function listHaEntities(type: string, search: string): Promise<HaEntityRef[]> {
  const res = await haFetch('/api/states');
  const states = (await res.json()) as HaState[];
  const needle = search.trim().toLowerCase();
  const domainMap: Record<string, string[]> = {
    lights: ['light'],
    temperatures: ['sensor', 'climate'],
    scenes: ['scene'],
  };
  const domains = domainMap[type] ?? ['sensor', 'climate', 'light', 'scene'];
  return states
    .filter((s) => domains.some((d) => s.entity_id.startsWith(`${d}.`)))
    .filter((s) => !needle || `${s.entity_id} ${friendlyName(s)}`.toLowerCase().includes(needle))
    .slice(0, 200)
    .map((s) => ({ id: s.entity_id, name: friendlyName(s) }));
}

export async function getHaStates(): Promise<Record<string, { state: string; unit?: string; name: string }>> {
  const config = getHaConfig();
  const ids = [
    ...config.entities.temperatures.map((e) => e.id),
    ...config.entities.lights.map((e) => e.id),
  ];
  if (ids.length === 0) return {};

  const res = await haFetch(`/api/states/${ids.join(',')}`).catch(() => haFetch('/api/states'));
  const states = (await res.json()) as HaState[];
  const out: Record<string, { state: string; unit?: string; name: string }> = {};
  for (const s of states) {
    const unit = typeof s.attributes.unit_of_measurement === 'string'
      ? s.attributes.unit_of_measurement
      : typeof s.attributes.unit === 'string'
        ? s.attributes.unit
        : undefined;
    out[s.entity_id] = { state: s.state, unit, name: friendlyName(s) };
  }
  return out;
}

export async function callHaService(
  domain: string,
  service: string,
  entityId: string,
): Promise<unknown> {
  const res = await haFetch(`/api/services/${domain}/${service}`, {
    method: 'POST',
    body: JSON.stringify({ entity_id: entityId }),
  });
  return res.json().catch(() => ({ ok: true }));
}