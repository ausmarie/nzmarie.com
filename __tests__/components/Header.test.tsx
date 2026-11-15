import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
});
