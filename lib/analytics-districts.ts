export const ANALYTICS_DISTRICTS = [
  { name: 'North Shore City', label: 'North Shore' },
  { name: 'Auckland Region', label: 'Auckland Region' },
] as const;

export type AnalyticsDistrict = (typeof ANALYTICS_DISTRICTS)[number]['name'];

export function getAnalyticsDistrictDataNames(name: string): string[] {
  if (name === 'Auckland Region' || name === 'Auckland') {
    return ['Auckland Region', 'Auckland'];
  }
  return [name];
}

export function getAnalyticsCanonicalDistrictName(name: string): string {
  if (name === 'Auckland') return 'Auckland Region';
  return ANALYTICS_DISTRICTS.find((district) => district.name === name)?.name ?? name;
}

export function isAnalyticsDistrict(name: string): name is AnalyticsDistrict {
  return ANALYTICS_DISTRICTS.some((district) => district.name === name);
}
