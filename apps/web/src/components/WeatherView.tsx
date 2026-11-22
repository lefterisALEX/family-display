import { useEffect, useState } from 'react';
import { api } from '../api';
import type { WeatherConfig, WeatherResponse } from '../types';

interface WeatherViewProps {
  weather?: WeatherConfig;
  timeZone?: string;
}

const ICONS: Record<string, string> = {
  clear: '☀️',
  'mostly-clear': '🌤️',
  'partly-cloudy': '⛅',
  overcast: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  rain: '🌧️',
  snow: '❄️',
  storm: '⛈️',
};

function iconFor(code: number): string {
  if (code <= 1) return ICONS.clear;
  if (code === 2) return ICONS['partly-cloudy'];
  if (code === 3) return ICONS.overcast;
  if (code === 45 || code === 48) return ICONS.fog;
  if (code >= 51 && code <= 67) return ICONS.drizzle;
  if (code >= 71 && code <= 77) return ICONS.snow;
  if (code >= 80 && code <= 82) return ICONS.rain;
  if (code >= 85 && code <= 86) return ICONS.snow;
  if (code >= 95) return ICONS.storm;
  return ICONS.clear;
}

function dayLabel(date: string, timeZone?: string): string {
  const d = new Date(`${date}T00:00:00`);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (date === todayStr) return 'Today';
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  if (date === tomorrowStr) return 'Tomorrow';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    timeZone,
  });
}

export function WeatherView({ weather, timeZone }: WeatherViewProps) {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .getWeather()
        .then((res) => {
          if (!active) return;
          setData(res);
          setError(res.error ?? null);
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    load();
    const id = window.setInterval(load, 10 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Loading weather…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  if (!data?.configured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="text-4xl">🌤️</div>
        <div className="text-slate-300">
          No weather location configured yet.
        </div>
        <div className="text-sm text-slate-500">
          Open Settings and enter your latitude &amp; longitude.
        </div>
      </div>
    );
  }

  const unit = data.units === 'f' ? '°F' : '°C';
  const current = data.current;
  const daily = data.daily ?? [];
  const locationName =
    data.locationName ??
    (data.location
      ? `${data.location.latitude.toFixed(2)}, ${data.location.longitude.toFixed(2)}`
      : null);

  return (
    <div className="flex h-full flex-col gap-4 p-2 sm:p-4">
      {locationName && (
        <div className="text-center text-sm font-medium text-slate-300">
          {locationName}
        </div>
      )}

      {current && (
        <div className="flex items-center justify-center gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="text-7xl">{iconFor(current.code)}</div>
          <div className="text-right">
            <div className="text-6xl font-bold tabular-nums">
              {Math.round(current.temp)}
              <span className="text-3xl text-slate-400">{unit}</span>
            </div>
            {current.humidity !== null && (
              <div className="mt-1 text-sm text-slate-400">
                Humidity {Math.round(current.humidity)}%
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {daily.map((day) => (
          <div
            key={day.date}
            className="flex flex-col items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/60 px-2 py-3 text-center"
          >
            <div className="text-xs text-slate-400">
              {dayLabel(day.date, timeZone)}
            </div>
            <div className="text-2xl">{iconFor(day.code)}</div>
            <div className="text-sm font-medium tabular-nums">
              {Math.round(day.max)}
              <span className="text-slate-400"> / {Math.round(day.min)}</span>
              <span className="text-[10px] text-slate-500"> {unit}</span>
            </div>
            {day.precip !== null && (
              <div className="text-[10px] text-sky-400">💧{day.precip}%</div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-auto text-center text-[10px] text-slate-600">
        Updated {new Date(data.fetchedAt).toLocaleTimeString()}
      </div>
    </div>
  );
}