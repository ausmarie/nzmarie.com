import { useState, useEffect, useRef, useCallback } from 'react';
import { API_ENDPOINTS } from '@/lib/api/config';
import { useGooglePlacesAutocomplete } from '@/hooks/useGooglePlacesAutocomplete';

interface AddressSuggestion {
  id: string;
  address: string;
  suburb: string;
  city: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
  city?: string;
  placeholder?: string;
  apiEndpoint?: string;
  useGoogleMaps?: boolean;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  city,
  placeholder = 'Search by address...',
  apiEndpoint = API_ENDPOINTS.propertyAutocomplete,
  useGoogleMaps = false
}: AddressAutocompleteProps) {
  const {
    suggestions: googleSuggestions,
    isLoading: googleLoading,
    selectSuggestion: selectGoogleSuggestion,
  } = useGooglePlacesAutocomplete(value);

  const [internalSuggestions, setInternalSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingInternal, setIsLoadingInternal] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);
  const historyLoadedRef = useRef(false);
  const recentSearchesRef = useRef<string[]>([]);

  const saveToHistory = useCallback(async (query: string) => {
    if (!query.trim()) return;
    const trimmed = query.trim();
    setRecentSearches(prev => {
      const filtered = prev.filter(q => q !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, 10);
      recentSearchesRef.current = updated;
      return updated;
    });
    try {
      await fetch('/api/admin/search-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });
    } catch {
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (historyLoadedRef.current) return;
    try {
      const res = await fetch('/api/admin/search-history');
      if (res.ok) {
        const data = await res.json();
        const items = data.data ?? [];
        setRecentSearches(items);
        recentSearchesRef.current = items;
        historyLoadedRef.current = true;
      }
    } catch {
    }
  }, []);

  // Determine which suggestions and loading state to use
  const suggestions = useGoogleMaps
    ? googleSuggestions.map((pred) => ({
        id: pred.place_id,
        address: pred.description,
        suburb: pred.structured_formatting.secondary_text?.split(',')[0] || '',
        city: pred.structured_formatting.secondary_text?.split(',')[1]?.trim() || '',
      }))
    : internalSuggestions;

  const isLoading = useGoogleMaps ? googleLoading : isLoadingInternal;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setNoResults(false);
        setShowHistory(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions from internal API (when not using Google Maps)
  useEffect(() => {
    if (useGoogleMaps) return; // Skip internal API when using Google Maps

    const fetchSuggestions = async () => {
      if (isSelectingRef.current) {
        isSelectingRef.current = false;
        return;
      }

      if (value.length < 2) {
        setInternalSuggestions([]);
        setShowSuggestions(false);
        setNoResults(false);
        return;
      }

      setIsLoadingInternal(true);
      try {
        const params = new URLSearchParams({ q: value });
        if (city && city !== 'all-cities') {
          params.append('city', city);
        }

        const response = await fetch(`${apiEndpoint}?${params}`);
        const data = await response.json();
        setInternalSuggestions(data);
        setShowSuggestions(data.length > 0);
        setNoResults(data.length === 0);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setInternalSuggestions([]);
        setNoResults(false);
      } finally {
        setIsLoadingInternal(false);
      }
    };

    setIsSelected(false);
    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [value, city, apiEndpoint, useGoogleMaps]);

  // Update suggestions visibility for Google Maps
  useEffect(() => {
    if (useGoogleMaps) {
      setShowSuggestions(googleSuggestions.length > 0);
      setNoResults(value.length >= 3 && !googleLoading && googleSuggestions.length === 0);
    }
  }, [useGoogleMaps, googleSuggestions, googleLoading, value]);

  const handleSelect = async (suggestion: AddressSuggestion) => {
    isSelectingRef.current = true;
    setIsSelected(true);
    setShowSuggestions(false);
    setNoResults(false);
    setShowHistory(false);

    if (useGoogleMaps) {
      const parsedAddress = await selectGoogleSuggestion(suggestion.id);
      if (parsedAddress) {
        onChange(parsedAddress.fullAddress);
        onSelect?.({
          id: suggestion.id,
          address: parsedAddress.fullAddress,
          suburb: parsedAddress.suburb,
          city: parsedAddress.city,
        });
        saveToHistory(parsedAddress.fullAddress);
      }
    } else {
      onChange(suggestion.address);
      onSelect?.(suggestion);
      saveToHistory(suggestion.address);
    }
  };

  const handleHistorySelect = (query: string) => {
    setIsSelected(true);
    setShowHistory(false);
    setShowSuggestions(false);
    onChange(query);
    saveToHistory(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      saveToHistory(value.trim());
    }
  };

  const handleFocus = async () => {
    if (!value) {
      await loadHistory();
      if (recentSearchesRef.current.length > 0) {
        setShowHistory(true);
      }
    } else if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }; 

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <span style={{
        position: 'absolute',
        left: '16px',
        top: '50%',
        transform: 'translateY(-50%)',
        fontSize: '1.2rem',
        zIndex: 1,
        pointerEvents: 'none',
      }}>📍</span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        style={{
          padding: '14px 48px 14px 44px',
          borderRadius: '10px',
          border: `2px solid ${isSelected ? '#86efac' : noResults ? '#fcd34d' : 'var(--input-border)'}`,
          fontSize: '16px',
          width: '100%',
          backgroundColor: 'var(--input-bg)',
          color: 'var(--foreground)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          transition: 'all 0.2s',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />

      {isSelected && (
        <span style={{
          position: 'absolute',
          right: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#22c55e',
          fontWeight: 700,
          fontSize: '1.1rem',
        }}>✓</span>
      )}

      {isLoading && !isSelected && (
        <span style={{
          position: 'absolute',
          right: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#94a3b8',
          fontSize: '14px',
        }}>⏳</span>
      )}

      {showHistory && recentSearches.length > 0 && !value && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '6px',
          backgroundColor: 'var(--card-bg)',
          border: '2px solid #cbd5e1',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          maxHeight: '300px',
          overflowY: 'auto',
          zIndex: 1000,
          listStyle: 'none',
          padding: 0,
          margin: '6px 0 0',
        }}>
          <li style={{
            padding: '8px 16px',
            backgroundColor: '#f8fafc',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#64748b',
            borderBottom: '1px solid #e2e8f0',
            borderRadius: '10px 10px 0 0',
          }}>
            🕐 Recent searches:
          </li>
          {recentSearches.map((query, index) => (
            <li
              key={index}
              onMouseDown={() => handleHistorySelect(query)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: index < recentSearches.length - 1 ? '1px solid var(--card-border)' : 'none',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLLIElement).style.backgroundColor = '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLLIElement).style.backgroundColor = 'var(--card-bg)';
              }}
            >
              <span style={{ marginRight: '8px', color: '#94a3b8' }}>🕐</span>
              <span style={{ fontWeight: 500, color: 'var(--text-heading)' }}>{query}</span>
            </li>
          ))}
        </ul>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '6px',
          backgroundColor: 'var(--card-bg)',
          border: '2px solid #93c5fd',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          maxHeight: '300px',
          overflowY: 'auto',
          zIndex: 1000,
          listStyle: 'none',
          padding: 0,
          margin: '6px 0 0',
        }}>
          <li style={{
            padding: '8px 16px',
            backgroundColor: '#eff6ff',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#2563eb',
            borderBottom: '1px solid #bfdbfe',
            borderRadius: '10px 10px 0 0',
          }}>
            📍 Select an address:
          </li>
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.id}-${index}`}
              onMouseDown={() => handleSelect(suggestion)}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: index < suggestions.length - 1 ? '1px solid var(--card-border)' : 'none',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLLIElement).style.backgroundColor = '#eff6ff';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLLIElement).style.backgroundColor = 'var(--card-bg)';
              }}
            >
              <span style={{ marginRight: '8px', color: '#3b82f6' }}>📍</span>
              <span style={{ fontWeight: 500, color: 'var(--text-heading)' }}>{suggestion.address}</span>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px', paddingLeft: '26px' }}>
                {suggestion.suburb}, {suggestion.city}
              </div>
            </li>
          ))}
        </ul>
      )}

      {noResults && !isLoading && value.length >= 2 && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '6px',
          backgroundColor: 'var(--card-bg)',
          border: '1px solid #fde68a',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
          zIndex: 1000,
          listStyle: 'none',
          padding: 0,
          margin: '6px 0 0',
        }}>
          <li style={{ padding: '14px 16px', fontSize: '14px', color: '#6b7280' }}>
            <span style={{ marginRight: '8px' }}>💡</span>
            No addresses found. Try including the street name, for example 12 Queen Street, Albany.
          </li>
        </ul>
      )}
    </div>
  );
}
