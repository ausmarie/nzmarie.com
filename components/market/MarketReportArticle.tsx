import Header from '@/components/Header';
import type { ReportEditorContent } from '@/types/report';
import type { MarketReportLanguage, MarketReportSnapshot } from '@/lib/market-report-data';
import { ensureMarketReportRichTextContent, ensureMarketReportTitleIcon } from '@/lib/market-report-document';
import { getDefaultMarketReportFooter } from '@/lib/market-report-footer';
import { marketReportUrl } from '@/lib/market-report-url';
import MarketReportStaticContent from './MarketReportStaticContent';

export interface MarketReportArticleData {
  language?: MarketReportLanguage;
  footer?: string | null;
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
  const content = ensureMarketReportTitleIcon(
    ensureMarketReportRichTextContent(report.content ?? [], snapshot, language),
  );
  const footer = report.footer ?? getDefaultMarketReportFooter(snapshot, language);
  const marketReportsHref = marketReportUrl({
    period_type: snapshot.periodType,
    period_key: snapshot.periodKey,
    status: 'published',
    language,
  });
  return (
    <div className={`${preview ? 'absolute inset-0 overflow-y-auto' : 'min-h-screen'} bg-white text-slate-900`}>
      {!preview && <Header lang={language} marketReportsHref={marketReportsHref} />}
      {preview && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
          {language === 'zh' ? '仅供预览 — 此草稿尚未公开。' : 'Preview only — this draft is not public.'}
        </div>
      )}
      <main className="market-report-body mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <article className="px-4 py-6 sm:px-8">
          <MarketReportStaticContent content={content} snapshot={snapshot} language={language} />
        </article>
      </main>

      {footer.length > 0 && (
        <footer className="market-report-footer border-t border-slate-200">
          <div className="mx-auto max-w-6xl px-4 py-5 text-sm leading-6 text-slate-500 sm:px-6 lg:px-8">
            <div className="px-4 sm:px-8">
              {footer.split(/\r?\n/).map((line, index) => (
                <p key={`${index}-${line}`} className={index > 0 ? 'mt-1' : undefined}>{line || '\u00a0'}</p>
              ))}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
