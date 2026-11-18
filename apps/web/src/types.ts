export interface Source {
  id: string;
  name: string;
  type: string;
  url: string;
  color: string;
  enabled: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceColor: string;
  title: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  startTs: number;
  endTs: number;
  allDay: boolean;
  timezone: string | null;
  status: string | null;
  organizer: string | null;
  recurrenceId: string | null;
}
