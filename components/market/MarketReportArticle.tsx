import Header from '@/components/Header';
import type { ReportEditorContent } from '@/types/report';
import type { MarketReportLanguage, MarketReportSnapshot } from '@/lib/market-report-data';
import {
  normalizeMarketReportArticleHeader,
  marketReportArticleMonthForDate,
  removeLegacyMarketReportArticleHeader,
} from '@/lib/market-report-article-header';
import { ensureMarketReportRichTextContent } from '@/lib/market-report-document';
import { marketReportUrl } from '@/lib/market-report-url';
import { buildMarketReportArticleStructuredData } from '@/lib/market-report-seo';
import BlogArticleFooter from '@/components/blog/BlogArticleFooter';
import MarketReportStaticContent from './MarketReportStaticContent';
import MarketReportArticleHeader from './MarketReportArticleHeader';

export interface MarketReportArticleData {
  language?: MarketReportLanguage;
  articleHeader?: unknown;
  footer?: string | null;
  publishedAt?: string | Date | null;
  content: ReportEditorContent;
  dataSnapshot: MarketReportSnapshot;
}

export default function MarketReportArticle({
  report,
  preview = false,
}: {
  report: MarketReportArticleData;
  preview?: boolean;
}) {
  const { dataSnapshot: snapshot } = report;
  const language = report.language ?? 'en';
  const articleHeader = normalizeMarketReportArticleHeader(
    report.articleHeader,
    snapshot,
    language,
    report.publishedAt ? marketReportArticleMonthForDate(report.publishedAt) : undefined,
  );
  const content = removeLegacyMarketReportArticleHeader(
    ensureMarketReportRichTextContent(report.content ?? [], snapshot, language),
    articleHeader,
  );
  const structuredData = !preview
    ? buildMarketReportArticleStructuredData({
        period_type: snapshot.periodType,
        period_key: snapshot.periodKey,
        language,
        published_at: report.publishedAt,
        published_data_snapshot: { metrics: snapshot.metrics },
      }, language)
    : null;
  const marketReportsHref = marketReportUrl({
    period_type: snapshot.periodType,
    period_key: snapshot.periodKey,
    status: 'published',
    language,
  });
  return (
    <div className={`${preview ? 'absolute inset-0 overflow-y-auto' : 'min-h-screen'} bg-white text-slate-900`}>
      {!preview && <Header lang={language} marketReportsHref={marketReportsHref} />}
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
        />
      )}
      {preview && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
          {language === 'zh' ? '仅供预览 — 此草稿尚未公开。' : 'Preview only — this draft is not public.'}
        </div>
      )}
      <main className="market-report-body mx-auto max-w-6xl space-y-8 px-4 pt-10 pb-4 sm:px-6 lg:px-8">
        <article className="px-4 pt-6 pb-3 sm:px-8">
          <MarketReportArticleHeader header={articleHeader} language={language} />
          <MarketReportStaticContent content={content} snapshot={snapshot} language={language} />
        </article>
      </main>

      <div className="market-report-footer mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-8">
          <BlogArticleFooter language={language === 'zh' ? 'cn' : 'en'} />
        </div>
      </div>
    </div>
  );
}
