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
      className="flex flex-col items-end leading-tight"
      title={data.locationName ?? undefined}
    >
      <span className="text-xs font-medium tabular-nums text-slate-400">
        {data.locationName ?? 'Current'}
      </span>
      <span className="text-lg font-semibold tabular-nums text-slate-100">
        {Math.round(data.current.temp)}
        {unit}
      </span>
    </div>
  );
}