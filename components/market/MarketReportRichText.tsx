'use client';

import { useMemo } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import type { ReportEditorContent } from '@/types/report';
import { createMarketReportSchema } from './market-report-blocks';
import '@blocknote/mantine/style.css';

export default function MarketReportRichText({
  content,
}: {
  content: ReportEditorContent;
}) {
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
