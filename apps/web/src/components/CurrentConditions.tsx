import { useEffect, useState } from 'react';
import { api } from '../api';
import type { WeatherResponse } from '../types';

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

export function CurrentConditions() {
  const [data, setData] = useState<WeatherResponse | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .getWeather()
        .then((res) => {
          if (active) setData(res);
        })
        .catch(() => {});
    load();
    const id = window.setInterval(load, 10 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  if (!data?.configured || !data.current) return null;

  const unit = data.units === 'f' ? '°F' : '°C';
  return (
    <div
      className="flex items-center gap-1.5"
      title={data.locationName ?? undefined}
    >
      <span className="text-lg leading-none">{iconFor(data.current.code)}</span>
      <span className="text-base font-semibold tabular-nums text-slate-100">
        {Math.round(data.current.temp)}
        {unit}
      </span>
    </div>
  );
}