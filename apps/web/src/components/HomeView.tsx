import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { HaEntityConfig, HaState } from '../types';

export function HomeView() {
  const [config, setConfig] = useState<HaEntityConfig | null>(null);
  const [configured, setConfigured] = useState(false);
  const [states, setStates] = useState<Record<string, HaState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const loadTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const cfg = await api.getHaConfig();
      setConfig(cfg.entities);
      setConfigured(cfg.configured);
      if (cfg.configured) {
        const s = await api.getHaStates();
        setStates(s);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!configured) return;
    loadTimer.current = window.setInterval(() => {
      api.getHaStates().then(setStates).catch(() => {});
    }, 30_000);
    return () => {
      if (loadTimer.current) window.clearInterval(loadTimer.current);
    };
  }, [configured]);

  async function toggle(id: string, state: string) {
    setBusyId(id);
    setError(null);
    try {
      const on = state !== 'on';
      await api.callHaService('light', on ? 'turn_on' : 'turn_off', id);
      const waited = await new Promise<Record<string, HaState>>((resolve, reject) => {
        const deadline = Date.now() + 5000;
        const check = async () => {
          try {
            const s = await api.getHaStates();
            if (s[id]) {
              resolve(s);
              return;
            }
            if (Date.now() > deadline) {
              resolve(s);
              return;
            }
            setTimeout(check, 300);
          } catch (err) {
            reject(err);
          }
        };
        void check();
      });
      setStates(waited);
      setBusyId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusyId(null);
    }
  }

  async function runScene(sceneId: string) {
    setBusyId(sceneId);
    setError(null);
    try {
      await api.callHaService('scene', 'turn_on', sceneId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <div className="text-4xl">🏠</div>
        <div className="text-slate-300">Home Assistant is not configured yet.</div>
        <div className="text-sm text-slate-500">
          Open Settings → Home Assistant and connect it.
        </div>
      </div>
    );
  }

  const hasAnything =
    config && (config.temperatures.length > 0 || config.lights.length > 0 || config.scenes.length > 0);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-2 sm:p-4">
      {error && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
      )}

      {!hasAnything && (
        <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
          No entities configured yet. Add temperatures, lights and scenes in
          Settings → Home Assistant.
        </div>
      )}

      {config!.temperatures.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-slate-400">
            Temperatures
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {config!.temperatures.map((e) => {
              const s = states[e.id];
              return (
                <div
                  key={e.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                >
                  <div className="truncate text-xs text-slate-400">{e.name}</div>
                  <div className="mt-1 text-3xl font-semibold tabular-nums text-slate-100">
                    {s ? Math.round(Number(s.state)) : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500">{s?.unit ?? ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {config!.lights.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-slate-400">Lights</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {config!.lights.map((e) => {
              const s = states[e.id];
              const on = s?.state === 'on';
              return (
                <button
                  key={e.id}
                  onClick={() => toggle(e.id, s?.state ?? 'off')}
                  disabled={busyId === e.id}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-left transition-colors disabled:opacity-50 ${
                    on
                      ? 'border-amber-400/60 bg-amber-400/15'
                      : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="text-lg">
                    {on ? '💡' : '🌑'}
                  </span>
                  <span className={`text-sm font-medium ${on ? 'text-amber-200' : 'text-slate-300'}`}>
                    {e.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {config!.scenes.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs uppercase tracking-wide text-slate-400">Scenes</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {config!.scenes.map((e) => (
              <button
                key={e.id}
                onClick={() => runScene(e.id)}
                disabled={busyId === e.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-center text-sm font-medium text-slate-200 transition-colors hover:border-sky-500/60 hover:bg-slate-800/60 disabled:opacity-50"
              >
                {e.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}