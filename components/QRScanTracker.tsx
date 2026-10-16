'use client';

import { useEffect } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

export default function QRScanTracker() {
  useEffect(() => {
    let cancelled = false;

    async function track() {
      if (typeof window === 'undefined' || !('sendBeacon' in navigator)) return;

      const params = new URLSearchParams(window.location.search);
      const suburb = params.get('utm_campaign');
      if (!suburb) return;

      const ua = navigator.userAgent || '';
      let visitorId = '';

      // 1. Primary: Persistent Device ID from localStorage
      try {
        visitorId = localStorage.getItem('nzm_device_id') || '';
        if (!visitorId) {
          visitorId = typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2) + Date.now().toString(36);
          localStorage.setItem('nzm_device_id', visitorId);
        }
      } catch {
        // localStorage might be blocked in private mode
      }

      // 2. Secondary: Cookie fallback
      if (!visitorId && typeof document !== 'undefined') {
        try {
          const match = document.cookie.match(/(?:^|; )nzm_device_id=([^;]*)/);
          if (match && match[1]) {
            visitorId = decodeURIComponent(match[1]);
          } else {
            visitorId = Math.random().toString(36).substring(2) + Date.now().toString(36);
            document.cookie = `nzm_device_id=${encodeURIComponent(visitorId)}; path=/; max-age=31536000; SameSite=Lax`;
          }
        } catch {
          // ignore
        }
      }

      // 3. Fallback: FingerprintJS
      if (!visitorId) {
        try {
          const fp = await FingerprintJS.load();
          const result = await fp.get();
          visitorId = result.visitorId;
        } catch {
          visitorId = '';
        }
      }

      if (cancelled) return;

      const payload = JSON.stringify({ suburb, visitorId, ua });
      const endpoint = '/api/track-scan';
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
      } else {
        fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
      }
    }

    track();
    return () => { cancelled = true; };
  }, []);

  return null;
}
