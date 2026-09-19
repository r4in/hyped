import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultWeather } from '../lib/wardrobe';
import { isCurrentWeather, requestLocalWeather, WEATHER_MAX_AGE } from '../lib/location-weather';

const live = () => ({ ...defaultWeather, source: 'live' as const, at: new Date().toISOString() });
const location = { getCurrentPosition(success: PositionCallback) {
  success({ coords: { latitude: 43.65321, longitude: -79.38321 } } as GeolocationPosition);
} };
const denied = { getCurrentPosition(_success: PositionCallback, failure?: PositionErrorCallback | null) {
  failure?.({ code: 1 } as GeolocationPositionError);
} };

test('device location fetches fresh weather using approximate coordinates', async () => {
  let requested = '';
  const fetcher = (async (url: string | URL | Request) => { requested = String(url); return Response.json(live()); }) as typeof fetch;
  const result = await requestLocalWeather(location, fetcher);
  assert.equal(requested, '/api/weather?lat=43.65&lon=-79.38');
  assert.equal(result.city, 'Near you');
  assert(isCurrentWeather(result));
});
test('missing permission never supplies default weather', async () => {
  await assert.rejects(requestLocalWeather(denied), /Allow location access/);
  await assert.rejects(requestLocalWeather(undefined), /unavailable/);
});
test('a known city is an explicitly labeled fallback with newly fetched conditions', async () => {
  const calls: string[] = [];
  const city = 'Toronto, Ontario, Canada';
  const fetcher = (async (url: string | URL | Request) => {
    calls.push(String(url));
    return Response.json(String(url).includes('city=')
      ? { locations: [{ name: city, latitude: 43.65, longitude: -79.38 }] } : live());
  }) as typeof fetch;
  const result = await requestLocalWeather(denied, fetcher, city);
  assert.equal(result.city, city); assert(isCurrentWeather(result)); assert.equal(calls.length, 2);
});
test('an ambiguous saved city is not silently substituted', async () => {
  const fetcher = (async () => Response.json({ locations: [{ name: 'Toronto, Ohio, United States', latitude: 40, longitude: -80 }] })) as typeof fetch;
  await assert.rejects(requestLocalWeather(denied, fetcher, 'Toronto, Ontario, Canada'), /Allow location access/);
});
test('stale, malformed and failed weather responses cannot be used', async () => {
  for (const body of [{ ...live(), at: new Date(Date.now() - WEATHER_MAX_AGE).toISOString() }, { ...live(), humidity: 200 }, null]) {
    await assert.rejects(requestLocalWeather(location, (async () => Response.json(body)) as typeof fetch), /unavailable/);
  }
  await assert.rejects(requestLocalWeather(location, (async () => new Response('', { status: 503 })) as typeof fetch), /unavailable/);
  assert(!isCurrentWeather(defaultWeather));
  assert(!isCurrentWeather({ ...live(), at: 'invalid' }));
});
