import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BlogArticleFooter from '@/components/blog/BlogArticleFooter';

describe('BlogArticleFooter', () => {
  it('renders the Note calls to action and contact details as links', () => {
    render(<BlogArticleFooter />);

    expect(screen.getByRole('link', { name: 'Request a Free Property Appraisal' }).getAttribute('href'))
      .toBe('https://www.nzmarie.com/#appraisal');
    expect(screen.getByRole('link', { name: 'Download Your Suburb Report' }).getAttribute('href'))
      .toBe('https://www.nzmarie.com/#download-report');
    expect(screen.getByRole('link', { name: 'm.nian@barfoot.co.nz' }).getAttribute('href'))
      .toBe('mailto:m.nian@barfoot.co.nz');
    expect(screen.getByRole('link', { name: '021 0693 089' }).getAttribute('href'))
      .toBe('tel:+64210693089');
  });

  it('uses the default Note when the custom note is blank', () => {
    render(<BlogArticleFooter note="  " />);

    expect(document.querySelector('p.border-l-2')?.textContent)
      .toContain('Market data reflects broad North Shore trends');
  });
});
