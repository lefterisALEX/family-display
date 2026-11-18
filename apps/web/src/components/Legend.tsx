import type { Source } from '../types';

interface LegendProps {
  sources: Source[];
  visibleIds: Set<string>;
  onToggle: (id: string) => void;
}

export function Legend({ sources, visibleIds, onToggle }: LegendProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950/60 px-3 py-2 sm:px-4">
      {sources.map((source) => {
        const active = visibleIds.has(source.id);
        return (
          <button
            key={source.id}
            onClick={() => onToggle(source.id)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${
              active
                ? 'border-slate-700 bg-slate-800 text-slate-100'
                : 'border-slate-800 bg-slate-900 text-slate-500 opacity-60'
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: source.color }}
            />
            {source.name}
          </button>
        );
      })}

      {sources.length === 0 && (
        <span className="text-xs text-slate-500">
          No calendars yet. Open Settings to add one.
        </span>
      )}
    </div>
  );
}
