import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { CalendarEvent, Source, WeatherConfig } from './types';
import { addDays, formatDate, startOfWeek } from './date';
import { Header } from './components/Header';
import { Legend } from './components/Legend';
import { WeekView } from './components/WeekView';
import { AgendaView } from './components/AgendaView';
import { WeatherView } from './components/WeatherView';
import { SettingsModal } from './components/SettingsModal';
import { useWakeLock, getWakeLockEnabled, setWakeLockEnabled as persistWakeLock } from './useWakeLock';

const RANGE_DAYS = 14;

export default function App() {
  const [sources, setSources] = useState<Source[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<'week' | 'agenda'>('week');
  const [tab, setTab] = useState<'calendar' | 'weather'>('calendar');
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeZone, setTimeZone] = useState<string | undefined>(undefined);
  const [weather, setWeather] = useState<WeatherConfig | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [wakeLockEnabled, setWakeLockEnabledState] = useState(getWakeLockEnabled);
  const wakeLockState = useWakeLock(wakeLockEnabled);

  const toggleWakeLock = (value: boolean) => {
    persistWakeLock(value);
    setWakeLockEnabledState(value);
  };

  const loadSources = useCallback(async () => {
    const next = await api.getSources();
    setSources(next);
    setVisibleIds((prev) => {
      const valid = new Set(next.map((s) => s.id));
      const result = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) result.add(id);
      }
      for (const source of next) {
        if (source.enabled && !result.has(source.id)) result.add(source.id);
      }
      return result;
    });
  }, []);

  const loadSettings = useCallback(async () => {
    const settings = await api.getSettings();
    setTimeZone(settings.timezone);
    setWeather(settings.weather);
  }, []);

  const loadEvents = useCallback(async () => {
    const start = weekStart.toISOString();
    const end = addDays(weekStart, RANGE_DAYS).toISOString();
    const next = await api.getEvents(start, end);
    setEvents(next);
  }, [weekStart]);

  useEffect(() => {
    loadSources().catch((err) => setError(String(err)));
    loadSettings().catch(() => {});
  }, [loadSources, loadSettings]);

  useEffect(() => {
    setLoading(true);
    loadEvents()
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [loadEvents]);

  useEffect(() => {
    const id = window.setInterval(() => {
      loadEvents().catch(() => {});
    }, 60_000);
    return () => window.clearInterval(id);
  }, [loadEvents]);

  useEffect(() => {
    api
      .sync()
      .then(() => loadEvents())
      .catch(() => {});
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleEvents = useMemo(
    () => events.filter((event) => visibleIds.has(event.sourceId)),
    [events, visibleIds],
  );

  const toggleSource = (id: string) => {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await api.sync();
      await Promise.all([loadEvents(), loadSources()]);
    } catch (err) {
      setError(String(err));
    } finally {
      setSyncing(false);
    }
  };

  const rangeLabel = `${formatDate(weekStart, timeZone)} – ${formatDate(
    addDays(weekStart, RANGE_DAYS - 1),
    timeZone,
  )}`;

  return (
    <div className="flex h-full flex-col">
      <Header
        tab={tab}
        onTabChange={setTab}
        view={view}
        onViewChange={setView}
        rangeLabel={rangeLabel}
        timeZone={timeZone}
        onPrev={() => setWeekStart((d) => addDays(d, -RANGE_DAYS))}
        onNext={() => setWeekStart((d) => addDays(d, RANGE_DAYS))}
        onToday={() => setWeekStart(startOfWeek(new Date()))}
        onSync={handleSync}
        syncing={syncing}
        onSettings={() => setSettingsOpen(true)}
      />

      {tab === 'calendar' && (
        <Legend sources={sources} visibleIds={visibleIds} onToggle={toggleSource} />
      )}

      <main className="flex-1 overflow-hidden p-2 sm:p-3">
        {error && (
          <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {tab === 'weather' ? (
          <WeatherView weather={weather} timeZone={timeZone} />
        ) : loading ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            Loading…
          </div>
        ) : view === 'week' ? (
          <WeekView weekStart={weekStart} events={visibleEvents} timeZone={timeZone} />
        ) : (
          <AgendaView weekStart={weekStart} events={visibleEvents} timeZone={timeZone} />
        )}
      </main>

      {settingsOpen && (
        <SettingsModal
          sources={sources}
          timeZone={timeZone}
          weather={weather}
          wakeLockEnabled={wakeLockEnabled}
          wakeLockState={wakeLockState}
          onWakeLockChange={toggleWakeLock}
          onClose={() => setSettingsOpen(false)}
          onChanged={async () => {
            await Promise.all([loadSources(), loadSettings()]);
            await loadEvents();
          }}
        />
      )}
    </div>
  );
}
