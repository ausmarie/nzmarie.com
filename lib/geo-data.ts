/**
 * Geographic Data for New Zealand
 * 
 * Three-tier hierarchy: Region > City/District > Suburb
 * Used across the application for consistent location filtering and tracking
 */

export const REGIONS = ["Auckland", "Wellington"] as const;

export type Region = typeof REGIONS[number];

/**
 * Map of regions to their cities/districts
 */
export const REGION_CITIES: Record<Region, string[]> = {
  Auckland: ["North Shore City", "Auckland City", "Waitakere City", "Manukau City"],
  Wellington: ["Wellington City", "Lower Hutt City", "Upper Hutt City", "Porirua City"],
};

/**
 * Map of cities to their suburbs
 */
export const CITY_SUBURBS: Record<string, string[]> = {
  "North Shore City": [
    "Albany",
    "Bayview",
    "Bayswater",
    "Beach Haven",
    "Belmont",
    "Birkenhead",
    "Birkdale",
    "Browns Bay",
    "Campbells Bay",
    "Castor Bay",
    "Chatswood",
    "Devonport",
    "Fairview Heights",
    "Forrest Hill",
    "Glenfield",
    "Greenhithe",
    "Hauraki",
    "Hillcrest",
    "Long Bay",
    "Mairangi Bay",
    "Milford",
    "Murrays Bay",
    "Narrow Neck",
    "Northcote",
    "Northcote Point",
    "Northcross",
    "Okura",
    "Oteha",
    "Paremoremo",
    "Pinehill",
    "Rosedale",
    "Rothesay Bay",
    "Schnapper Rock",
    "Stanley Point",
    "Sunnynook",
    "Takapuna",
    "Torbay",
    "Totara Vale",
    "Unsworth Heights",
    "Waiake",
    "Wairau Valley",
    "Windsor Park",
  ],
  "Auckland City": [
    "Auckland Central",
    "Eden Terrace",
    "Epsom",
    "Freemans Bay",
    "Glendowie",
    "Grafton",
    "Greenlane",
    "Hillsborough",
    "Leigh",
    "Mission Bay",
    "Morningside",
    "Mount Eden",
    "Mount Wellington",
    "Newmarket",
    "Onetangi",
    "Orewa",
    "Palm Beach",
    "Papakura",
    "Rakino Island",
    "Saint Marys Bay",
    "Sandringham",
    "St Johns",
    "Stonefields",
    "Three Kings",
    "Wai O Taiki Bay",
    "Waterview",
    "Westmere",
  ],
  "Waitakere City": [
    "Anawhata",
    "Blockhouse Bay",
    "Cornwallis",
    "Glen Eden",
    "Glendene",
    "Henderson",
    "Hobsonville",
    "Laingholm",
    "Massey",
    "Oratia",
    "Parau",
    "Piha",
    "Sunnyvale",
    "Swanson",
    "Te Atatu Peninsula",
    "Te Atatu South",
    "Titirangi",
    "Waiatarua",
    "West Harbour",
    "Whenuapai",
  ],
  "Manukau City": [
    "Alfriston",
    "Botany Downs",
    "Bucklands Beach",
    "Burswood",
    "Clevedon",
    "Clover Park",
    "Cockle Bay",
    "East Tamaki Heights",
    "Farm Cove",
    "Favona",
    "Golflands",
    "Goodwood Heights",
    "Half Moon Bay",
    "Highland Park",
    "Hillpark",
    "Howick",
    "Huntington Park",
    "Kawakawa Bay",
    "Mangere",
    "Mangere Bridge",
    "Mangere East",
    "Manurewa",
    "Manurewa East",
    "Mellons Bay",
    "Middlemore Hospital",
    "Northpark",
    "Orere Point",
    "Otahuhu",
    "Pahurehure",
    "Pakuranga",
    "Pakuranga Heights",
    "Papatoetoe",
    "Shamrock Park",
    "Somerville",
    "Takanini",
    "Totara Heights",
    "Whitford",
    "Wiri",
  ],
  "Wellington City": [
    "Aro Valley",
    "Broadmeadows",
    "Crofton Downs",
    "Grenada North",
    "Grenada Village",
    "Hataitai",
    "Highbury",
    "Horokiwi",
    "Houghton Bay",
    "Island Bay",
    "Johnsonville",
    "Kelburn",
    "Khandallah",
    "Kingston",
    "Lyall Bay",
    "Maupuia",
    "Miramar",
    "Moa Point",
    "Ngaio",
    "Ngauranga",
    "Northland",
    "Oriental Bay",
    "Owhiro Bay",
    "Rongotai",
    "Strathmore Park",
    "Takapu Valley",
    "Te Aro",
    "Wellington Central",
  ],
  "Lower Hutt City": [
    "Alicetown",
    "Avalon",
    "Belmont",
    "Boulcott",
    "Days Bay",
    "Eastbourne",
    "Epuni",
    "Gracefield",
    "Harbour View",
    "Haywards",
    "Kelson",
    "Lowry Bay",
    "Manor Park",
    "Maungaraki",
    "Naenae",
    "Seaview",
    "Sorrento Bay",
    "Sunshine Bay",
    "Taita",
    "Tirohanga",
    "Wainuiomata",
    "Waiwhetu",
    "Waterloo",
    "Woburn",
    "York Bay",
  ],
  "Upper Hutt City": [
    "Akatarawa",
    "Akatarawa Valley",
    "Birchville",
    "Blue Mountains",
    "Brown Owl",
    "Clouston Park",
    "Craigs Flat",
    "Ebdentown",
    "Elderslea",
    "Heretaunga",
    "Kaitoke",
    "Kingsley Heights",
    "Maidstone",
    "Mangaroa",
    "Maoribank",
    "Maymorn",
    "Moonshine Valley",
    "Pinehaven",
    "Riverstone Terraces",
    "Silverstream",
    "Te Marua",
    "Timberlea",
    "Totara Park",
    "Trentham",
    "Upper Hutt Central",
    "Wallaceville",
    "Whitemans Valley",
  ],
  "Porirua City": [
    "Aotea",
    "Camborne",
    "Elsdon",
    "Judgeford",
    "Paekakariki Hill",
    "Paremata",
    "Pauatahanui",
    "Plimmerton",
    "Porirua City Centre",
    "Pukerua Bay",
    "Waitangirua",
    "Whitby",
  ],
};

