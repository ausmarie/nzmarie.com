import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import BlogArticleFooter from '@/components/blog/BlogArticleFooter';

describe('BlogArticleFooter', () => {
  afterEach(cleanup);

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

  it('renders the Chinese Note, footer text, and localized links', () => {
    render(<BlogArticleFooter language="cn" />);

    const note = document.querySelector('p.border-l-2');
    expect(note?.textContent).toContain('说明：');
    expect(note?.textContent).toContain('北岸市场数据反映整体趋势。');
    expect(screen.getByRole('link', { name: '预约免费房产评估' }).getAttribute('href'))
      .toBe('https://www.nzmarie.com/cn#appraisal');
    expect(screen.getByRole('link', { name: '下载专属子区报告' }).getAttribute('href'))
      .toBe('https://www.nzmarie.com/cn#download-report');
    expect(screen.getByRole('link', { name: 'm.nian@barfoot.co.nz' }).getAttribute('href'))
      .toBe('mailto:m.nian@barfoot.co.nz');
    expect(screen.getByRole('link', { name: '021 0693 089' }).getAttribute('href'))
      .toBe('tel:+64210693089');
    expect(document.querySelector('footer')?.textContent)
      .toContain('本出版物为独立编辑内容，仅供一般参考。');
    expect(document.querySelector('footer')?.textContent)
      .toContain('持牌住宅销售顾问，Barfoot & Thompson');
  });
});
