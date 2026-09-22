'use client';
import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { searchWeatherLocations, type WeatherLocation } from '@/lib/location-weather';

export function WeatherLocationPicker({ disabled, onChoose, onDevice }: {
  disabled: boolean; onChoose: (place: WeatherLocation) => void; onDevice: () => void;
}) {
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<WeatherLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  const searchId = useRef(0);
  async function search(event: React.FormEvent) {
    event.preventDefault();
    const id = ++searchId.current;
    setSearching(true); setMessage(''); setPlaces([]);
    try {
      const results = await searchWeatherLocations(query);
      if (id !== searchId.current) return;
      setPlaces(results);
      setMessage(results.length ? 'Choose your city below.' : 'No cities found. Try a nearby city or a different spelling.');
    } catch (error) {
      if (id === searchId.current) setMessage(error instanceof Error ? error.message : 'Please try again.');
    } finally { if (id === searchId.current) setSearching(false); }
  }
  return <div className="weather-location-picker">
    <form onSubmit={search}>
      <label htmlFor="weather-city">City or town</label>
      <div className="weather-city-search">
        <Input id="weather-city" value={query} placeholder="e.g. Toronto" maxLength={100} autoComplete="off" onChange={e => {
          ++searchId.current; setQuery(e.target.value); setPlaces([]); setMessage(''); setSearching(false);
        }}/>
        <button type="submit" className="outline-button" disabled={disabled || searching || query.trim().length < 2}>{searching ? 'Searching…' : 'Search'}</button>
      </div>
    </form>
    {message && <p className="weather-search-message" role="status">{message}</p>}
    {places.length > 0 && <ul className="weather-city-results" aria-label="Matching cities">{places.map(place => <li key={`${place.name}:${place.latitude}:${place.longitude}`}>
      <button type="button" disabled={disabled} onClick={() => {
        setQuery(place.name.split(',')[0]); setPlaces([]); setMessage(''); onChoose(place);
      }}>{place.name}</button>
    </li>)}</ul>}
    <button type="button" className="text-button weather-device-location" disabled={disabled} onClick={() => {
      ++searchId.current; setPlaces([]); setMessage(''); setSearching(false); onDevice();
    }}>Use my location</button>
  </div>;
}
