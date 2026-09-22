import { weatherSchema } from './validation';
import type { Weather } from './wardrobe';
import { isCurrentWeather, requestProviderWeather } from './weather-provider';
export { isCurrentWeather, WEATHER_MAX_AGE } from './weather-provider';

export type WeatherLocation = { name: string; latitude: number; longitude: number };

function validLocations(value: unknown): WeatherLocation[] {
  if (!Array.isArray(value)) throw Error('Invalid location response.');
  return value.filter((p): p is WeatherLocation => p && typeof p.name === 'string' && p.name.length <= 500 && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180);
}

export async function searchWeatherLocations(query: string, fetcher = fetch): Promise<WeatherLocation[]> {
  const name = query.trim();
  if (name.length < 2 || name.length > 100) throw Error('Enter between 2 and 100 characters for a city.');
  let response: Response | undefined;
  try { response = await fetcher('/api/weather?city=' + encodeURIComponent(name), { signal: AbortSignal.timeout(12000), cache: 'no-store' }); } catch {}
  if (response?.status === 401 || response?.status === 403) throw Error('Sign in again to search for a city.');
  if (response?.ok) {
    try { return validLocations((await response.json() as { locations?: unknown }).locations); } catch {}
  }
  try {
    const direct = await fetcher('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(name) + '&count=5&language=en&format=json', { signal: AbortSignal.timeout(8000), credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!direct.ok) throw Error();
    const data = await direct.json() as { results?: Record<string, unknown>[] };
    return validLocations((data.results || []).map((p: Record<string, unknown>) => ({ ...p, name: [p.name, p.admin1, p.country].filter(Boolean).join(', ') })));
  } catch { throw Error('City search is temporarily unavailable. Please try again.'); }
}

export async function resolveSavedWeatherLocation(city: string, fetcher = fetch) {
  const places = await searchWeatherLocations(city.split(',')[0], fetcher);
  const match = places.find(p => p.name === city);
  if (!match) throw Error('Please search for your city again and choose a matching location.');
  return match;
}

export async function requestLocalWeather(location: Pick<Geolocation, 'getCurrentPosition'> | undefined, fetcher = fetch, savedCity = '', selectedLocation?: WeatherLocation): Promise<Weather> {
  let latitude: number, longitude: number, city = 'Near you';
  if (selectedLocation) {
    ({ latitude, longitude, name: city } = selectedLocation);
  } else {
  try {
    if (!location) throw Error('Location is unavailable in this browser. Search for your city below.');
    const position = await new Promise<GeolocationPosition>((resolve, reject) => location.getCurrentPosition(resolve, error => {
    reject(Error(error.code === 1
      ? 'Allow location access in your browser, or search for your city below.'
      : 'We couldn’t find your location. Search for your city below.'));
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
  }
  // City-scale precision is enough for weather; do not send or store exact GPS coordinates.
  const lat = latitude.toFixed(2), lon = longitude.toFixed(2);
  let response: Response | undefined;
  try {
    response = await fetcher(`/api/weather?lat=${lat}&lon=${lon}`, { signal: AbortSignal.timeout(12000), cache: 'no-store' });
  } catch { /* A network failure can still recover via the public provider. */ }
  if (response?.status === 401 || response?.status === 403) throw Error('Sign in again to get your local weather.');
  if (response?.ok) {
    try {
      const body = await response.json();
      const result = weatherSchema.safeParse(body && typeof body === 'object' ? { ...body, city } : null);
      if (result.success && isCurrentWeather(result.data)) return result.data;
    } catch { /* Treat an invalid proxy response like an unavailable one. */ }
  }
  // Hosting-provider egress can fail even when Open-Meteo is reachable on the
  // user's connection. Recover once through the same provider, with validation.
  try {
    return await requestProviderWeather(Number(lat), Number(lon), city, fetcher);
  } catch {
    throw Error('Local weather is temporarily unavailable. Please try again.');
  }
}
