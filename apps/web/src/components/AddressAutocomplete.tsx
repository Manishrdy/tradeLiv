'use client';

import { useState, useEffect, useRef } from 'react';

export interface AddressParts {
  line1: string;
  city: string;
  state: string;
  zip: string;
}

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

async function fetchSuggestions(input: string): Promise<Suggestion[]> {
  if (!API_KEY || input.length < 3) return [];
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': API_KEY },
      body: JSON.stringify({
        input,
        includedRegionCodes: ['us'],
        includedPrimaryTypes: ['street_address', 'premise'],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.suggestions || []).map((s: {
      placePrediction: {
        placeId: string;
        structuredFormat: {
          mainText: { text: string };
          secondaryText?: { text: string };
        };
      };
    }) => ({
      placeId: s.placePrediction.placeId,
      mainText: s.placePrediction.structuredFormat.mainText.text,
      secondaryText: s.placePrediction.structuredFormat.secondaryText?.text ?? '',
    }));
  } catch {
    return [];
  }
}

async function fetchPlaceDetails(placeId: string): Promise<AddressParts | null> {
  if (!API_KEY) return null;
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: { 'X-Goog-Api-Key': API_KEY, 'X-Goog-FieldMask': 'addressComponents' },
    });
    if (!res.ok) return null;
    const data = await res.json();

    const components: { longText: string; shortText: string; types: string[] }[] =
      data.addressComponents || [];

    const get = (type: string, short = false) => {
      const c = components.find((c) => c.types.includes(type));
      return c ? (short ? c.shortText : c.longText) : '';
    };

    const line1 = [get('street_number'), get('route')].filter(Boolean).join(' ');
    const city = get('locality') || get('sublocality_level_1');
    const state = get('administrative_area_level_1', true);
    const zip = get('postal_code');

    return { line1, city, state, zip };
  } catch {
    return null;
  }
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onAddressSelect: (parts: AddressParts) => void;
  placeholder?: string;
}

export function AddressAutocomplete({ value, onChange, onAddressSelect, placeholder }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasKey = !!API_KEY;

  useEffect(() => {
    if (!hasKey) return;
    clearTimeout(debounceRef.current);

    if (value.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await fetchSuggestions(value);
      setSuggestions(results);
      setOpen(results.length > 0);
      setActiveIndex(-1);
      setLoading(false);
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [value, hasKey]);

  useEffect(() => {
    if (!hasKey) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [hasKey]);

  async function selectSuggestion(s: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    onChange(s.mainText);
    const parts = await fetchPlaceDetails(s.placeId);
    if (parts) onAddressSelect(parts);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  // No API key — plain input fallback
  if (!hasKey) {
    return (
      <input
        className="input-field"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          className="input-field"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          style={{ paddingRight: loading ? 36 : undefined }}
        />
        {loading && (
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', lineHeight: 0 }}>
            <svg className="anim-rotate" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          </span>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: 'var(--bg-card, #fff)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={s.placeId}
              onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                padding: '9px 14px',
                cursor: 'pointer',
                background: i === activeIndex ? 'var(--bg-hover, #f5f5f5)' : 'transparent',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{s.mainText}</div>
              {s.secondaryText && (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{s.secondaryText}</div>
              )}
            </div>
          ))}
          {/* Required Google attribution */}
          <div style={{
            padding: '5px 14px',
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5,
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>Powered by Google</span>
          </div>
        </div>
      )}
    </div>
  );
}
