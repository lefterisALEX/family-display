import { useEffect, useState } from 'react';

interface ClockProps {
  timeZone?: string;
}

export function Clock({ timeZone }: ClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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