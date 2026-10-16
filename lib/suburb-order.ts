export const SUBURB_PRIORITY_ORDER = [
  'Northcross',
  'Oteha',
  'Torbay',
  'Fairview Heights',
  'Waiake',
  'Browns Bay',
  'Long Bay',
  'Pinehill',
  'Rothesay Bay',
  'Murrays Bay',
  'Albany',
  'Rosedale',
  'Mairangi Bay',
  'Campbells Bay',
  'Sunnynook',
  'Unsworth Heights',
  'Schnapper Rock',
  'Greenhithe',
  'Totara Vale',
  'Castor Bay',
  'Forrest Hill',
  'Bayview',
  'Wairau Valley',
  'Glenfield',
  'Milford',
  'Hillcrest',
  'Birkdale',
  'Beach Haven',
  'Takapuna',
  'Northcote',
  'Birkenhead',
  'Hauraki',
  'Chatswood',
  'Northcote Point',
  'Belmont',
  'Bayswater',
  'Narrow Neck',
  'Devonport',
  'Stanley Point',
] as const;

export function sortSuburbs(suburbs: string[]): string[] {
  return [...suburbs].sort((a, b) => {
    const ai = SUBURB_PRIORITY_ORDER.indexOf(a as (typeof SUBURB_PRIORITY_ORDER)[number]);
    const bi = SUBURB_PRIORITY_ORDER.indexOf(b as (typeof SUBURB_PRIORITY_ORDER)[number]);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}
