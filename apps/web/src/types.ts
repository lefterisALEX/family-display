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

export type WeatherUnits = 'c' | 'f';

export interface WeatherConfig {
  latitude: number | null;
  longitude: number | null;
  units: WeatherUnits;
  location?: string | null;
}

export interface WeatherDay {
  date: string;
  code: number;
  min: number;
  max: number;
  precip: number | null;
}

export interface WeatherResponse {
  configured: boolean;
  location?: { latitude: number; longitude: number };
  locationName?: string | null;
  units: WeatherUnits;
  current?: {
    temp: number;
    code: number;
    isDay: boolean;
    humidity: number | null;
    time: string;
  };
  daily?: WeatherDay[];
  fetchedAt: string;
  error?: string;
}

export interface HaEntityRef {
  id: string;
  name: string;
}

export interface HaEntityConfig {
  temperatures: HaEntityRef[];
  lights: HaEntityRef[];
  scenes: HaEntityRef[];
}

export interface HaState {
  state: string;
  unit?: string;
  name: string;
}
