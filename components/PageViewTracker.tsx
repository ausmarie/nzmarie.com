'use client';

import { useEffect, useRef } from 'react';
import type { MarketReportLanguage } from '@/lib/market-report-data';

type PageViewTrackerProps =
  | { pageType: 'home'; language: MarketReportLanguage }
  | { pageType: 'market_report' | 'blog_article'; language: MarketReportLanguage; slug: string };

export default function PageViewTracker(props: PageViewTrackerProps) {
  const lastTrackedKey = useRef<string | null>(null);
  const { pageType, language } = props;
  const slug = props.pageType === 'home' ? undefined : props.slug;

  useEffect(() => {
    const key = `${pageType}:${language}:${slug ?? ''}`;
    if (lastTrackedKey.current === key) return;
    lastTrackedKey.current = key;

    const payload = {
      eventId: crypto.randomUUID(),
      pageType,
      language,
      ...(pageType !== 'home' && slug ? { slug } : {}),
    };
    const body = JSON.stringify(payload);
    void fetch('/api/track-page-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).then((response) => {
      if (!response.ok) {
        console.warn(`Page-view tracking returned HTTP ${response.status}.`);
      }
    }).catch((error: unknown) => {
      console.warn('Page-view tracking request failed:', error);
    });
  }, [language, pageType, slug]);

  return null;
}
