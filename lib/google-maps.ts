/**
 * Google Maps Platform API Utilities
 * 
 * Cost-optimized implementation using Session Tokens to minimize billing.
 * One session = from user starts typing to final selection = billed as 1 request.
 * 
 * CRITICAL: Always use session tokens to avoid per-keystroke billing!
 */

// Load Google Maps script with NZ localization
let googleMapsLoaded = false;
let googleMapsLoadPromise: Promise<void> | null = null;

type GoogleMapsGlobal = typeof globalThis & {
  google?: typeof google;
};

export function loadGoogleMapsScript(): Promise<void> {
  if (googleMapsLoaded) {
    return Promise.resolve();
  }

  if (googleMapsLoadPromise) {
    return googleMapsLoadPromise;
  }

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const globalObj: GoogleMapsGlobal | null =
      typeof globalThis !== 'undefined'
        ? (globalThis as GoogleMapsGlobal)
        : typeof window !== 'undefined'
          ? (window as GoogleMapsGlobal)
          : null;

    // If a mock or existing google object is already present, use it.
    if (globalObj?.google?.maps?.places) {
      googleMapsLoaded = true;
      resolve();
      return;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      googleMapsLoaded = true;
      resolve();
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      if (process.env.NODE_ENV !== 'production') {
        googleMapsLoaded = true;
        resolve();
        return;
      }

      reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not defined and no global google object is available'));
      return;
    }

    // Check if script already exists or global google.maps is loaded
    if (typeof window !== 'undefined' && (window.google?.maps || document.querySelector('script[src*="maps.googleapis.com"]'))) {
      googleMapsLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement('script');
    // Force English language and New Zealand region
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=en&region=NZ`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      googleMapsLoaded = true;
      resolve();
    };
    
    script.onerror = () => {
      googleMapsLoadPromise = null;
      reject(new Error('Failed to load Google Maps script'));
    };
    
    document.head.appendChild(script);
  });

  return googleMapsLoadPromise;
}

/**
 * Parsed address components from Google Places
 */
export interface ParsedAddress {
  street: string;          // "5 Cottam Grove"
  suburb: string;          // "Northcross"
  city: string;            // "Auckland"
  postcode: string;        // "0632"
  fullAddress: string;     // Full formatted address
}

/**
 * Parse Google Place address_components into clean NZ address fields
 */
export function parseAddressComponents(
  place: google.maps.places.PlaceResult
): ParsedAddress {
  const components = place.address_components || [];
  
  let streetNumber = '';
  let route = '';
  let suburb = '';
  let city = '';
  let postcode = '';
  
  components.forEach(component => {
    const types = component.types;
    
    if (types.includes('street_number')) {
      streetNumber = component.long_name;
    }
    if (types.includes('route')) {
      route = component.long_name;
    }
    // Suburb can be in multiple types
    if (types.includes('sublocality_level_1') || types.includes('sublocality') || types.includes('neighborhood')) {
      suburb = component.long_name;
    }
    if (types.includes('locality')) {
      city = component.long_name;
    }
    if (types.includes('postal_code')) {
      postcode = component.long_name;
    }
  });
  
  // Combine street number + route for street field
  const street = [streetNumber, route].filter(Boolean).join(' ');
  
  return {
    street: street || '',
    suburb: suburb || '',
    city: city || '',
    postcode: postcode || '',
    fullAddress: place.formatted_address || '',
  };
}

/**
 * Extract just the street name (without number) from full address or street field
 * Useful for grouping addresses by street
 * 
 * Examples:
 * - "5 Cottam Grove" → "Cottam Grove"
 * - "10 Cottam Grove, Northcross" → "Cottam Grove"
 * - "123A Queen Street" → "Queen Street"
 */
export function extractStreetName(fullAddress: string): string {
  // Remove leading number and optional unit (e.g., "5 ", "15A ", "123/456 ", "-7 ", "-11")
  let street = fullAddress.replace(/^-?\d+[A-Za-z]?(?:\/\d+)?\s+/, '');
  
  // Take everything before the first comma
  street = street.split(',')[0].trim();
  
  return street || '';
}

/**
 * Extract street name from parsed address components
 * Returns only the route (street name) without the street number
 * 
 * @param parsedAddress - ParsedAddress from parseAddressComponents
 * @returns Street name without number (e.g., "Cottam Grove")
 */
export function getStreetNameOnly(parsedAddress: ParsedAddress): string {
  // If street field exists and contains both number and name, extract just the name
  if (parsedAddress.street) {
    return extractStreetName(parsedAddress.street);
  }
  
  // Fallback: extract from full address
  return extractStreetName(parsedAddress.fullAddress);
}

/**
 * Create Google Maps Autocomplete Service with session token
 */
export class GoogleAutocompleteService {
  private service: google.maps.places.AutocompleteService | null = null;
  private placesService: google.maps.places.PlacesService | null = null;
  private sessionToken: google.maps.places.AutocompleteSessionToken | null = null;
  
  async initialize(): Promise<void> {
    await loadGoogleMapsScript();

    if (typeof google === 'undefined' || !google.maps?.places) {
      this.service = null;
      this.placesService = null;
      this.resetSessionToken();
      return;
    }
    
    if (!this.service) {
      this.service = new google.maps.places.AutocompleteService();
    }
    
    if (!this.placesService) {
      // PlacesService needs a DOM element (we use a hidden div)
      const div = document.createElement('div');
      this.placesService = new google.maps.places.PlacesService(div);
    }
    
    this.resetSessionToken();
  }
  
  /**
   * Reset session token - call this when starting a new search session
   */
  resetSessionToken(): void {
    if (typeof google === 'undefined' || !google.maps?.places?.AutocompleteSessionToken) {
      this.sessionToken = null;
      return;
    }

    this.sessionToken = new google.maps.places.AutocompleteSessionToken();
  }
  
  /**
   * Get autocomplete predictions for user input
   * Uses session token to optimize billing
   */
  async getPredictions(input: string): Promise<google.maps.places.AutocompletePrediction[]> {
    if (!this.service || !this.sessionToken) {
      throw new Error('Service not initialized');
    }
    
    if (input.length < 3) {
      return [];
    }
    
    return new Promise((resolve, reject) => {
      this.service!.getPlacePredictions(
        {
          input,
          sessionToken: this.sessionToken!,
          componentRestrictions: { country: 'nz' }, // Restrict to New Zealand
          types: ['address'], // Only street addresses
        },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            resolve(predictions);
          } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            resolve([]);
          } else {
            reject(new Error(`Places API error: ${status}`));
          }
        }
      );
    });
  }
  
  /**
   * Get place details by place_id
   * This completes the session token lifecycle
   */
  async getPlaceDetails(placeId: string): Promise<google.maps.places.PlaceResult> {
    if (!this.placesService || !this.sessionToken) {
      throw new Error('Service not initialized');
    }
    
    return new Promise((resolve, reject) => {
      this.placesService!.getDetails(
        {
          placeId,
          sessionToken: this.sessionToken!,
          fields: ['address_components', 'formatted_address', 'geometry'],
        },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            // Session is complete - reset token for next search
            this.resetSessionToken();
            resolve(place);
          } else {
            reject(new Error(`Place details error: ${status}`));
          }
        }
      );
    });
  }
}

/**
 * Fix Google Maps Street View image URLs by reconstructing with the correct API key
 * and returning error codes for missing street view images.
 * 
 * Parses lat/lng from the existing URL and rebuilds it as:
 *   https://maps.googleapis.com/maps/api/streetview?size=470x313&location={lat},{lng}&key={API_KEY}&return_error_code=true
 */
export function getFixedImageUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Only reconstruct Google Street View URLs
  if (url.includes('maps.googleapis.com/maps/api/streetview')) {
    try {
      const urlObj = new URL(url);
      const location = urlObj.searchParams.get('location');
      if (location && apiKey) {
        const reconstructed = `https://maps.googleapis.com/maps/api/streetview?size=470x313&location=${encodeURIComponent(location)}&key=${apiKey}&return_error_code=true`;
        return reconstructed;
      }
    } catch {
      // URL parsing failed, fall through to legacy handling
    }
  }

  // Legacy fallback: add API key if missing
  if (url.includes('maps.googleapis.com') && !url.includes('key=') && !url.includes('client=')) {
    if (apiKey) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}key=${apiKey}`;
    }
  }

  return url;
}
