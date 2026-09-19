import { weatherSchema } from './validation';
import type { Weather } from './wardrobe';

export const WEATHER_MAX_AGE = 30 * 60 * 1000;
export function isCurrentWeather(weather: Weather | null, now = Date.now()): weather is Weather {
  if (!weather || weather.source !== 'live') return false;
  const age = now - Date.parse(weather.at);
  return Number.isFinite(age) && age >= 0 && age < WEATHER_MAX_AGE;
}

export async function requestLocalWeather(location: Pick<Geolocation, 'getCurrentPosition'> | undefined, fetcher = fetch, savedCity = ''): Promise<Weather> {
  let latitude: number, longitude: number, city = 'Near you';
  try {
    if (!location) throw Error('Location is unavailable in this browser. Open HYOPE in a browser with location access.');
    const position = await new Promise<GeolocationPosition>((resolve, reject) => location.getCurrentPosition(resolve, error => {
    reject(Error(error.code === 1
      ? 'Allow location access in your browser to get local weather, then try again.'
      : 'We couldn’t find your location. Please try again.'));
    }, { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 10000 }));
    latitude = position.coords.latitude; longitude = position.coords.longitude;
  } catch (error) {
    // Only reuse an explicitly recorded city with a previous observation, never the seed default.
    if (!savedCity) throw error;
    const lookup = await fetcher('/api/weather?city=' + encodeURIComponent(savedCity.split(',')[0]), { signal: AbortSignal.timeout(12000), cache: 'no-store' });
    if (!lookup.ok) throw error;
    const places = await lookup.json() as { locations?: { name: string; latitude: number; longitude: number }[] };
    const match = places.locations?.find(p => p.name === savedCity && Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
    if (!match) throw error;
    latitude = match.latitude; longitude = match.longitude; city = match.name;
  }
  // City-scale precision is enough for weather; do not send or store exact GPS coordinates.
  const lat = latitude.toFixed(2), lon = longitude.toFixed(2);
  const response = await fetcher(`/api/weather?lat=${lat}&lon=${lon}`, { signal: AbortSignal.timeout(12000), cache: 'no-store' });
  if (!response.ok) throw Error('Local weather is temporarily unavailable. Please try again.');
  const body = await response.json();
  const result = weatherSchema.safeParse(body && typeof body === 'object' ? { ...body, city } : null);
  if (!result.success || !isCurrentWeather(result.data)) throw Error('Current weather is unavailable. Please try again.');
  return result.data;
}
