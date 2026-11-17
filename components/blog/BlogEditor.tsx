'use client';

import { useEffect, type MutableRefObject } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import type { ReportEditorContent } from '@/types/report';
import '@blocknote/mantine/style.css';

export default function BlogEditor({
  postId,
  content,
  contentRef,
  onContentChange,
}: {
  postId: string;
  content: ReportEditorContent;
  contentRef: MutableRefObject<(() => ReportEditorContent) | null>;
  onContentChange: () => void;
}) {
  const editor = useCreateBlockNote({
    initialContent: content.length > 0 ? content : [{ type: 'paragraph' }],
  });

  useEffect(() => {
    contentRef.current = () => editor.document as ReportEditorContent;
    return () => {
      contentRef.current = null;
    };
  }, [contentRef, editor, postId]);

  return (
    <div className="min-h-[320px] rounded-xl border border-slate-200 bg-white p-4 text-slate-900">
      <BlockNoteView editor={editor} theme="light" onChange={onContentChange} />
    </div>
  );
}
