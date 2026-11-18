import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Header from '@/components/Header';

const mocks = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: mocks.usePathname,
}));
vi.mock('next/image', () => ({
  default: ({ priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) =>
    React.createElement('img', props),
}));

class MockIntersectionObserver {
  observe() {}
  disconnect() {}
}

describe('public Header Market Reports link', () => {
  beforeEach(() => {
    mocks.usePathname.mockReturnValue('/');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each([
    ['en', 'Free Appraisal', 'Market Reports', '/market-reports?lang=en'],
    ['zh', '免费评估', '北岸市场报告', '/market-reports?lang=zh'],
  ] as const)('links the %s navbar to the correctly localized reports page after appraisal', (language, appraisalLabel, label, href) => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    render(<Header lang={language} />);

    const appraisalLink = screen.getByRole('link', { name: appraisalLabel });
    const reportsLink = screen.getByRole('link', { name: label });
    expect(reportsLink.getAttribute('href')).toBe(href);
    expect(Boolean(appraisalLink.compareDocumentPosition(reportsLink) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it.each([
    ['/market-reports/October-2026', 'en', '中文', '/market-reports/October-2026/cn'],
    ['/market-reports/October-2026/cn', 'zh', 'English', '/market-reports/October-2026'],
    ['/market-reports/Q3-2026', 'en', '中文', '/market-reports/Q3-2026/cn'],
  ] as const)('switches language while staying on the same report from %s', (pathname, language, label, href) => {
    mocks.usePathname.mockReturnValue(pathname);
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    render(<Header lang={language} />);

    const languageLinks = screen.getAllByRole('link', { name: label });
    expect(languageLinks).toHaveLength(2);
    expect(languageLinks.every((link) => link.getAttribute('href') === href)).toBe(true);
  });

  it('marks Market Reports as active on a published report page and uses its direct link', () => {
    mocks.usePathname.mockReturnValue('/market-reports/October-2026');
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    render(<Header lang="en" marketReportsHref="/market-reports/October-2026" />);

    const reportsLink = screen.getByRole('link', { name: 'Market Reports' });
    expect(reportsLink.getAttribute('href')).toBe('/market-reports/October-2026');
    expect(reportsLink.className).toContain('text-blue-600');
  });

  it.each([
    ['en', 'Blog', '/blog'],
    ['zh', '博客', '/blog/cn'],
  ] as const)('links to the localized Blog from desktop and mobile navigation (%s)', (language, label, href) => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    render(<Header lang={language} />);

    const links = screen.getAllByRole('link', { name: label });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe(href);
    const contactLink = screen.getByRole('link', { name: language === 'en' ? 'Contact' : '联系我' });
    const languageLink = screen.getAllByRole('link', { name: language === 'en' ? '中文' : 'English' })[0];
    expect(Boolean(contactLink.compareDocumentPosition(links[0]) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(links[0].compareDocumentPosition(languageLink) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle menu' }));
    const mobileLinks = screen.getAllByRole('link', { name: label });
    expect(mobileLinks).toHaveLength(2);
    expect(mobileLinks.every((link) => link.getAttribute('href') === href)).toBe(true);
  });

  it('uses the translated published article path when switching language from a Blog article', () => {
    mocks.usePathname.mockReturnValue('/blog/selling-your-home');
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    render(<Header lang="en" blogLanguageHref="/blog/卖房指南/cn" />);

    expect(screen.getAllByRole('link', { name: '中文' }).every(
      (link) => link.getAttribute('href') === '/blog/卖房指南/cn',
    )).toBe(true);
  });
});
