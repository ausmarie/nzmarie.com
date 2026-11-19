'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { PageViewAnalytics } from '@/lib/page-view-analytics';

interface PageViewsContextValue {
  analytics: PageViewAnalytics | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

const PageViewsContext = createContext<PageViewsContextValue | null>(null);

export function PageViewsProvider({ children }: PropsWithChildren) {
  const [analytics, setAnalytics] = useState<PageViewAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const response = await fetch('/api/admin/analytics/page-views', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const result = await response.json() as {
          success: boolean;
          data?: PageViewAnalytics;
          error?: string;
        };
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error || 'Failed to load page views.');
        }
        setAnalytics(result.data);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : 'Failed to load page views.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [reloadKey]);

  return (
    <PageViewsContext.Provider value={{ analytics, error, loading, refresh }}>
      {children}
    </PageViewsContext.Provider>
  );
}

export function usePageViews(): PageViewsContextValue {
  const context = useContext(PageViewsContext);
  if (!context) throw new Error('usePageViews must be used within a PageViewsProvider.');
  return context;
}
