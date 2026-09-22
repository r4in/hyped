import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultWeather } from '../lib/wardrobe';
import { isCurrentWeather, requestLocalWeather, WEATHER_MAX_AGE, searchWeatherLocations, resolveSavedWeatherLocation } from '../lib/location-weather';
import { requestProviderWeather } from '../lib/weather-provider';

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

const observation = () => ({ current: {
  time: Math.floor(Date.now() / 1000) - 60, temperature_2m: 10, apparent_temperature: 7,
  precipitation: 0, wind_speed_10m: 15, relative_humidity_2m: 72, is_day: 0,
} });

test('a selected city skips device location and fetches its weather', async () => {
  const place = { name: 'Toronto, Ontario, Canada', latitude: 43.65, longitude: -79.38 };
  const result = await requestLocalWeather({ getCurrentPosition() { throw Error('Device location must not be used'); } }, (async () => Response.json(live())) as typeof fetch, '', place);
  assert.equal(result.city, place.name);
});

test('city search recovers from server failure and keeps distinct matching places', async () => {
  const result = await searchWeatherLocations('Toronto', (async (url: string | URL | Request) => String(url).startsWith('/')
    ? new Response('', { status: 503 })
    : Response.json({ results: [
      { name: 'Toronto', admin1: 'Ontario', country: 'Canada', latitude: 43.65, longitude: -79.38 },
      { name: 'Toronto', admin1: 'Ohio', country: 'United States', latitude: 40.46, longitude: -80.60 },
    ] })) as typeof fetch);
  assert.equal(result.length, 2);
  assert.equal(result[0].name, 'Toronto, Ontario, Canada');
  await assert.rejects(resolveSavedWeatherLocation('Toronto, Ontario, Canada', (async () => Response.json({ locations: [result[1]] })) as typeof fetch), /choose a matching location/);
});

test('server errors and network failures recover with a validated direct observation', async () => {
  for (const failure of [503, 429, 'network']) {
    const requests: string[] = [];
    const data = observation();
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      requests.push(String(url));
      if (String(url).startsWith('/')) {
        if (failure === 'network') throw new TypeError('Failed to fetch');
        return new Response('', { status: Number(failure) });
      }
      const query = new URL(String(url));
      assert.equal(query.origin, 'https://api.open-meteo.com');
      assert.equal(query.searchParams.get('latitude'), '43.65');
      assert.equal(query.searchParams.get('longitude'), '-79.38');
      assert.equal(query.searchParams.get('timeformat'), 'unixtime');
      assert.equal(init?.credentials, 'omit');
      assert.equal(init?.referrerPolicy, 'no-referrer');
      return Response.json(data);
    }) as typeof fetch;
    const weather = await requestLocalWeather(location, fetcher);
    assert.equal(weather.temp, 10); assert.equal(weather.city, 'Near you');
    assert.equal(weather.isDay, false);
    assert.equal(weather.at, new Date(data.current.time * 1000).toISOString());
    assert(isCurrentWeather(weather)); assert.equal(requests.length, 2);
  }
});

test('authentication failures do not trigger a direct weather request', async () => {
  let count = 0;
  await assert.rejects(requestLocalWeather(location, (async () => {
    count++; return new Response('', { status: 401 });
  }) as typeof fetch), /Sign in/);
  assert.equal(count, 1);
});

test('direct weather rejects old, future, missing and invalid provider observations', async () => {
  for (const changes of [
    { time: (Date.now() - WEATHER_MAX_AGE - 1000) / 1000 },
    { time: (Date.now() + 60000) / 1000 }, { time: null }, { temperature_2m: null },
    { relative_humidity_2m: 200 }, { is_day: null },
  ]) {
    await assert.rejects(requestProviderWeather(43.65, -79.38, 'Near you', (async () =>
      Response.json({ current: { ...observation().current, ...changes } })) as typeof fetch));
  }
});
