'use client';

import { useMemo } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import Header from '@/components/Header';
import type { ReportEditorContent } from '@/types/report';
import type { MarketReportSnapshot } from '@/lib/market-report-data';
import { ensureMarketReportRichTextContent } from '@/lib/market-report-document';
import { createMarketReportSchema } from './market-report-blocks';
import '@blocknote/mantine/style.css';

export interface MarketReportArticleData {
  title: string;
  summary: string;
  content: ReportEditorContent;
  dataSnapshot: MarketReportSnapshot;
  publishedAt?: string | null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Draft preview';
  return new Intl.DateTimeFormat('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function RichText({ content }: { content: ReportEditorContent }) {
  const schema = useMemo(() => createMarketReportSchema(false), []);
  const editor = useCreateBlockNote({
    schema,
    initialContent: content.length > 0 ? content : [{ type: 'paragraph' }],
  });
  return (
    <div className="market-report-richtext">
      <BlockNoteView editor={editor} editable={false} theme="light" />
    </div>
  );
}

export default function MarketReportArticle({
  report,
  preview = false,
}: {
  report: MarketReportArticleData;
  preview?: boolean;
}) {
  const { dataSnapshot: snapshot } = report;
  const content = ensureMarketReportRichTextContent(report.content ?? [], snapshot);
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      {preview && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
          Preview only — this draft is not public.
        </div>
      )}
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
            North Shore Property Market Report
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{report.title}</h1>
          <p className="mt-3 text-slate-600">
            {snapshot.periodLabel} · {formatDate(report.publishedAt)}
          </p>
          {report.summary && (
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-700">{report.summary}</p>
          )}
        </header>

        <article className="rounded-2xl border border-slate-200 bg-white px-4 py-6 shadow-sm sm:px-8">
          <RichText content={content} />
        </article>

        <footer className="border-t border-slate-200 pt-5 text-sm leading-6 text-slate-500">
          <p>Source: {snapshot.source}. Property type: {snapshot.propertyType}.</p>
          <p className="mt-1">{snapshot.dataNotes}</p>
          <p className="mt-2">
            This report is an independent market analysis and is not a formal property valuation or financial advice.
          </p>
        </footer>
      </main>
    </div>
  );
}
