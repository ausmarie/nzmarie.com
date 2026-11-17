import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BlogRichTextPreview from '@/components/blog/BlogRichTextPreview';

describe('BlogRichTextPreview', () => {
  it('does not render the browser-only BlockNote editor on the server', () => {
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

    try {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: undefined });
      const markup = renderToStaticMarkup(<BlogRichTextPreview content={[]} />);
      expect(markup).toContain('Loading article content');
    } finally {
      if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
    }
  });
});
