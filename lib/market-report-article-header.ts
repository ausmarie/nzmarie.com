import {
  getMarketReportPeriodLabel,
  type MarketReportLanguage,
  type MarketReportSnapshot,
} from '@/lib/market-report-data';
import type { ReportEditorContent } from '@/types/report';

export type MarketReportArticleIcon = 'delta' | 'none';

export interface MarketReportArticleHeader {
  icon: MarketReportArticleIcon;
  title: string;
  subtitle: string;
  author: string;
  organization: string;
  readingMinutes: number;
  articleMonth: string;
}

interface ContentBlock {
  type?: string;
  props?: Record<string, unknown>;
  content?: unknown;
}

function getSeason(month: number, language: MarketReportLanguage): string {
  const season = month >= 3 && month <= 5
    ? 'Autumn'
    : month >= 6 && month <= 8
      ? 'Winter'
      : month >= 9
        ? 'Spring'
        : 'Summer';
  if (language === 'en') return `${season} Edition`;
  return {
    Autumn: '秋季版',
    Winter: '冬季版',
    Spring: '春季版',
    Summer: '夏季版',
  }[season];
}

function articleMonthInNewZealand(date: Date): string | null {
  const dateParts = new Intl.DateTimeFormat('en-NZ', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'Pacific/Auckland',
  }).formatToParts(date);
  const year = dateParts.find((part) => part.type === 'year')?.value;
  const month = dateParts.find((part) => part.type === 'month')?.value;
  return year && month ? `${year}-${month}` : null;
}

function currentArticleMonth(): string {
  const month = articleMonthInNewZealand(new Date());
  if (!month) throw new Error('Unable to determine the current New Zealand month.');
  return month;
}

export function marketReportArticleMonthForDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? currentArticleMonth()
    : articleMonthInNewZealand(date) ?? currentArticleMonth();
}

export function getDefaultMarketReportArticleHeader(
  snapshot: MarketReportSnapshot,
  language: MarketReportLanguage,
): MarketReportArticleHeader {
  const chinese = language === 'zh';
  const periodLabel = getMarketReportPeriodLabel(snapshot.periodType, snapshot.periodKey, language);
  const season = snapshot.periodType === 'monthly'
    ? getSeason(Number(snapshot.periodKey.slice(5, 7)), language)
    : null;

  return {
    icon: 'delta',
    title: chinese ? '北岸房地产市场报告' : 'North Shore Market Report',
    subtitle: chinese
      ? `${periodLabel}房地产市场更新${season ? `（${season}）` : ''}`
      : `${periodLabel} Housing Market Update${season ? ` (${season})` : ''}`,
    author: 'Marie Nian',
    organization: 'Barfoot & Thompson',
    readingMinutes: 5,
    articleMonth: currentArticleMonth(),
  };
}

export function normalizeMarketReportArticleHeader(
  value: unknown,
  snapshot: MarketReportSnapshot,
  language: MarketReportLanguage,
  fallbackArticleMonth?: string,
): MarketReportArticleHeader {
  const defaults = getDefaultMarketReportArticleHeader(snapshot, language);
  const articleMonth = fallbackArticleMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(fallbackArticleMonth)
    ? fallbackArticleMonth
    : defaults.articleMonth;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...defaults, articleMonth };
  }

  const header = value as Partial<MarketReportArticleHeader>;
  const validArticleMonth = typeof header.articleMonth === 'string'
    && /^\d{4}-(0[1-9]|1[0-2])$/.test(header.articleMonth);
  return {
    icon: header.icon === 'none' ? 'none' : defaults.icon,
    title: typeof header.title === 'string' ? header.title : defaults.title,
    subtitle: typeof header.subtitle === 'string' ? header.subtitle : defaults.subtitle,
    author: typeof header.author === 'string' ? header.author : defaults.author,
    organization: typeof header.organization === 'string' ? header.organization : defaults.organization,
    readingMinutes: typeof header.readingMinutes === 'number'
      && Number.isInteger(header.readingMinutes)
      && header.readingMinutes >= 1
      && header.readingMinutes <= 120
      ? header.readingMinutes
      : defaults.readingMinutes,
    articleMonth: validArticleMonth ? header.articleMonth! : articleMonth,
  };
}

