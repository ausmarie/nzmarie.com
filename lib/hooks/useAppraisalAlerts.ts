'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AppraisalAlertItem {
  id: string;
  client_name: string;
  property_address: string;
  suburb?: string;
  region?: string;
  city?: string;
  email: string;
  phone?: string;
  timeline?: string;
  motivation?: string;
  language_preference?: string;
  heard_from?: string;
  created_at: string;
}

export function useAppraisalAlerts() {
  const [items, setItems] = useState<AppraisalAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const prevCountRef = useRef<number | null>(null);
  const [hasNew, setHasNew] = useState(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const lastFetchStartedAtRef = useRef(0);

  const fetchAlerts = useCallback((force = false) => {
    if (inFlightRef.current) return inFlightRef.current;
    if (!force && Date.now() - lastFetchStartedAtRef.current < 5000) return Promise.resolve();

    lastFetchStartedAtRef.current = Date.now();
    const request = (async () => {
      try {
        const res = await fetch('/api/admin/appraisal-alerts');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        const list: AppraisalAlertItem[] = data.data ?? [];
        setItems(list);
        if (prevCountRef.current !== null && list.length > prevCountRef.current) {
          setHasNew(true);
        }
        prevCountRef.current = list.length;
      } catch {
        // leave items as-is on transient errors
      } finally {
        setLoading(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    fetchAlerts();
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void fetchAlerts();
      }
    };
    const interval = setInterval(refreshIfVisible, 120_000);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [fetchAlerts]);

  const convertToLead = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/appraisal-alerts/${id}/convert`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to convert appraisal to lead');
    setItems(prev => prev.filter(item => item.id !== id));
    return res.json();
  }, []);

  const refresh = useCallback(() => fetchAlerts(true), [fetchAlerts]);
  const clearHasNew = useCallback(() => setHasNew(false), []);

  return { items, loading, convertToLead, refresh, hasNew, clearHasNew };
}
