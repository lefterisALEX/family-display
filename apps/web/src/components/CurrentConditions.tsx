import { useEffect, useState } from 'react';
import { api } from '../api';
import type { WeatherResponse } from '../types';

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
      className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 py-1 pl-2.5 pr-3"
      title={data.locationName ?? undefined}
    >
      <span className="text-[10px] uppercase tracking-wide text-slate-500">
        {data.locationName}
      </span>
      <span className="text-sm font-semibold tabular-nums text-slate-100">
        {Math.round(data.current.temp)}
        {unit}
      </span>
    </div>
  );
}