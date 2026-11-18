import { getSetting } from './db.js';
import { containerTimezone } from './tz.js';

const FALLBACK =
  process.env.APP_TIMEZONE ??
  process.env.DEFAULT_TIMEZONE ??
  containerTimezone ??
  'UTC';

export function isValidTimezone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function getTimezone(): string {
  const stored = getSetting('timezone');
  if (stored && isValidTimezone(stored)) return stored;
  if (isValidTimezone(FALLBACK)) return FALLBACK;
  return 'UTC';
}
