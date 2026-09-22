import { identity } from '@/lib/server';
import { requestProviderWeather } from '@/lib/weather-provider';

export async function GET(request: Request) {
  try { await identity(); }
  catch { return Response.json({ error: 'Sign in to access your local weather.' }, { status: 401 }); }

  const url = new URL(request.url);
  const city = url.searchParams.get('city');
  try {
    if (city) {
      if (city.length > 100 || city.length < 2) return Response.json({ error: 'Enter at least two letters of a city.' }, { status: 400 });
      const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=5&language=en&format=json', { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw Error(`City lookup returned HTTP ${r.status}.`);
      const data = await r.json() as { results?: { id: number; name: string; country: string; admin1: string; latitude: number; longitude: number }[] };
      return Response.json({ locations: (data.results || []).map(i => ({ id: i.id, name: [i.name, i.admin1, i.country].filter(Boolean).join(', '), latitude: i.latitude, longitude: i.longitude })) });
    }
    const rawLat = url.searchParams.get('lat'), rawLon = url.searchParams.get('lon');
    const lat = Number(rawLat), lon = Number(rawLon);
    if (!rawLat?.trim() || !rawLon?.trim() || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180) {
      return Response.json({ error: 'Invalid location.' }, { status: 400 });
    }
    const weather = await requestProviderWeather(lat, lon, 'Near you');
    return Response.json(weather, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    // Do not log request URLs, coordinates, user identity or provider bodies.
    const message = error instanceof Error ? error.message : '';
    console.error('Weather request failed', /^(Weather provider|City lookup) returned HTTP \d{3}\.$/.test(message) ? message : 'Provider timeout or invalid response');
    return Response.json({ error: 'Local weather is temporarily unavailable. Please try again.' }, { status: 503 });
  }
}
