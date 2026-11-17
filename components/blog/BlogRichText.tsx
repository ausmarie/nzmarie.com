'use client';

import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { trimTrailingEmptyParagraphs } from '@/lib/report-content';
import type { ReportEditorContent } from '@/types/report';
import '@blocknote/mantine/style.css';

export default function BlogRichText({ content }: { content: ReportEditorContent }) {
  const contentWithoutTrailingEmptyParagraphs = trimTrailingEmptyParagraphs(content);
  const editor = useCreateBlockNote({
    initialContent: contentWithoutTrailingEmptyParagraphs.length > 0
      ? contentWithoutTrailingEmptyParagraphs
      : [{ type: 'paragraph' }],
  });

  return (
    <div className="blog-richtext">
      <BlockNoteView editor={editor} editable={false} theme="light" />
    </div>
  );
}
