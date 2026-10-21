import { COMPARABLE_SUMMARY_DEFAULTS } from './comparable-cards';

export interface LeadIntroductionProperty {
  address: string;
  suburb?: string | null;
  city?: string | null;
  region?: string | null;
  bedrooms?: string | number | null;
  bathrooms?: string | number | null;
  car_spaces?: string | number | null;
  floor_size?: string | number | null;
  land_area?: string | number | null;
  land_area_numeric?: string | number | null;
  property_type?: string | null;
  year_built?: string | number | null;
  capital_value?: string | number | null;
  land_value?: string | number | null;
  improvement_value?: string | number | null;
  estimated_value_low?: string | number | null;
  estimated_value_high?: string | number | null;
  last_sold_price?: string | number | null;
  last_sold_date?: string | Date | null;
  has_rental_history?: boolean | null;
  is_currently_rented?: boolean | null;
  description?: string | null;
  property_history?: string | null;
}

export interface LeadIntroductionHistoryEntry {
  date: string;
  event: string;
  price: string;
}

interface PropertyStat {
  value: string;
  label: string;
  icon: string;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const ICONS = [
  '<path d="M3 19v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7"/><path d="M3 16h18"/><path d="M6 10V7h6v3"/>',
  '<path d="M4 11h16v4a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M7 11V6a2 2 0 0 1 4 0"/><path d="M5 19l-1 2M19 19l1 2"/>',
  '<path d="M4 16l1.6-5.2A2 2 0 0 1 7.5 9h9a2 2 0 0 1 1.9 1.8L20 16"/><path d="M3 16h18v3H3z"/><circle cx="7" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  '<rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
  '<path d="M12 3l5 7h-3l4 5H6l4-5H7z"/><path d="M12 15v6"/>',
];

function cleanText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  return text === '-' ? '' : text;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function numericValue(value: string | number | null | undefined): number | null {
  const text = cleanText(value);
  if (!text) return null;
  const number = Number(text.replace(/[, ]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-NZ', { maximumFractionDigits: 0 }).format(value);
}

export function formatLeadIntroductionMoney(value: string | number | null | undefined): string {
  const number = numericValue(value);
  if (number === null) return '';
  return `$${formatNumber(number)}`;
}

function formatArea(value: string | number | null | undefined): string {
  const text = cleanText(value);
  if (!text) return '- m²';
  const number = numericValue(text);
  if (number !== null) {
    if (number <= 0) return '- m²';
    return `${formatNumber(number)} m²`;
  }
  return `${text} m²`;
}

function parseDmyDate(value: string): Date | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseAnyDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  if (!text) return null;
  const dmy = parseDmyDate(text);
  if (dmy) return dmy;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatLeadIntroductionDate(value: string | Date | null | undefined): string {
  const date = parseAnyDate(value);
  if (!date) return cleanText(value as string | number | null | undefined);
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function formatHistoryEvent(value: string): string {
  const text = value.trim();
  if (!text) return '';
  if (text.toUpperCase() === 'SOLD') return 'Sold';
  if (text.toUpperCase() === 'RV') return 'RV';
  if (text.toLowerCase() === 'listed') return 'Listed';
  if (text.toLowerCase() === 'rented') return 'Rented';
  if (text.toLowerCase() === 'built') return 'Built';
  return text;
}

export function parseLeadIntroductionHistory(raw: string | null | undefined): LeadIntroductionHistoryEntry[] {
  if (!raw || !raw.trim()) return [];
  let records: unknown = null;
  try {
    records = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(records)) return [];

  return records
    .map((record) => {
      if (!record || typeof record !== 'object') return null;
      const row = record as Record<string, unknown>;
      const date = cleanText(row.date as string | number | null | undefined);
      if (!date) return null;
      return {
        date,
        event: formatHistoryEvent(cleanText(row.type as string | number | null | undefined)),
        price: cleanText(row.price as string | number | null | undefined) || '-',
      };
    })
    .filter((record): record is LeadIntroductionHistoryEntry => record !== null)
    .sort((a, b) => {
      const aTime = parseAnyDate(a.date)?.getTime() ?? 0;
      const bTime = parseAnyDate(b.date)?.getTime() ?? 0;
      return bTime - aTime;
    });
}

function buildStats(property: LeadIntroductionProperty): PropertyStat[] {
  const landValue = property.land_area_numeric ?? property.land_area;
  return [
    { value: cleanText(property.bedrooms) || '-', label: 'Beds', icon: ICONS[0] },
    { value: cleanText(property.bathrooms) || '-', label: 'Baths', icon: ICONS[1] },
    { value: cleanText(property.car_spaces) || '-', label: 'Cars', icon: ICONS[2] },
    { value: formatArea(property.floor_size), label: 'Floor', icon: ICONS[3] },
    { value: formatArea(landValue), label: 'Land', icon: ICONS[4] },
  ];
}

export function renderLeadIntroductionStatsSvg(property: LeadIntroductionProperty): string {
  const stats = buildStats(property);
  const cellWidth = 180;
  const width = cellWidth * stats.length;
  const cells = stats.map((stat, index) => {
    const center = index * cellWidth + cellWidth / 2;
    const transform = `translate(${index * cellWidth + cellWidth / 2 - 15}, 22)`;
    return `
      <g>
        <g transform="${transform}" fill="none" stroke="#1e40af" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${stat.icon}</g>
        <text x="${center}" y="86" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="700" fill="#0f172a">${escapeXml(stat.value)}</text>
        <text x="${center}" y="108" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" letter-spacing="0.6" fill="#64748b">${escapeXml(stat.label.toUpperCase())}</text>
      </g>`;
  }).join('');

  const dividers = stats.slice(1).map((_, index) => {
    const x = (index + 1) * cellWidth;
    return `<line x1="${x}" y1="20" x2="${x}" y2="114" stroke="#e2e8f0" stroke-width="1"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="132" viewBox="0 0 ${width} 132">
    <rect x="0.5" y="0.5" width="${width - 1}" height="131" rx="14" fill="#f8fafc" stroke="#e2e8f0"/>
    ${dividers}
    ${cells}
  </svg>`;
}

export function leadIntroductionStatsUrl(property: LeadIntroductionProperty): string {
  return `data:image/svg+xml;base64,${Buffer.from(renderLeadIntroductionStatsSvg(property), 'utf8').toString('base64')}`;
}

function textRow(label: string, value: string): { cells: string[][] } {
  return { cells: [[label], [value]] };
}

function locationText(property: LeadIntroductionProperty): string {
  return [property.suburb, property.city, property.region]
    .map((part) => cleanText(part))
    .filter(Boolean)
    .filter((part, index, all) => all.findIndex((value) => value.toLowerCase() === part.toLowerCase()) === index)
    .join(', ');
}

function buildPropertyInfoRows(property: LeadIntroductionProperty): { cells: string[][] }[] {
  const rows: { cells: string[][] }[] = [];
  const location = locationText(property);
  if (location) rows.push(textRow('Location', location));
  if (cleanText(property.property_type)) rows.push(textRow('Property type', cleanText(property.property_type)));
  if (cleanText(property.year_built)) rows.push(textRow('Year built', cleanText(property.year_built)));
  if (formatLeadIntroductionMoney(property.capital_value)) rows.push(textRow('Capital value', formatLeadIntroductionMoney(property.capital_value)));
  if (formatLeadIntroductionMoney(property.land_value)) rows.push(textRow('Land value', formatLeadIntroductionMoney(property.land_value)));
  if (formatLeadIntroductionMoney(property.improvement_value)) rows.push(textRow('Improvements', formatLeadIntroductionMoney(property.improvement_value)));

  const estimateLow = formatLeadIntroductionMoney(property.estimated_value_low);
  const estimateHigh = formatLeadIntroductionMoney(property.estimated_value_high);
  if (estimateLow && estimateHigh) {
    rows.push(textRow('Estimated value', `${estimateLow} – ${estimateHigh}`));
  } else if (estimateLow || estimateHigh) {
    rows.push(textRow('Estimated value', estimateLow || estimateHigh));
  }

  const lastSoldPrice = formatLeadIntroductionMoney(property.last_sold_price);
  const lastSoldDate = formatLeadIntroductionDate(property.last_sold_date);
  if (lastSoldPrice || lastSoldDate) {
    rows.push(textRow('Last sold', [lastSoldDate, lastSoldPrice].filter(Boolean).join(' for ')));
  }
  if (property.has_rental_history) rows.push(textRow('Rental history', 'Yes'));
  if (property.is_currently_rented) rows.push(textRow('Currently rented', 'Yes'));
  return rows;
}

export function buildLeadIntroductionTitle(address: string): string {
  return `${address.trim()} Introduction`;
}

export function buildLeadIntroductionBlocks(property: LeadIntroductionProperty): unknown[] {
  const address = property.address.trim();
  const blocks: unknown[] = [
    { type: 'heading', props: { level: 1 }, content: [address] },
    {
      type: 'image',
      props: {
        url: leadIntroductionStatsUrl(property),
        caption: '',
        name: 'Property summary',
        showPreview: true,
        previewWidth: 820,
        textAlignment: 'left',
        backgroundColor: 'default',
      },
    },
    { type: 'heading', props: { level: 2 }, content: ['Property Information'] },
  ];

  const infoRows = buildPropertyInfoRows(property);
  if (infoRows.length > 0) {
    blocks.push({
      type: 'table',
      props: { width: 1 },
      content: { type: 'tableContent', rows: infoRows, headerRows: 0, columnWidths: [] },
    });
  } else {
    blocks.push({ type: 'paragraph', content: ['No additional property details are available.'] });
  }

  blocks.push({ type: 'heading', props: { level: 2 }, content: ['Description'] });
  const descriptionParagraphs = (property.description || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (descriptionParagraphs.length > 0) {
    for (const paragraph of descriptionParagraphs) {
      blocks.push({ type: 'paragraph', content: [paragraph] });
    }
  } else {
    blocks.push({ type: 'paragraph', content: ['No description is available for this property.'] });
  }

  blocks.push({ type: 'heading', props: { level: 2 }, content: ['Comparable Sales'] });
  blocks.push({ type: 'comparableSummary', props: { ...COMPARABLE_SUMMARY_DEFAULTS } });

  blocks.push({ type: 'heading', props: { level: 2 }, content: ['Address History'] });
  const history = parseLeadIntroductionHistory(property.property_history);
  if (history.length > 0) {
    const rows = [
      { cells: [['Date'], ['Event'], ['Price']] },
      ...history.map((entry) => ({
        cells: [[formatLeadIntroductionDate(entry.date)], [entry.event || '-'], [entry.price]],
      })),
    ];
    blocks.push({
      type: 'table',
      props: { width: 1 },
      content: { type: 'tableContent', rows, headerRows: 1, columnWidths: [] },
    });
    blocks.push({ type: 'paragraph', content: ['Source: homes.co.nz.'] });
  } else {
    blocks.push({ type: 'paragraph', content: ['No address history is available for this property.'] });
  }

  return blocks;
}
