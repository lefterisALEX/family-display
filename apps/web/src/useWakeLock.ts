import { useEffect, useState } from 'react';

const STORAGE_KEY = 'family-display:wake-lock';

export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export function getWakeLockEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setWakeLockEnabled(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // ignore storage failures
  }
}

export type WakeLockState = 'active' | 'released' | 'failed' | 'unsupported' | 'off';

export function useWakeLock(enabled: boolean): WakeLockState {
  const [state, setState] = useState<WakeLockState>(() =>
    isWakeLockSupported() ? 'released' : 'unsupported',
  );

  useEffect(() => {
    if (!enabled) {
      setState(isWakeLockSupported() ? 'released' : 'unsupported');
      return;
    }
    if (!isWakeLockSupported()) {
      setState('unsupported');
      return;
    }

    let sentinel: any | null = null;
    let disposed = false;

    const release = async () => {
      if (sentinel) {
        try {
          await sentinel.release();
        } catch {
          // ignore
        }
        sentinel = null;
      }
      if (!disposed) setState('released');
    };

    const acquire = async () => {
      if (sentinel || disposed) return;
      try {
        sentinel = await (navigator as any).wakeLock.request('screen');
        if (!disposed) setState('active');
        sentinel.addEventListener('release', () => {
          sentinel = null;
          if (!disposed) setState('released');
        });
      } catch {
        if (!disposed) setState('failed');
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void release();
    };
  }, [enabled]);

  return state;
}