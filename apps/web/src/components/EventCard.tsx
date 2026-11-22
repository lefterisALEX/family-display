import type { CalendarEvent } from '../types';
import { formatTime } from '../date';

export function EventCard({
  event,
  timeZone,
}: {
  event: CalendarEvent;
  timeZone?: string;
}) {
  const start = event.allDay ? null : new Date(event.start);
  const end = event.allDay ? null : new Date(event.end);
  const isPast = event.endTs < Date.now();

  return (
    <div
      className={`rounded-lg border-l-4 bg-slate-800/80 p-2 ${
        isPast ? 'opacity-50 saturate-50' : ''
      }`}
      style={{ borderLeftColor: event.sourceColor }}
      title={event.description ?? undefined}
    >
      <div className="text-sm font-medium leading-tight text-slate-100">
        {event.title}
      </div>
      <div className="mt-1 text-xs text-slate-400">
        {event.allDay
          ? 'All day'
          : `${formatTime(start!, timeZone)} – ${formatTime(end!, timeZone)}`}
      </div>
      {event.location && (
        <div className="mt-0.5 truncate text-xs text-slate-500">{event.location}</div>
      )}
      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: event.sourceColor }}
        />
        <span className="truncate">{event.sourceName}</span>
      </div>
    </div>
  );
}