/**
 * Get all cities for a specific region
 */
export function getCitiesByRegion(region: Region): string[] {
  return REGION_CITIES[region] || [];
}

/**
 * Get all suburbs for a specific city
 */
export function getSuburbsByCity(city: string): string[] {
  return CITY_SUBURBS[city] || [];
}

/**
 * Find region and city for a given suburb
 * Returns null if suburb is not found
 */
export function findLocationBySuburb(suburb: string): {
  region: Region;
  city: string;
  suburb: string;
} | null {
  const normalizedSuburb = suburb.trim();
  
  for (const region of REGIONS) {
    const cities = REGION_CITIES[region];
    for (const city of cities) {
      const suburbs = CITY_SUBURBS[city] || [];
      const found = suburbs.find(
        s => s.toLowerCase() === normalizedSuburb.toLowerCase()
      );
      if (found) {
        return { region, city, suburb: found };
      }
    }
  }
  
  return null;
}

/**
 * Validate if a suburb belongs to a specific city
 */
export function isSuburbInCity(suburb: string, city: string): boolean {
  const suburbs = CITY_SUBURBS[city] || [];
  return suburbs.some(s => s.toLowerCase() === suburb.toLowerCase());
}

/**
 * Validate if a city belongs to a specific region
 */
export function isCityInRegion(city: string, region: Region): boolean {
  const cities = REGION_CITIES[region] || [];
  return cities.some(c => c.toLowerCase() === city.toLowerCase());
}

/**
 * Get region options for dropdown
 */
export function getRegionOptions(): { value: Region; label: Region }[] {
  return REGIONS.map(region => ({
    value: region,
    label: region,
  }));
}

/**
 * Get city options for dropdown (filtered by region)
 */
export function getCityOptions(region: Region): { value: string; label: string }[] {
  const cities = getCitiesByRegion(region);
  return cities.map(city => ({
    value: city,
    label: city,
  }));
}

/**
 * Get suburb options for dropdown (filtered by city)
 */
export function getSuburbOptions(city: string): { value: string; label: string }[] {
  const suburbs = getSuburbsByCity(city);
  return suburbs.map(suburb => ({
    value: suburb,
    label: suburb,
  }));
}

/**
 * Get all suburbs across all cities (for backward compatibility)
 */
export function getAllSuburbs(): string[] {
  const allSuburbs = new Set<string>();
  Object.values(CITY_SUBURBS).forEach(suburbs => {
    suburbs.forEach(suburb => allSuburbs.add(suburb));
  });
  return Array.from(allSuburbs).sort();
}