export function parseMarketReportArticleHeader(value: unknown): MarketReportArticleHeader | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const header = value as Record<string, unknown>;
  if (
    (header.icon !== 'delta' && header.icon !== 'none')
    || typeof header.title !== 'string'
    || typeof header.subtitle !== 'string'
    || typeof header.author !== 'string'
    || typeof header.organization !== 'string'
    || typeof header.readingMinutes !== 'number'
    || !Number.isInteger(header.readingMinutes)
    || header.readingMinutes < 1
    || header.readingMinutes > 120
    || typeof header.articleMonth !== 'string'
    || !/^\d{4}-(0[1-9]|1[0-2])$/.test(header.articleMonth)
  ) return null;

  const parsed: MarketReportArticleHeader = {
    icon: header.icon,
    title: header.title.trim(),
    subtitle: header.subtitle.trim(),
    author: header.author.trim(),
    organization: header.organization.trim(),
    readingMinutes: header.readingMinutes,
    articleMonth: header.articleMonth,
  };
  if (
    !parsed.title
    || parsed.title.length > 255
    || parsed.subtitle.length > 500
    || parsed.author.length > 120
    || parsed.organization.length > 160
  ) return null;

  return parsed;
}

function plainText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(plainText).join('');
  if (value && typeof value === 'object') {
    const item = value as { text?: unknown; content?: unknown };
    return `${plainText(item.text)}${plainText(item.content)}`;
  }
  return '';
}

function isHeading(block: ContentBlock | undefined, level: number): boolean {
  return block?.type === 'heading' && Number(block.props?.level) === level;
}

function isLegacyHeaderHeading(block: ContentBlock | undefined): boolean {
  if (block?.type !== 'heading') return false;
  const text = plainText(block.content);
  return (
    /\bNorth Shore (?:Property )?Market Report\b/i.test(text)
    || /北岸.*(?:房地产)?市场报告/.test(text)
    || /\bHousing Market Update\b/i.test(text)
    || /房地产市场更新/.test(text)
  );
}

function isLegacyByline(block: ContentBlock | undefined): boolean {
  if (block?.type !== 'paragraph' && block?.type !== 'quote') return false;
  const text = plainText(block.content);
  return (
    (/\bby\s+/i.test(text) && /\b\d+\s*min(?:ute)?s?\s+read\b/i.test(text))
    || (/(?:作者|撰写|閱讀|阅读|分鐘|分钟)/.test(text) && /\d/.test(text))
  );
}

function hasFollowingLegacyByline(blocks: ContentBlock[], index: number): boolean {
  for (let nextIndex = index + 1; nextIndex < Math.min(blocks.length, index + 5); nextIndex++) {
    const block = blocks[nextIndex];
    if (isLegacyByline(block)) return true;
    if (block?.type === 'paragraph' && !plainText(block.content).trim()) continue;
    return false;
  }
  return false;
}

export function removeLegacyMarketReportArticleHeader(
  content: ReportEditorContent,
  header?: MarketReportArticleHeader,
): ReportEditorContent {
  const blocks = content as unknown as ContentBlock[];
  let firstBodyBlock = 0;
  let removedHeaderContent = false;
  let removedTitleHeading = false;
  while (firstBodyBlock < blocks.length) {
    const block = blocks[firstBodyBlock];
    const headingText = block?.type === 'heading' ? plainText(block.content).trim() : '';
    const matchesConfiguredHeader = Boolean(
      headingText && (headingText === header?.title || headingText === header?.subtitle),
    );
    if (
      (!removedTitleHeading && isHeading(block, 1))
      || (removedTitleHeading
        && isHeading(block, 2)
        && (isLegacyHeaderHeading(block) || matchesConfiguredHeader || hasFollowingLegacyByline(blocks, firstBodyBlock)))
      || isLegacyHeaderHeading(block)
      || isLegacyByline(block)
      || (removedHeaderContent && block?.type === 'paragraph' && !plainText(block.content).trim())
    ) {
      if (!removedTitleHeading && isHeading(block, 1)) removedTitleHeading = true;
      firstBodyBlock++;
      removedHeaderContent = true;
      continue;
    }
    break;
  }

  return firstBodyBlock ? content.slice(firstBodyBlock) : content;
}
