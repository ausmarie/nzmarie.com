const DEFAULT_API_BASE_URL = "";
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;

export const API_ENDPOINTS = {
  property: `${API_BASE_URL}/api/property`,
  propertyAutocomplete: `${API_BASE_URL}/api/property/autocomplete`,
  regions: `${API_BASE_URL}/api/regions`,
} as const;

export function getApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http')) return endpoint;
  return `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
}

export const API_CONFIG = {
  timeout: 30000,
  retries: 2,
} as const;
