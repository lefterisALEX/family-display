import { getSetting } from './db.js';
import { getTimezone } from './timezone.js';

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

const CACHE_MS = 15 * 60 * 1000;
let cache: { at: number; payload: WeatherResponse } | null = null;

function parseCoord(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function getWeatherConfig(): WeatherConfig {
  return {
    latitude: parseCoord(getSetting('weather.latitude')),
    longitude: parseCoord(getSetting('weather.longitude')),
    units: getSetting('weather.units') === 'f' ? 'f' : 'c',
    location: getSetting('weather.location') || null,
  };
}

export function invalidateWeatherCache(): void {
  cache = null;
}

export async function fetchWeather(): Promise<WeatherResponse> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.payload;
  }

  const config = getWeatherConfig();
  if (config.latitude === null || config.longitude === null) {
    const response: WeatherResponse = {
      configured: false,
      units: config.units,
      fetchedAt: new Date().toISOString(),
    };
    cache = { at: Date.now(), payload: response };
    return response;
  }

  const tempUnit = config.units === 'f' ? 'fahrenheit' : 'celsius';
  const params = new URLSearchParams({
    latitude: String(config.latitude),
    longitude: String(config.longitude),
    current: 'temperature_2m,weather_code,is_day,relative_humidity_2m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    temperature_unit: tempUnit,
    timezone: getTimezone(),
    forecast_days: '4',
  });

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      headers: { 'User-Agent': 'family-display/0.1' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`Weather API HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        is_day?: number;
        relative_humidity_2m?: number;
        time?: string;
      };
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: (number | null)[];
      };
    };

    const daily: WeatherDay[] = [];
    if (data.daily?.time) {
      for (let i = 0; i < data.daily.time.length; i++) {
        daily.push({
          date: data.daily.time[i],
          code: data.daily.weather_code?.[i] ?? 0,
          min: data.daily.temperature_2m_min?.[i] ?? 0,
          max: data.daily.temperature_2m_max?.[i] ?? 0,
          precip: data.daily.precipitation_probability_max?.[i] ?? null,
        });
      }
    }

    const payload: WeatherResponse = {
      configured: true,
      location: { latitude: config.latitude, longitude: config.longitude },
      locationName: config.location,
      units: config.units,
      current: data.current
        ? {
            temp: data.current.temperature_2m ?? 0,
            code: data.current.weather_code ?? 0,
            isDay: (data.current.is_day ?? 1) === 1,
            humidity: data.current.relative_humidity_2m ?? null,
            time: data.current.time ?? '',
          }
        : undefined,
      daily,
      fetchedAt: new Date().toISOString(),
    };
    cache = { at: Date.now(), payload };
    return payload;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (cache) {
      cache.payload.error = message;
      cache.payload.fetchedAt = new Date().toISOString();
      return cache.payload;
    }
    return {
      configured: true,
      location: { latitude: config.latitude, longitude: config.longitude },
      locationName: config.location,
      units: config.units,
      fetchedAt: new Date().toISOString(),
      error: message,
    };
  }
}