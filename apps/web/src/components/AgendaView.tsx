import type { CalendarEvent } from '../types';
import { addDays, eventOverlapsDay, formatDate, sortEvents } from '../date';
import { EventCard } from './EventCard';

interface AgendaViewProps {
  weekStart: Date;
  events: CalendarEvent[];
  timeZone?: string;
}

const DAYS = 14;

export function AgendaView({ weekStart, events, timeZone }: AgendaViewProps) {
  const days = Array.from({ length: DAYS }, (_, i) => addDays(weekStart, i));

  return (
    <div className="h-full space-y-4 overflow-y-auto">
      {days.map((day) => {
        const dayEvents = sortEvents(
          events.filter((e) => eventOverlapsDay(e, day, timeZone)),
        );
        if (dayEvents.length === 0) return null;

        return (
          <div key={day.toISOString()}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-300">
                {formatDate(day, timeZone)}
              </h3>
              <div className="h-px flex-1 bg-slate-800" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {dayEvents.map((event) => (
                <EventCard key={event.id} event={event} timeZone={timeZone} />
              ))}
            </div>
          </div>
        );
      })}

      {events.length === 0 && (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          No events in the next two weeks.
        </div>
      )}
    </div>
  );
}
