import { useEffect, useMemo, useState } from 'react';
import type { Source, WeatherConfig, HaEntityConfig, HaEntityRef } from '../types';
import type { ClockFormat } from './Clock';
import type { FontScale } from '../App';
import { api } from '../api';

interface SettingsModalProps {
  sources: Source[];
  timeZone?: string;
  weather?: WeatherConfig;
  wakeLockEnabled: boolean;
  wakeLockState: 'active' | 'released' | 'failed' | 'unsupported' | 'off';
  onWakeLockChange: (enabled: boolean) => void;
  clockFormat: ClockFormat;
  onClockFormatChange: (format: ClockFormat) => void;
  autoReturn: boolean;
  onAutoReturnChange: (enabled: boolean) => void;
  autoReturnToday: boolean;
  onAutoReturnTodayChange: (enabled: boolean) => void;
  fontScale: FontScale;
  onFontScaleChange: (scale: FontScale) => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

function SourceRow({
  source,
  onChanged,
}: {
  source: Source;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState(source.name);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(source.name);
  }, [source.name]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === source.name) {
      setName(source.name);
      return;
    }
    setBusy(true);
    try {
      await api.updateSource(source.id, { name: trimmed });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function setColor(color: string) {
    setBusy(true);
    try {
      await api.updateSource(source.id, { color });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled() {
    setBusy(true);
    try {
      await api.updateSource(source.id, { enabled: !source.enabled });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${source.name}"?`)) return;
    setBusy(true);
    try {
      await api.deleteSource(source.id);
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={source.color}
          onChange={(e) => setColor(e.target.value)}
          disabled={busy}
          className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
          aria-label={`Color for ${source.name}`}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          disabled={busy}
          className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />
        <button
          onClick={toggleEnabled}
          disabled={busy}
          className={`rounded-lg px-3 py-2 text-xs font-medium ${
            source.enabled
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          {source.enabled ? 'Enabled' : 'Disabled'}
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20"
        >
          Delete
        </button>
      </div>

      <div className="mt-2 truncate font-mono text-[10px] text-slate-500">
        {source.url}
      </div>
      <div className="mt-1 text-[10px] text-slate-500">
        {source.lastSyncedAt
          ? `Last synced ${new Date(source.lastSyncedAt).toLocaleString()}`
          : 'Not synced yet'}
        {source.lastError && (
          <span className="ml-2 text-red-400">Error: {source.lastError}</span>
        )}
      </div>
    </div>
  );
}

function TimezonePicker({
  timeZone,
  onChanged,
}: {
  timeZone?: string;
  onChanged: () => Promise<void>;
}) {
  const zones = useMemo(() => {
    try {
      const supported = (Intl as any).supportedValuesOf?.('timeZone') as
        | string[]
        | undefined;
      if (supported && supported.length > 0) return supported;
    } catch {
      // fall through
    }
    const fallback = [
      'UTC',
      'Europe/Amsterdam',
      'Europe/Athens',
      'Europe/London',
      'Europe/Berlin',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Asia/Tokyo',
      'Australia/Sydney',
    ];
    return fallback;
  }, []);

  const [value, setValue] = useState(timeZone ?? 'UTC');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (timeZone) setValue(timeZone);
  }, [timeZone]);

  async function save(next: string) {
    setBusy(true);
    setSaved(false);
    try {
      await api.updateSettings({ timezone: next });
      setSaved(true);
      await onChanged();
      window.setTimeout(() => setSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-200">Timezone</h3>
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            void save(e.target.value);
          }}
          disabled={busy}
          className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        >
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Times are shown in this timezone. All-day events keep their calendar date.
      </p>
    </div>
  );
}

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

function searchCities(query: string): Promise<GeoResult[]> {
  const params = new URLSearchParams({
    name: query,
    count: '6',
    language: 'en',
    format: 'json',
  });
  return fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
    .then((r) => r.json())
    .then((data: { results?: GeoResult[] }) => data.results ?? []);
}

function WeatherSettings({
  weather,
  onChanged,
}: {
  weather?: WeatherConfig;
  onChanged: () => Promise<void>;
}) {
  const [latitude, setLatitude] = useState(weather?.latitude?.toString() ?? '');
  const [longitude, setLongitude] = useState(weather?.longitude?.toString() ?? '');
  const [location, setLocation] = useState(weather?.location ?? '');
  const [units, setUnits] = useState<'c' | 'f'>(weather?.units ?? 'c');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    setLatitude(weather?.latitude?.toString() ?? '');
    setLongitude(weather?.longitude?.toString() ?? '');
    setLocation(weather?.location ?? '');
    setUnits(weather?.units ?? 'c');
  }, [weather]);

  async function doSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearched(false);
    setResults([]);
    try {
      const found = await searchCities(q);
      setResults(found);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  function pickCity(city: GeoResult) {
    setLatitude(city.latitude.toFixed(4));
    setLongitude(city.longitude.toFixed(4));
    setLocation(city.name);
    setQuery(city.name);
    setResults([]);
    setSearched(false);
  }

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await api.updateSettings({
        weather: {
          latitude: latitude.trim() ? Number(latitude.trim()) : undefined,
          longitude: longitude.trim() ? Number(longitude.trim()) : undefined,
          location: location.trim() || undefined,
          units,
        },
      });
      setSaved(true);
      await onChanged();
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Weather</h3>
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearched(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void doSearch();
            }
          }}
          placeholder="Search for a city…"
          className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />
        <button
          onClick={doSearch}
          disabled={searching || !query.trim()}
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          {searching ? '…' : 'Search'}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="mt-2 space-y-1">
          {results.map((city) => (
            <li key={`${city.name}-${city.latitude}-${city.longitude}`}>
              <button
                onClick={() => pickCity(city)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
              >
                {city.name}
                {[city.admin1, city.country].filter(Boolean).length > 0 && (
                  <span className="ml-1 text-xs text-slate-500">
                    {[city.admin1, city.country].filter(Boolean).join(', ')}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && results.length === 0 && (
        <div className="mt-2 text-xs text-slate-500">No cities found.</div>
      )}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={latitude}
          onChange={(e) => setLatitude(e.target.value)}
          placeholder="Latitude (e.g. 52.3676)"
          inputMode="decimal"
          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />
        <input
          value={longitude}
          onChange={(e) => setLongitude(e.target.value)}
          placeholder="Longitude (e.g. 4.9041)"
          inputMode="decimal"
          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex rounded-lg border border-slate-800 p-0.5">
          <button
            onClick={() => setUnits('c')}
            className={`rounded-md px-2 py-1 text-xs ${
              units === 'c' ? 'bg-slate-700 text-slate-100' : 'text-slate-400'
            }`}
          >
            °C
          </button>
          <button
            onClick={() => setUnits('f')}
            className={`rounded-md px-2 py-1 text-xs ${
              units === 'f' ? 'bg-slate-700 text-slate-100' : 'text-slate-400'
            }`}
          >
            °F
          </button>
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save weather'}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Search for a city to auto-fill the coordinates, or enter latitude and
        longitude manually. The location name is shown on the weather tab.
        Forecast updates every ~15 minutes via Open-Meteo (no API key needed).
      </p>
    </div>
  );
}

function WakeLockSettings({
  enabled,
  state,
  onChange,
}: {
  enabled: boolean;
  state: SettingsModalProps['wakeLockState'];
  onChange: (enabled: boolean) => void;
}) {
  const statusText: Record<SettingsModalProps['wakeLockState'], string> = {
    active: 'Screen is being kept awake',
    released: 'Not holding the screen',
    failed: 'Wake lock failed (browser refused)',
    unsupported: 'Wake lock not supported by this browser',
    off: 'Wake lock disabled',
  };

  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Wake lock</h3>
        <button
          onClick={() => onChange(!enabled)}
          className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${
            enabled ? 'bg-sky-500' : 'bg-slate-700'
          }`}
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle wake lock"
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        {statusText[state]}. Keeps the screen on while this tab is open so the
        display never sleeps. The browser only allows this over HTTPS (or
        localhost) — your Tailscale URL is fine.
      </p>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  enabled,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
        </div>
        <button
          onClick={() => onChange(!enabled)}
          className={`relative h-6 w-12 shrink-0 rounded-full transition-colors ${
            enabled ? 'bg-sky-500' : 'bg-slate-700'
          }`}
          role="switch"
          aria-checked={enabled}
          aria-label={`Toggle ${title}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}

function EntityPicker({
  label,
  type,
  entities,
  onChange,
}: {
  label: string;
  type: 'temperatures' | 'lights' | 'scenes';
  entities: HaEntityRef[];
  onChange: (list: HaEntityRef[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HaEntityRef[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setBusy(true);
    setSearched(false);
    try {
      const found = await api.listHaEntities(type, query.trim());
      setResults(found);
      setSearched(true);
    } catch (err) {
      setResults([]);
      setSearched(true);
    } finally {
      setBusy(false);
    }
  }

  function add(ref: HaEntityRef) {
    if (entities.some((e) => e.id === ref.id)) return;
    onChange([...entities, ref]);
  }

  function remove(id: string) {
    onChange(entities.filter((e) => e.id !== id));
  }

  const remaining = results.filter((r) => !entities.some((e) => e.id === r.id));

  return (
    <div className="mt-3">
      <div className="mb-1 text-xs font-medium text-slate-300">{label}</div>
      <div className="space-y-1">
        {entities.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5"
          >
            <div className="truncate">
              <span className="text-xs text-slate-200">{e.name}</span>
              <span className="ml-2 font-mono text-[10px] text-slate-500">{e.id}</span>
            </div>
            <button
              onClick={() => remove(e.id)}
              className="shrink-0 text-xs text-red-400 hover:text-red-300"
              aria-label={`Remove ${e.name}`}
            >
              ✕
            </button>
          </div>
        ))}
        {entities.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-800 px-3 py-2 text-[11px] text-slate-600">
            None added yet.
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearched(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
          }}
          placeholder={`Search ${type}…`}
          className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
        />
        <button
          onClick={search}
          disabled={busy || !query.trim()}
          className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? '…' : 'Search'}
        </button>
      </div>
      {remaining.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {remaining.map((r) => (
            <button
              key={r.id}
              onClick={() => add(r)}
              className="flex w-full items-center justify-between gap-2 rounded border border-slate-800 px-3 py-1 text-left text-xs text-slate-400 hover:bg-slate-800"
            >
              <span className="truncate">{r.name}</span>
              <span className="ml-2 font-mono text-[10px] text-slate-500">{r.id}</span>
            </button>
          ))}
        </div>
      )}
      {searched && remaining.length === 0 && results.length > 0 && (
        <div className="mt-1 text-[11px] text-slate-600">All results already added.</div>
      )}
      {searched && results.length === 0 && (
        <div className="mt-1 text-[11px] text-slate-600">No entities found.</div>
      )}
    </div>
  );
}

function HaSettings() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [config, setConfig] = useState<HaEntityConfig>({
    temperatures: [],
    lights: [],
    scenes: [],
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getHaConfig()
      .then((c) => {
        setUrl(c.url);
        setHasToken(c.hasToken);
        setConfig(c.entities);
      })
      .catch(() => {});
  }, []);

  const setList = (key: keyof HaEntityConfig) => (list: HaEntityRef[]) =>
    setConfig((prev) => ({ ...prev, [key]: list }));

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      await api.updateHaConfig({
        url,
        token: token || undefined,
        entities: config,
      });
      setHasToken(true);
      setToken('');
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Home Assistant</h3>
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="http://homeassistant.local:8123"
        className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
      />
      <input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder={hasToken ? 'Long-lived token (keep to leave unchanged)' : 'Long-lived access token'}
        type="password"
        className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
      />
      <button
        onClick={save}
        disabled={busy}
        className="mt-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
      >
        {busy ? 'Saving…' : 'Save Home Assistant'}
      </button>
      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Create a long-lived access token in Home Assistant (Profile → Security →
        Long-lived access tokens). The token stays on the server.
      </p>

      <EntityPicker
        label="Temperatures"
        type="temperatures"
        entities={config.temperatures}
        onChange={setList('temperatures')}
      />
      <EntityPicker
        label="Lights"
        type="lights"
        entities={config.lights}
        onChange={setList('lights')}
      />
      <EntityPicker label="Scenes" type="scenes" entities={config.scenes} onChange={setList('scenes')} />
    </div>
  );
}

function FontScaleSettings({
  scale,
  onChange,
}: {
  scale: FontScale;
  onChange: (scale: FontScale) => void;
}) {
  const options: { value: FontScale; label: string }[] = [
    { value: '90', label: 'Small' },
    { value: '100', label: 'Default' },
    { value: '110', label: 'Large' },
    { value: '125', label: 'XL' },
    { value: '150', label: 'XXL' },
  ];

  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-200">Font size</h3>
      <div className="flex w-fit rounded-lg border border-slate-800 p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-md px-2.5 py-1.5 text-xs ${
              scale === option.value
                ? 'bg-slate-700 text-slate-100'
                : 'text-slate-400'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClockFormatSettings({
  format,
  onChange,
}: {
  format: ClockFormat;
  onChange: (format: ClockFormat) => void;
}) {
  return (
    <div className="mt-6 border-t border-slate-800 pt-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-200">Clock format</h3>
      <div className="flex w-fit rounded-lg border border-slate-800 p-0.5">
        <button
          onClick={() => onChange('24')}
          className={`rounded-md px-3 py-1.5 text-xs ${
            format === '24' ? 'bg-slate-700 text-slate-100' : 'text-slate-400'
          }`}
        >
          24h
        </button>
        <button
          onClick={() => onChange('12')}
          className={`rounded-md px-3 py-1.5 text-xs ${
            format === '12' ? 'bg-slate-700 text-slate-100' : 'text-slate-400'
          }`}
        >
          12h
        </button>
      </div>
    </div>
  );
}

export function SettingsModal({
  sources,
  timeZone,
  weather,
  wakeLockEnabled,
  wakeLockState,
  onWakeLockChange,
  clockFormat,
  onClockFormatChange,
  autoReturn,
  onAutoReturnChange,
  autoReturnToday,
  onAutoReturnTodayChange,
  fontScale,
  onFontScaleChange,
  onClose,
  onChanged,
}: SettingsModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.addSource({ name: name.trim(), url: url.trim() });
      setName('');
      setUrl('');
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Calendars</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {sources.map((source) => (
            <SourceRow key={source.id} source={source} onChanged={onChanged} />
          ))}
          {sources.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-sm text-slate-500">
              No calendars yet.
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-slate-800 pt-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-200">Add calendar</h3>
          <form onSubmit={add} className="space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (e.g. School)"
              required
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
              required
              type="url"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
            >
              {busy ? 'Adding & syncing…' : 'Add calendar'}
            </button>
            {error && <div className="text-xs text-red-400">{error}</div>}
          </form>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Use a secret iCal URL. Google Calendar: Settings → your calendar →
            “Secret address in iCal format”. Outlook: Calendar settings → Shared
            calendars → Publish → ICS. Apple: Share calendar → Public calendar.
          </p>
        </div>

        <TimezonePicker timeZone={timeZone} onChanged={onChanged} />
        <ClockFormatSettings
          format={clockFormat}
          onChange={onClockFormatChange}
        />
        <FontScaleSettings scale={fontScale} onChange={onFontScaleChange} />
        <ToggleRow
          title="Auto-return to calendar"
          description="Switches back from the Weather tab to Calendar after 5 minutes."
          enabled={autoReturn}
          onChange={onAutoReturnChange}
        />
        <ToggleRow
          title="Auto-return to current week"
          description="Returns to this week after 5 minutes if you browsed other weeks."
          enabled={autoReturnToday}
          onChange={onAutoReturnTodayChange}
        />
        <HaSettings />
        <WeatherSettings weather={weather} onChanged={onChanged} />
        <WakeLockSettings
          enabled={wakeLockEnabled}
          state={wakeLockState}
          onChange={onWakeLockChange}
        />
      </div>
    </div>
  );
}
