'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isCurrentWeather, requestLocalWeather } from '@/lib/location-weather';
import type { Weather } from '@/lib/wardrobe';

export function useLocalWeather(enabled: boolean, savedCity = '') {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false), mounted = useRef(false);
  const current = useRef<Weather | null>(null);
  const failed = useRef(false);
  const fallbackCity = useRef(savedCity);
  if (savedCity) fallbackCity.current = savedCity;
  const refresh = useCallback(async () => {
    if (!enabled || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      const next = await requestLocalWeather(navigator.geolocation, fetch, fallbackCity.current);
      if (!mounted.current) return;
      current.current = next; failed.current = false; setWeather(next);
    } catch (e) {
      if (!mounted.current) return;
      current.current = null; failed.current = true; setWeather(null);
      setError(e instanceof Error ? e.message : 'Weather is unavailable. Please try again.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [enabled]);
  useEffect(() => {
    mounted.current = true;
    if (enabled) void refresh();
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      if (!isCurrentWeather(current.current)) setWeather(null);
      if (!failed.current) void refresh();
    };
    const timer = setInterval(check, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', check);
    return () => { mounted.current = false; clearInterval(timer); document.removeEventListener('visibilitychange', check); };
  }, [enabled, refresh]);
  return { weather, busy, error, refresh };
}
