import { useEffect, useMemo, useState } from 'react';
import type { Source, WeatherConfig } from '../types';
import type { ClockFormat } from './Clock';
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

  useEffect(() => {
    setLatitude(weather?.latitude?.toString() ?? '');
    setLongitude(weather?.longitude?.toString() ?? '');
    setLocation(weather?.location ?? '');
    setUnits(weather?.units ?? 'c');
  }, [weather]);

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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location name (e.g. Amsterdam)"
        className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
      />
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
        Enter the latitude and longitude of the home location. Forecast updates
        every ~15 minutes via Open-Meteo (no API key needed).
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
