import type { CalendarEvent } from '../types';
import { addDays, eventOverlapsDay, sameDay, sortEvents } from '../date';
import { EventCard } from './EventCard';

interface WeekViewProps {
  weekStart: Date;
  events: CalendarEvent[];
  timeZone?: string;
}

const DAYS = 14;

export function WeekView({ weekStart, events, timeZone }: WeekViewProps) {
  const days = Array.from({ length: DAYS }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div className="grid h-full grid-cols-7 grid-rows-2 gap-1.5 sm:gap-2">
      {days.map((day, index) => {
        const dayEvents = sortEvents(
          events.filter((e) => eventOverlapsDay(e, day, timeZone)),
        );
        const isToday = sameDay(day, today);
        const isNextWeek = index >= 7;

        return (
          <div
            key={day.toISOString()}
            className={`flex min-w-0 flex-col overflow-hidden rounded-xl border bg-slate-900/60 ${
              isToday
                ? 'border-sky-500 ring-1 ring-sky-500'
                : isNextWeek
                  ? 'border-slate-800/60'
                  : 'border-slate-800'
            }`}
          >
            <div
              className={`px-2 py-1.5 text-center ${
                isToday ? 'bg-sky-500/10' : 'bg-slate-900/80'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wide text-slate-400 sm:text-xs">
                {day.toLocaleDateString(undefined, {
                  weekday: 'short',
                  ...(timeZone ? { timeZone } : {}),
                })}
              </div>
              <div
                className={`text-base font-semibold sm:text-xl ${
                  isToday ? 'text-sky-400' : 'text-slate-100'
                }`}
              >
                {timeZone
                  ? Number(
                      new Intl.DateTimeFormat(undefined, {
                        timeZone,
                        day: 'numeric',
                      }).format(day),
                    )
                  : day.getDate()}
              </div>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-1.5">
              {dayEvents.map((event) => (
                <EventCard key={event.id} event={event} timeZone={timeZone} />
              ))}
              {dayEvents.length === 0 && (
                <div className="py-3 text-center text-[10px] text-slate-600">
                  No events
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
