import { Clock, type ClockFormat } from './Clock';

interface HeaderProps {
  tab: 'calendar' | 'weather';
  onTabChange: (tab: 'calendar' | 'weather') => void;
  view: 'week' | 'agenda';
  onViewChange: (view: 'week' | 'agenda') => void;
  timeZone?: string;
  clockFormat: ClockFormat;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSync: () => void;
  syncing: boolean;
  onSettings: () => void;
}

export function Header(props: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2 backdrop-blur sm:px-4 sm:py-3">
      <div className="flex rounded-lg border border-slate-800 p-0.5">
        <button
          onClick={() => props.onTabChange('calendar')}
          className={`rounded-md px-3 py-1 text-xs ${
            props.tab === 'calendar'
              ? 'bg-slate-700 text-slate-100'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Calendar
        </button>
        <button
          onClick={() => props.onTabChange('weather')}
          className={`rounded-md px-3 py-1 text-xs ${
            props.tab === 'weather'
              ? 'bg-slate-700 text-slate-100'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Weather
        </button>
      </div>

      {props.tab === 'calendar' && (
        <div className="flex items-center gap-1">
          <button
            onClick={props.onPrev}
            className="rounded-lg px-2 py-1 text-lg leading-none text-slate-300 hover:bg-slate-800"
            aria-label="Previous two weeks"
          >
            ‹
          </button>
          <button
            onClick={props.onToday}
            className="rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            Today
          </button>
          <button
            onClick={props.onNext}
            className="rounded-lg px-2 py-1 text-lg leading-none text-slate-300 hover:bg-slate-800"
            aria-label="Next two weeks"
          >
            ›
          </button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {props.tab === 'calendar' && (
          <div className="flex rounded-lg border border-slate-800 p-0.5">
            <button
              onClick={() => props.onViewChange('week')}
              className={`rounded-md px-2 py-1 text-xs ${
                props.view === 'week'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2 Weeks
            </button>
            <button
              onClick={() => props.onViewChange('agenda')}
              className={`rounded-md px-2 py-1 text-xs ${
                props.view === 'agenda'
                  ? 'bg-slate-700 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Agenda
            </button>
          </div>
        )}

        <button
          onClick={props.onSync}
          disabled={props.syncing || props.tab === 'weather'}
          className="rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-400 hover:bg-sky-500/20 disabled:opacity-50"
        >
          {props.syncing ? 'Syncing…' : 'Sync'}
        </button>

        <button
          onClick={props.onSettings}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
        >
          Settings
        </button>

        <div className="flex items-center gap-2">
          <Clock timeZone={props.timeZone} format={props.clockFormat} />
        </div>
      </div>
    </header>
  );
}
