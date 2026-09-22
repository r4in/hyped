'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isCurrentWeather, requestLocalWeather, resolveSavedWeatherLocation, type WeatherLocation } from '@/lib/location-weather';
import type { Weather } from '@/lib/wardrobe';

export function useLocalWeather(enabled: boolean, savedCity = '') {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(false), requestId = useRef(0), inFlight = useRef(false);
  const current = useRef<Weather | null>(null);
  const selected = useRef<WeatherLocation | null | undefined>(undefined);
  const saved = useRef(savedCity);
  saved.current = savedCity;

  const refresh = useCallback(async (selection?: WeatherLocation | null) => {
    if (!enabled || (inFlight.current && selection === undefined)) return;
    if (selection !== undefined) {
      selected.current = selection;
      current.current = null; setWeather(null);
    }
    const id = ++requestId.current;
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      if (selected.current === undefined && saved.current) {
        const place = await resolveSavedWeatherLocation(saved.current);
        if (!mounted.current || id !== requestId.current) return;
        selected.current = place;
      }
      const next = await requestLocalWeather(navigator.geolocation, fetch, '', selected.current || undefined);
      if (!mounted.current || id !== requestId.current) return;
      current.current = next; setWeather(next);
    } catch (e) {
      if (!mounted.current || id !== requestId.current) return;
      if (!isCurrentWeather(current.current)) { current.current = null; setWeather(null); }
      setError(e instanceof Error ? e.message : 'Weather is unavailable. Please try again.');
    } finally {
      if (id === requestId.current) {
        inFlight.current = false;
        if (mounted.current) setBusy(false);
      }
    }
  }, [enabled]);
  useEffect(() => {
    mounted.current = true;
    if (enabled) void refresh();
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      if (!isCurrentWeather(current.current)) setWeather(null);
      void refresh();
    };
    const timer = setInterval(check, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => { mounted.current = false; clearInterval(timer); document.removeEventListener('visibilitychange', check); window.removeEventListener('online', check); };
  }, [enabled, refresh]);
  return { weather, busy, error, refresh, chooseLocation: (place: WeatherLocation) => refresh(place), useDeviceLocation: () => refresh(null) };
}
