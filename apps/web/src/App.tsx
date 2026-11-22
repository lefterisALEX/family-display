import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { CalendarEvent, Source, WeatherConfig } from './types';
import { addDays, startOfWeek } from './date';
import { Header } from './components/Header';
import { WeekView } from './components/WeekView';
import { AgendaView } from './components/AgendaView';
import { WeatherView } from './components/WeatherView';
import { HomeView } from './components/HomeView';
import { SettingsModal } from './components/SettingsModal';
import { useWakeLock, getWakeLockEnabled, setWakeLockEnabled as persistWakeLock } from './useWakeLock';
import { getClockFormat, setClockFormat as persistClockFormat } from './components/Clock';

const RANGE_DAYS = 14;

const AUTO_RETURN_MS = 5 * 60 * 1000;
const AUTO_RETURN_KEY = 'family-display:auto-return';
const AUTO_RETURN_TODAY_KEY = 'family-display:auto-return-today';
const FONT_SCALE_KEY = 'family-display:font-scale';

export type FontScale = '90' | '100' | '110' | '125' | '150';

function getFontScale(): FontScale {
  try {
    const value = localStorage.getItem(FONT_SCALE_KEY) as FontScale | null;
    return value && ['90', '100', '110', '125', '150'].includes(value)
      ? value
      : '100';
  } catch {
    return '100';
  }
}

function getAutoReturn(): boolean {
  try {
    return localStorage.getItem(AUTO_RETURN_KEY) !== '0';
  } catch {
    return true;
  }
}

function getAutoReturnToday(): boolean {
  try {
    return localStorage.getItem(AUTO_RETURN_TODAY_KEY) !== '0';
  } catch {
    return true;
  }
}

export default function App() {
  const [sources, setSources] = useState<Source[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<'week' | 'agenda'>('week');
  const [tab, setTab] = useState<'calendar' | 'weather' | 'home'>('calendar');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeZone, setTimeZone] = useState<string | undefined>(undefined);
  const [weather, setWeather] = useState<WeatherConfig | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [wakeLockEnabled, setWakeLockEnabledState] = useState(getWakeLockEnabled);
  const wakeLockState = useWakeLock(wakeLockEnabled);
  const [clockFormat, setClockFormatState] = useState(getClockFormat);
  const [autoReturn, setAutoReturnState] = useState(getAutoReturn);
  const [autoReturnToday, setAutoReturnTodayState] = useState(getAutoReturnToday);
  const [fontScale, setFontScale] = useState(getFontScale);

  useEffect(() => {
    try {
      localStorage.setItem(FONT_SCALE_KEY, fontScale);
      document.documentElement.style.fontSize = `${fontScale}%`;
    } catch {
      // ignore storage failures
    }
  }, [fontScale]);

  const toggleWakeLock = (value: boolean) => {
    persistWakeLock(value);
    setWakeLockEnabledState(value);
  };

  const toggleClockFormat = (value: '12' | '24') => {
    persistClockFormat(value);
    setClockFormatState(value);
  };

  const toggleAutoReturn = (value: boolean) => {
    try {
      localStorage.setItem(AUTO_RETURN_KEY, value ? '1' : '0');
    } catch {
      // ignore storage failures
    }
    setAutoReturnState(value);
  };

  const toggleAutoReturnToday = (value: boolean) => {
    try {
      localStorage.setItem(AUTO_RETURN_TODAY_KEY, value ? '1' : '0');
    } catch {
      // ignore storage failures
    }
    setAutoReturnTodayState(value);
  };

  useEffect(() => {
    if (!autoReturn || (tab !== 'weather' && tab !== 'home')) return;
    const id = window.setTimeout(() => setTab('calendar'), AUTO_RETURN_MS);
    return () => window.clearTimeout(id);
  }, [autoReturn, tab]);

  const thisWeekStart = useMemo(() => startOfWeek(new Date()), []);

  useEffect(() => {
    if (!autoReturnToday || tab !== 'calendar') return;
    const isCurrentWeek = weekStart.getTime() === thisWeekStart.getTime();
    if (isCurrentWeek) return;
    const id = window.setTimeout(() => setWeekStart(thisWeekStart), AUTO_RETURN_MS);
    return () => window.clearTimeout(id);
  }, [autoReturnToday, tab, weekStart, thisWeekStart]);

  const loadSources = useCallback(async () => {
    const next = await api.getSources();
    setSources(next);
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

  return (
    <div className="flex h-full flex-col">
      <Header
        tab={tab}
        onTabChange={setTab}
        view={view}
        onViewChange={setView}
        timeZone={timeZone}
        clockFormat={clockFormat}
        onPrev={() => setWeekStart((d) => addDays(d, -RANGE_DAYS))}
        onNext={() => setWeekStart((d) => addDays(d, RANGE_DAYS))}
        onToday={() => setWeekStart(startOfWeek(new Date()))}
        onSync={handleSync}
        syncing={syncing}
        onSettings={() => setSettingsOpen(true)}
      />

      <main className="flex-1 overflow-hidden p-2 sm:p-3">
        {error && (
          <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {tab === 'weather' ? (
          <WeatherView weather={weather} timeZone={timeZone} />
        ) : tab === 'home' ? (
          <HomeView />
        ) : loading ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            Loading…
          </div>
        ) : view === 'week' ? (
          <WeekView weekStart={weekStart} events={events} timeZone={timeZone} />
        ) : (
          <AgendaView weekStart={weekStart} events={events} timeZone={timeZone} />
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
          clockFormat={clockFormat}
          onClockFormatChange={toggleClockFormat}
          autoReturn={autoReturn}
          onAutoReturnChange={toggleAutoReturn}
          autoReturnToday={autoReturnToday}
          onAutoReturnTodayChange={toggleAutoReturnToday}
          fontScale={fontScale}
          onFontScaleChange={setFontScale}
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
