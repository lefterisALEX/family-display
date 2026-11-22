import { useEffect, useState } from 'react';

const STORAGE_KEY = 'family-display:clock-format';

export type ClockFormat = '12' | '24';

export function getClockFormat(): ClockFormat {
  try {
    return localStorage.getItem(STORAGE_KEY) === '12' ? '12' : '24';
  } catch {
    return '24';
  }
}

export function setClockFormat(format: ClockFormat): void {
  try {
    localStorage.setItem(STORAGE_KEY, format);
  } catch {
    // ignore storage failures
  }
}

interface ClockProps {
  timeZone?: string;
  format: ClockFormat;
}

export function Clock({ timeZone, format }: ClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: format === '12',
    timeZone,
  });
  const date = now.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  });

  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="text-xl font-semibold tabular-nums text-slate-100 sm:text-2xl">
        {time}
      </span>
      <span className="text-[10px] text-slate-400 sm:text-xs">{date}</span>
    </div>
  );
}