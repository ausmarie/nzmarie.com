/**
 * React Hook for Google Places Autocomplete
 * 
 * Manages session tokens, debouncing, and state for address autocomplete.
 * Cost-optimized: One complete user interaction = 1 billed session.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleAutocompleteService, ParsedAddress, parseAddressComponents } from '@/lib/google-maps';

interface UsePlacesAutocompleteOptions {
  debounceMs?: number;
  minInputLength?: number;
}

interface UsePlacesAutocompleteReturn {
  suggestions: google.maps.places.AutocompletePrediction[];
  isLoading: boolean;
  error: string | null;
  selectSuggestion: (placeId: string) => Promise<ParsedAddress | null>;
  clearSuggestions: () => void;
}

export function useGooglePlacesAutocomplete(
  inputValue: string,
  options: UsePlacesAutocompleteOptions = {}
): UsePlacesAutocompleteReturn {
  const { debounceMs = 300, minInputLength = 3 } = options;
  
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceReady, setServiceReady] = useState(false);
  
  const serviceRef = useRef<GoogleAutocompleteService | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSelectingRef = useRef(false);
  
  // Initialize Google Maps service
  useEffect(() => {
    const initService = async () => {
      try {
        const service = new GoogleAutocompleteService();
        await service.initialize();
        serviceRef.current = service;
        setServiceReady(true);
      } catch (err) {
        console.error('Failed to initialize Google Maps:', err);
        setError('Failed to load address search. Please refresh the page.');
        setServiceReady(false);
      }
    };
    
    initService();
  }, []);
  
  // Fetch predictions when input changes
  useEffect(() => {
    // Skip if service is not ready yet
    if (!serviceReady) {
      return;
    }

    // Skip if user just selected a suggestion
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }
    
    // Clear suggestions if input is too short
    if (inputValue.length < minInputLength) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Debounce the API call
    setIsLoading(true);
    setError(null);
    
    debounceTimerRef.current = setTimeout(async () => {
      if (!serviceRef.current) {
        setIsLoading(false);
        return;
      }
      
      try {
        const predictions = await serviceRef.current.getPredictions(inputValue);
        setSuggestions(predictions);
      } catch (err) {
        console.error('Error fetching predictions:', err);
        setError('Failed to fetch suggestions');
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputValue, minInputLength, debounceMs, serviceReady]);
  
  /**
   * Select a suggestion and get full place details
   * This completes the session token lifecycle
   */
  const selectSuggestion = useCallback(async (placeId: string): Promise<ParsedAddress | null> => {
    if (!serviceRef.current) {
      return null;
    }
    
    isSelectingRef.current = true;
    
    try {
      const placeDetails = await serviceRef.current.getPlaceDetails(placeId);
      const parsedAddress = parseAddressComponents(placeDetails);
      
      // Clear suggestions after selection
      setSuggestions([]);
      
      return parsedAddress;
    } catch (err) {
      console.error('Error fetching place details:', err);
      setError('Failed to get address details');
      return null;
    }
  }, []);
  
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
  }, []);
  
  return {
    suggestions,
    isLoading,
    error,
    selectSuggestion,
    clearSuggestions,
  };
}
