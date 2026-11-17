'use client';

import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import type { ReportEditorContent } from '@/types/report';
import '@blocknote/mantine/style.css';

export default function BlogRichText({ content }: { content: ReportEditorContent }) {
  const editor = useCreateBlockNote({
    initialContent: content.length > 0 ? content : [{ type: 'paragraph' }],
  });

  return (
    <div className="blog-richtext">
      <BlockNoteView editor={editor} editable={false} theme="light" />
    </div>
  );
}
