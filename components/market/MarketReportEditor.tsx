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
  onContentChange,
}: {
  content: ReportEditorContent;
  contentRef: MutableRefObject<(() => ReportEditorContent) | null>;
  onContentChange: () => void;
}) {
  const flushRegistry = useRef<MarketPulseFlushRegistry>(new Map());
  const schema = useMemo(
    () => createMarketReportSchema(true, flushRegistry.current, onContentChange),
    [onContentChange],
  );
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
      <BlockNoteView editor={editor} theme="light" onChange={onContentChange} />
    </div>
  );
}

export default function MarketReportEditor({
  reportId,
  content,
  getContentRef,
  onContentChange,
}: {
  reportId: string;
  content: ReportEditorContent;
  getContentRef: MutableRefObject<(() => ReportEditorContent) | null>;
  onContentChange: () => void;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-700">Report content</h3>
        <EditorCanvas
          key={reportId}
          content={content}
          contentRef={getContentRef}
          onContentChange={onContentChange}
        />
      </div>
    </section>
  );
}
