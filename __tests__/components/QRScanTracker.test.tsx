import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import QRScanTracker from '../../components/QRScanTracker';

describe('QRScanTracker Component', () => {
  const originalLocation = window.location;
  const originalSendBeacon = navigator.sendBeacon;

  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'nzm_device_id=; Max-Age=0; path=/;';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
    navigator.sendBeacon = originalSendBeacon;
  });

  it('generates a persistent device ID in localStorage and sends beacon', async () => {
    const sendBeaconMock = vi.fn().mockReturnValue(true);
    navigator.sendBeacon = sendBeaconMock;

    delete (window as any).location;
    (window as any).location = new URL('https://www.nzmarie.com/?utm_source=qr&utm_campaign=long-bay');

    render(<QRScanTracker />);

    await waitFor(() => {
      expect(localStorage.getItem('nzm_device_id')).toBeTruthy();
      expect(sendBeaconMock).toHaveBeenCalled();
    });

    const storedDeviceId = localStorage.getItem('nzm_device_id');
    const beaconCall = sendBeaconMock.mock.calls[0];
    expect(beaconCall[0]).toBe('/api/track-scan');

    const blob = beaconCall[1] as Blob;
    const text = await blob.text();
    const payload = JSON.parse(text);
    expect(payload.suburb).toBe('long-bay');
    expect(payload.visitorId).toBe(storedDeviceId);
  });

  it('reuses existing device ID from localStorage on subsequent scans of another suburb', async () => {
    localStorage.setItem('nzm_device_id', 'existing-uuid-999');

    const sendBeaconMock = vi.fn().mockReturnValue(true);
    navigator.sendBeacon = sendBeaconMock;

    delete (window as any).location;
    (window as any).location = new URL('https://www.nzmarie.com/?utm_source=qr&utm_campaign=browns-bay');

    render(<QRScanTracker />);

    await waitFor(() => {
      expect(sendBeaconMock).toHaveBeenCalled();
    });

    const beaconCall = sendBeaconMock.mock.calls[0];
    const blob = beaconCall[1] as Blob;
    const text = await blob.text();
    const payload = JSON.parse(text);

    expect(payload.suburb).toBe('browns-bay');
    expect(payload.visitorId).toBe('existing-uuid-999');
    expect(localStorage.getItem('nzm_device_id')).toBe('existing-uuid-999');
  });

  it('does not send beacon if utm_campaign is missing', async () => {
    const sendBeaconMock = vi.fn().mockReturnValue(true);
    navigator.sendBeacon = sendBeaconMock;

    delete (window as any).location;
    (window as any).location = new URL('https://www.nzmarie.com/');

    render(<QRScanTracker />);

    await new Promise((r) => setTimeout(r, 50));
    expect(sendBeaconMock).not.toHaveBeenCalled();
  });
});
