'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { matchProvince } from '@/data/argentinaLocations';

export interface AddressSearchResult {
  address: string;
  province?: string;
  department?: string;
  lat: number;
  lng: number;
}

interface GoogleAddressSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelectResult: (result: AddressSearchResult) => void;
  placeholder?: string;
}

export function GoogleAddressSearch({
  value,
  onChange,
  onSelectResult,
  placeholder = 'Buscar dirección, localidad o ciudad en Argentina...',
}: GoogleAddressSearchProps) {
  const [suggestions, setSuggestions] = useState<AddressSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search fetching restricted to Argentina
  useEffect(() => {
    if (!value || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Query OpenStreetMap Nominatim Geocoding API restricted to Argentina (countrycodes=ar)
        const endpoint = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=ar&q=${encodeURIComponent(
          value
        )}&limit=5`;

        const res = await fetch(endpoint, {
          headers: {
            'Accept-Language': 'es-AR,es',
          },
        });

        if (res.ok) {
          const data = await res.json();
          const parsed: AddressSearchResult[] = data.map((item: any) => {
            const addr = item.address || {};
            const rawProvince = addr.state || addr.province || '';
            const province = matchProvince(rawProvince) || rawProvince;
            const department = addr.county || addr.state_district || addr.city || addr.town || addr.municipality || '';

            return {
              address: item.display_name,
              province,
              department,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            };
          });

          setSuggestions(parsed);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Error fetching address suggestions:', err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [value]);

  const handleSelect = (item: AddressSearchResult) => {
    onChange(item.address);
    onSelectResult(item);
    setShowDropdown(false);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowDropdown(true);
          }}
          placeholder={placeholder}
          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-10 pr-10 py-2.5 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all text-sm"
        />
        <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 pointer-events-none" />
        {loading && <Loader2 className="w-4 h-4 text-green-600 animate-spin absolute right-3.5" />}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelect(item)}
              className="w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors flex items-start gap-3 text-xs"
            >
              <MapPin className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 overflow-hidden">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{item.address}</p>
                {(item.province || item.department) && (
                  <p className="text-zinc-400 text-[11px]">
                    {[item.department, item.province].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
