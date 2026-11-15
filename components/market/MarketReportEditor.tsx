'use client';

import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import type { ReportEditorContent } from '@/types/report';
import { createMarketReportSchema, type MarketPulseFlushRegistry } from './market-report-blocks';
import '@blocknote/mantine/style.css';

function EditorCanvas({
  content,
  contentRef,
}: {
  content: ReportEditorContent;
  contentRef: MutableRefObject<(() => ReportEditorContent) | null>;
}) {
  const flushRegistry = useRef<MarketPulseFlushRegistry>(new Map());
  const schema = useMemo(() => createMarketReportSchema(true, flushRegistry.current), []);
  const editor = useCreateBlockNote({
    schema,
    initialContent: content.length > 0 ? content : [{ type: 'paragraph' }],
  });

  useEffect(() => {
    contentRef.current = () => {
      flushRegistry.current.forEach((flush) => flush());
      return editor.document as ReportEditorContent;
    };
    return () => {
      contentRef.current = null;
    };
  }, [contentRef, editor]);

  return (
    <div className="min-h-[320px] rounded-xl border border-slate-200 bg-white p-4 text-slate-900">
      <BlockNoteView editor={editor} theme="light" />
    </div>
  );
}

export default function MarketReportEditor({
  reportId,
  content,
  title,
  summary,
  getContentRef,
  onTitleChange,
  onSummaryChange,
}: {
  reportId: string;
  content: ReportEditorContent;
  title: string;
  summary: string;
  getContentRef: MutableRefObject<(() => ReportEditorContent) | null>;
  onTitleChange: (value: string) => void;
  onSummaryChange: (value: string) => void;
}) {
  return (
    <section className="space-y-5">
      <div>
        <label htmlFor="market-report-title" className="mb-1 block text-sm font-medium text-slate-700">Title</label>
        <input
          id="market-report-title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          maxLength={255}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg font-semibold focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>
      <div>
        <label htmlFor="market-report-summary" className="mb-1 block text-sm font-medium text-slate-700">Introduction / summary</label>
        <textarea
          id="market-report-summary"
          value={summary}
          onChange={(event) => onSummaryChange(event.target.value)}
          maxLength={4000}
          rows={3}
          className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-700">Report content</h3>
        <EditorCanvas
          key={reportId}
          content={content}
          contentRef={getContentRef}
        />
      </div>
    </section>
  );
}
