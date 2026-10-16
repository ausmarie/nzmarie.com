'use client';

import { useEffect, useRef, useCallback } from 'react';

interface SectionTrackerProps {
  name: string;
  children: React.ReactNode;
}

const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-TWJ57ZFFGD';

export default function SectionTracker({ name, children }: SectionTrackerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const trackedRef = useRef<boolean>(false);

  const getVisitorId = useCallback((): string => {
    try {
      let id = localStorage.getItem('nzm_device_id');
      if (!id) {
        id = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('nzm_device_id', id);
      }
      return id;
    } catch {
      return '';
    }
  }, []);

  const getSuburb = useCallback((): string => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('utm_campaign') || '';
    } catch {
      return '';
    }
  }, []);

  const trackSection = useCallback(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;

    const suburb = getSuburb();
    const visitorId = getVisitorId();

    if (suburb && typeof window !== 'undefined' && navigator.sendBeacon) {
      const payload = JSON.stringify({
        section: name,
        suburb,
        visitorId,
        isNewDevice: !localStorage.getItem('nzm_section_visited'),
      });
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/track-section', blob);
    }

    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'section_view', {
        section_name: name,
        page_path: window.location.pathname,
        suburb: suburb || 'direct',
        ga_tracking_id: GA_TRACKING_ID,
      });
    }

    try {
      localStorage.setItem('nzm_section_visited', 'true');
    } catch {
      // ignore
    }
  }, [name, getSuburb, getVisitorId]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            trackSection();
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [trackSection]);

  return (
    <div ref={ref} data-section={name}>
      {children}
    </div>
  );
}
