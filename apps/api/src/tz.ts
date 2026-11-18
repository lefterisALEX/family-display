// Capture the timezone configured for the container (e.g. via docker-compose
// TZ) before forcing the process into UTC for deterministic recurrence
// expansion and all-day parsing. The display timezone is applied separately.
const originalTimezone = process.env.TZ;

process.env.TZ = 'UTC';

export const containerTimezone = originalTimezone;
