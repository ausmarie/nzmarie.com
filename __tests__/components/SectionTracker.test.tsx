import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import SectionTracker from '../../components/SectionTracker';

describe('SectionTracker Component', () => {
  const originalSendBeacon = navigator.sendBeacon;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();

    window.IntersectionObserver = vi.fn((cb) => {
      (window as any).__sectionObserverCallback = cb;
      return {
        observe: vi.fn(),
        disconnect: vi.fn(),
        unobserve: vi.fn(),
        root: null,
        rootMargin: '',
        thresholds: [],
        takeRecords: vi.fn().mockReturnValue([]),
      };
    }) as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    navigator.sendBeacon = originalSendBeacon;
    delete (window as any).__sectionObserverCallback;
  });

  it('renders children correctly', () => {
    const { getByText } = render(
      <SectionTracker name="hero">
        <div>Hero Content</div>
      </SectionTracker>
    );
    expect(getByText('Hero Content')).toBeTruthy();
  });

  it('adds data-section attribute to wrapper', () => {
    const { container } = render(
      <SectionTracker name="about">
        <div>About</div>
      </SectionTracker>
    );
    const wrapper = container.querySelector('[data-section="about"]');
    expect(wrapper).toBeTruthy();
  });

  it('creates IntersectionObserver with threshold 0.5', () => {
    render(
      <SectionTracker name="services">
        <div>Services</div>
      </SectionTracker>
    );

    expect(window.IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      { threshold: 0.5 }
    );
  });

  it('sends gtag event when section enters viewport', async () => {
    const gtagMock = vi.fn();
    (window as any).gtag = gtagMock;

    delete (window as any).location;
    (window as any).location = new URL('https://www.nzmarie.com/?utm_campaign=albany');

    render(
      <SectionTracker name="property_listings">
        <div>Listings</div>
      </SectionTracker>
    );

    const callback = (window as any).__sectionObserverCallback;
    expect(callback).toBeDefined();

    callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );

    await waitFor(() => {
      expect(gtagMock).toHaveBeenCalledWith(
        'event',
        'section_view',
        expect.objectContaining({
          section_name: 'property_listings',
          suburb: 'albany',
        })
      );
    });
  });

  it('does not send duplicate events for same section', async () => {
    const gtagMock = vi.fn();
    (window as any).gtag = gtagMock;

    delete (window as any).location;
    (window as any).location = new URL('https://www.nzmarie.com/');

    render(
      <SectionTracker name="contact">
        <div>Contact</div>
      </SectionTracker>
    );

    const callback = (window as any).__sectionObserverCallback;

    callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );

    callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );

    await waitFor(() => {
      const sectionViewCalls = gtagMock.mock.calls.filter(
        (call: unknown[]) => call[0] === 'event' && call[1] === 'section_view'
      );
      expect(sectionViewCalls).toHaveLength(1);
    });
  });

  it('sends beacon with section data for QR scan users', async () => {
    const sendBeaconMock = vi.fn().mockReturnValue(true);
    navigator.sendBeacon = sendBeaconMock;

    const gtagMock = vi.fn();
    (window as any).gtag = gtagMock;

    delete (window as any).location;
    (window as any).location = new URL('https://www.nzmarie.com/?utm_source=qr&utm_campaign=oteha');

    render(
      <SectionTracker name="hero">
        <div>Hero</div>
      </SectionTracker>
    );

    const callback = (window as any).__sectionObserverCallback;

    callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );

    await waitFor(() => {
      expect(sendBeaconMock).toHaveBeenCalledWith(
        '/api/track-section',
        expect.any(Blob)
      );
    });
  });

  it('does not send beacon for direct access users', async () => {
    const sendBeaconMock = vi.fn().mockReturnValue(true);
    navigator.sendBeacon = sendBeaconMock;

    const gtagMock = vi.fn();
    (window as any).gtag = gtagMock;

    delete (window as any).location;
    (window as any).location = new URL('https://www.nzmarie.com/');

    render(
      <SectionTracker name="hero">
        <div>Hero</div>
      </SectionTracker>
    );

    const callback = (window as any).__sectionObserverCallback;

    callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );

    await waitFor(() => {
      expect(sendBeaconMock).not.toHaveBeenCalled();
      expect(gtagMock).toHaveBeenCalled();
    });
  });

  it('cleans up observer on unmount', () => {
    const disconnectMock = vi.fn();

    window.IntersectionObserver = vi.fn(() => ({
      observe: vi.fn(),
      disconnect: disconnectMock,
      unobserve: vi.fn(),
      root: null,
      rootMargin: '',
      thresholds: [],
      takeRecords: vi.fn().mockReturnValue([]),
    })) as unknown as typeof IntersectionObserver;

    const { unmount } = render(
      <SectionTracker name="hero">
        <div>Hero</div>
      </SectionTracker>
    );

    unmount();
    expect(disconnectMock).toHaveBeenCalled();
  });

  it('creates device ID in localStorage', async () => {
    const sendBeaconMock = vi.fn().mockReturnValue(true);
    navigator.sendBeacon = sendBeaconMock;

    (window as any).gtag = vi.fn();

    delete (window as any).location;
    (window as any).location = new URL('https://www.nzmarie.com/?utm_source=qr&utm_campaign=takapuna');

    render(
      <SectionTracker name="about">
        <div>About</div>
      </SectionTracker>
    );

    const callback = (window as any).__sectionObserverCallback;

    callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );

    await waitFor(() => {
      expect(localStorage.getItem('nzm_device_id')).toBeTruthy();
    });
  });
});
