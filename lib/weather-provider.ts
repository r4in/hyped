import { weatherSchema } from './validation';
import type { Weather } from './wardrobe';

export const WEATHER_MAX_AGE = 30 * 60 * 1000;

export function isCurrentWeather(weather: Weather | null, now = Date.now()): weather is Weather {
  if (!weather || weather.source !== 'live') return false;
  const age = now - Date.parse(weather.at);
  return Number.isFinite(age) && age >= 0 && age < WEATHER_MAX_AGE;
}

// Shared by the server and the browser recovery path. Never include credentials
// or precise device coordinates in this public, keyless provider request.
export async function requestProviderWeather(latitude: number, longitude: number, city: string, fetcher = fetch): Promise<Weather> {
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw Error('Invalid location.');
  }
  const query = new URLSearchParams({
    latitude: latitude.toFixed(2), longitude: longitude.toFixed(2),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,wind_speed_10m',
    temperature_unit: 'celsius', wind_speed_unit: 'kmh', precipitation_unit: 'mm',
    timezone: 'auto', timeformat: 'unixtime', forecast_days: '1',
  });
  const response = await fetcher(`https://api.open-meteo.com/v1/forecast?${query}`, {
    signal: AbortSignal.timeout(8000), credentials: 'omit', referrerPolicy: 'no-referrer',
  });
  if (!response.ok) throw Error(`Weather provider returned HTTP ${response.status}.`);
  const body = await response.json() as { current?: Record<string, unknown> };
  const c = body?.current;
  if (!c || typeof c.time !== 'number' || !Number.isFinite(c.time) || (c.is_day !== 0 && c.is_day !== 1)) {
    throw Error('Invalid weather observation.');
  }
  const observedAt = new Date(c.time * 1000);
  const season = (['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter'] as const)[observedAt.getUTCMonth()];
  const south = { Winter: 'Summer', Summer: 'Winter', Spring: 'Autumn', Autumn: 'Spring' } as const;
  const result = weatherSchema.safeParse({
    temp: c.temperature_2m, feels: c.apparent_temperature, rain: c.precipitation,
    wind: c.wind_speed_10m, humidity: c.relative_humidity_2m, isDay: c.is_day === 1,
    source: 'live', at: observedAt.toISOString(), city, season: latitude < 0 ? south[season] : season,
  });
  if (!result.success || !isCurrentWeather(result.data)) throw Error('Current weather is unavailable. Please try again.');
  return result.data;
}
