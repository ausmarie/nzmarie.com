'use client';

import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import type { ReportEditorContent } from '@/types/report';
import type { MarketReportSnapshot } from '@/lib/market-report-data';
import { ensureMarketReportRichTextContent, ensureMarketReportTitleIcon } from '@/lib/market-report-document';
import { getDefaultMarketReportFooter } from '@/lib/market-report-footer';

const MarketReportRichText = dynamic(() => import('./MarketReportRichText'), {
  ssr: false,
});

export interface MarketReportArticleData {
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
  const content = ensureMarketReportTitleIcon(
    ensureMarketReportRichTextContent(report.content ?? [], snapshot),
  );
  const footer = report.footer ?? getDefaultMarketReportFooter(snapshot);
  return (
    <div className={`${preview ? 'absolute inset-0 overflow-y-auto' : 'min-h-screen'} bg-white text-slate-900`}>
      {!preview && <Header />}
      {preview && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
          Preview only — this draft is not public.
        </div>
      )}
      <main className="market-report-body mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <article className="px-4 py-6 sm:px-8">
          <MarketReportRichText content={content} />
        </article>

        {footer.length > 0 && (
          <footer className="market-report-footer border-t border-slate-200 pt-5 text-sm leading-6 text-slate-500">
            {footer.split(/\r?\n/).map((line, index) => (
              <p key={`${index}-${line}`} className={index > 0 ? 'mt-1' : undefined}>{line || '\u00a0'}</p>
            ))}
          </footer>
        )}
      </main>
    </div>
  );
}
