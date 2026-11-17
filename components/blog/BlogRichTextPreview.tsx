'use client';

import dynamic from 'next/dynamic';
import type { ReportEditorContent } from '@/types/report';

const BlogRichText = dynamic(() => import('@/components/blog/BlogRichText'), {
  ssr: false,
  loading: () => <p role="status" className="text-sm text-slate-500">Loading article content…</p>,
});

export default function BlogRichTextPreview({ content }: { content: ReportEditorContent }) {
  return <BlogRichText content={content} />;
}
