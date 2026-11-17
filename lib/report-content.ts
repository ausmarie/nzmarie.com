import type { ReportEditorContent } from '@/types/report';

function hasText(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasText);
  if (value && typeof value === 'object') {
    const item = value as { text?: unknown; content?: unknown; children?: unknown };
    return hasText(item.text) || hasText(item.content) || hasText(item.children);
  }
  return false;
}

export function trimTrailingEmptyParagraphs(content: ReportEditorContent): ReportEditorContent {
  let end = content.length;
  while (end > 0) {
    const block = content[end - 1];
    if (block.type !== 'paragraph' || hasText(block.content) || block.children?.length) break;
    end--;
  }
  return content.slice(0, end);
}
