import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@vis.gl/react-google-maps', () => {
  const LatLngBounds = class {
    extend() {
      return this;
    }
  };
  const mockMap = {
    fitBounds: vi.fn(),
    setZoom: vi.fn(),
    setCenter: vi.fn(),
    getCenter: vi.fn(() => ({ lat: -36.69, lng: 174.74 })),
    getZoom: vi.fn(() => 14),
    addListener: vi.fn(() => () => {}),
    setMap: vi.fn(),
  };
  return {
    APIProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Map: ({ children }: { children: React.ReactNode }) => <div data-testid="map-canvas">{children}</div>,
    useMap: () => mockMap,
    useMapsLibrary: () => null,
    LatLngBounds,
  };
});

vi.mock('@googlemaps/markerclusterer', () => {
  return {
    MarkerClusterer: class {
      constructor() {}
      setMap() {}
    },
  };
});

import OutreachMapView, {
  applyOptimisticAddressStatuses,
  applyOptimisticSentIds,
  buildAddressInfoWindowContent,
} from '../../app/admin/outreach/components/OutreachMapView';

const mockFitBounds = vi.fn();

function coordsPayload(runs: Array<{ runId: number; totalPending: number }>) {
  return {
    success: true,
    suburb: 'Torbay',
    groups: [
      {
        suburb: 'Torbay',
        streets: [
          {
            street: 'Glamorgan Drive',
            suburb: 'Torbay',
            anchorLat: -36.69,
            anchorLng: 174.74,
            pendingCount: 12,
            runId: 1,
            addressCoords: [
              { id: 'out-1', address: '1 Glamorgan Drive', lat: -36.69, lng: 174.74, sent: false, status: 'unsent' as 'unsent' | 'sent' | 'junk' },
            ],
          },
        ],
      },
    ],
    runs,
    unclusteredStreets: [],
    budget: 20,
    radius: 500,
    startStreet: 'Glamorgan Drive',
    allStreets: [{ street: 'Glamorgan Drive', count: 12 }],
  };
}

function installMockMap() {
  const map = {
    fitBounds: mockFitBounds,
    setZoom: vi.fn(),
    setCenter: vi.fn(),
    getCenter: vi.fn(() => ({ lat: -36.69, lng: 174.74 })),
    getZoom: vi.fn(() => 12),
    addListener: vi.fn(() => () => {}),
    setMap: vi.fn(),
  };
  const MarkerMock = class {
    map: unknown = null;
    position: unknown;
    title = '';
    zIndex = 0;
    icon: unknown = null;
    listeners: Record<string, () => void> = {};
    constructor(opts: { map?: unknown; position?: unknown; icon?: unknown; title?: string; zIndex?: number }) {
      this.map = opts.map ?? null;
      this.position = opts.position;
      this.title = opts.title ?? '';
      this.zIndex = opts.zIndex ?? 0;
      this.icon = opts.icon ?? null;
    }
    addListener(name: string, fn: () => void) {
      this.listeners[name] = fn;
      return { remove: () => {} };
    }
    setMap(map: unknown) {
      this.map = map;
    }
  };
  (globalThis.google as any) = {
    maps: {
      LatLngBounds: class {
        extend() {
          return this;
        }
      },
      LatLng: class {},
      SymbolPath: { CIRCLE: 'CIRCLE' },
      Marker: MarkerMock,
      InfoWindow: class {
        constructor() {}
        setContent() {}
        setPosition() {}
        open() {}
        close() {}
      },
      Circle: class {
        constructor() {}
        setMap() {}
      },
      event: { removeListener: vi.fn(), addListenerOnce: vi.fn(), trigger: vi.fn() },
    },
  };
  return map;
}

beforeEach(() => {
  mockFitBounds.mockReset();
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-gmaps-key';
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID = 'test-map-id';
  (globalThis.google as any) = undefined;
  global.fetch = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('OutreachMapView', () => {
  it('shows a placeholder when no suburb is selected', () => {
    render(
      <OutreachMapView
        suburb=""
        activeRunId={null}
        sentStatus="unsent"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );
    expect(screen.getByText('Select a report to view the delivery map.')).toBeTruthy();
  });

  it('shows unavailable message when the API key is missing', () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={null}
        sentStatus="unsent"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );
    expect(screen.getByText(/Map unavailable/)).toBeTruthy();
  });

  it('fetches address coords with the sent status and address_coords flag', async () => {
    installMockMap();
    const fetchMock = vi.fn(async (url: RequestInfo) => {
      return {
        ok: true,
        json: async () => coordsPayload([{ runId: 1, totalPending: 12 }]),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={null}
        sentStatus="unsent"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      const called = fetchMock.mock.calls.map((c) => String(c[0]));
      const url = called.find((u) => u.includes('/api/admin/outreach/street-clusters'));
      expect(url).toBeTruthy();
      expect(url).toContain('suburb=Torbay');
      expect(url).toContain('sent_status=unsent');
      expect(url).toContain('address_coords=true');
    });
  });

  it('resizes the existing map when it becomes visible again', async () => {
    installMockMap();
    const triggerResize = vi.spyOn((globalThis.google as any).maps.event, 'trigger');
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => coordsPayload([{ runId: 1, totalPending: 12 }]),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const props = {
      suburb: 'Torbay',
      activeRunId: null,
      sentStatus: 'all' as const,
      onRunSelect: vi.fn(),
      onStreetSelect: vi.fn(),
    };
    const { rerender } = render(<OutreachMapView {...props} isVisible={false} />);
    expect(await screen.findByTestId('map-canvas')).toBeTruthy();

    rerender(<OutreachMapView {...props} isVisible />);

    await waitFor(() => {
      expect(triggerResize).toHaveBeenCalledWith(expect.anything(), 'resize');
    });
  });

  it('includes report_quarter in the coords request when provided', async () => {
    installMockMap();
    const fetchMock = vi.fn(async (url: RequestInfo) => {
      return {
        ok: true,
        json: async () => coordsPayload([{ runId: 1, totalPending: 12 }]),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={null}
        sentStatus="all"
        reportQuarter="2026-Q2"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      const called = fetchMock.mock.calls.map((c) => String(c[0]));
      const url = called.find((u) => u.includes('/api/admin/outreach/street-clusters'));
      expect(url).toContain('sent_status=all');
      expect(url).toContain('report_quarter=2026-Q2');
    });
  });

  it('optimistically treats a sent address as sent without mutating fetched data', () => {
    const payload = coordsPayload([{ runId: 1, totalPending: 12 }]);

    const updated = applyOptimisticSentIds(payload, ['out-1']);

    expect(updated?.groups[0].streets[0].addressCoords?.[0].status).toBe('sent');
    expect(updated?.groups[0].streets[0].addressCoords?.[0].sent).toBe(true);
    expect(payload.groups[0].streets[0].addressCoords[0].status).toBe('unsent');
  });

  it('optimistically marks an address as junk without mutating fetched data', () => {
    const payload = coordsPayload([{ runId: 1, totalPending: 12 }]);

    const updated = applyOptimisticAddressStatuses(payload, [], ['out-1']);

    expect(updated?.groups[0].streets[0].addressCoords?.[0].status).toBe('junk');
    expect(updated?.groups[0].streets[0].addressCoords?.[0].sent).toBe(false);
    expect(payload.groups[0].streets[0].addressCoords[0].status).toBe('unsent');
  });

  it('optimistically removes junk status and restores an address to unsent', () => {
    const payload = coordsPayload([{ runId: 1, totalPending: 12 }]);
    payload.groups[0].streets[0].addressCoords[0].status = 'junk';

    const updated = applyOptimisticAddressStatuses(payload, [], [], ['out-1']);

    expect(updated?.groups[0].streets[0].addressCoords?.[0].status).toBe('unsent');
    expect(updated?.groups[0].streets[0].addressCoords?.[0].sent).toBe(false);
    expect(payload.groups[0].streets[0].addressCoords[0].status).toBe('junk');
  });

  it('shows Unjunk for junk addresses and applies the unjunk action', () => {
    const onToggleJunk = vi.fn();
    const content = buildAddressInfoWindowContent(
      '3 Beechwood Road',
      'No junk mail',
      '#eab308',
      'Torbay',
      'out-1',
      undefined,
      undefined,
      onToggleJunk
    );
    const button = content.querySelector('button');

    expect(button?.textContent).toBe('Unjunk');
    button?.click();
    expect(onToggleJunk).toHaveBeenCalledWith('out-1', 'Torbay', false);
  });

  it('shows Junk for non-junk addresses and applies the junk action', () => {
    const onToggleJunk = vi.fn();
    const content = buildAddressInfoWindowContent(
      '3 Beechwood Road',
      'Unsent',
      '#dc2626',
      'Torbay',
      'out-1',
      undefined,
      undefined,
      onToggleJunk
    );
    const button = content.querySelector('button');

    expect(button?.textContent).toBe('Junk');
    button?.click();
    expect(onToggleJunk).toHaveBeenCalledWith('out-1', 'Torbay', true);
  });

  it('renders map canvas and status legend', async () => {
    installMockMap();
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => coordsPayload([
          { runId: 1, totalPending: 12 },
          { runId: 2, totalPending: 8 },
        ]),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={1}
        sentStatus="unsent"
        reportQuarter="2026-Q2"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );

    expect(await screen.findByTestId('map-canvas')).toBeTruthy();
    expect(screen.getByText('Unsent')).toBeTruthy();
  });

  it('shows an inline error when the coords request fails', async () => {
    installMockMap();
    const fetchMock = vi.fn(async () => {
      return { ok: false, json: async () => ({}) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={null}
        sentStatus="unsent"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );

    expect(await screen.findByText('Failed to fetch coords')).toBeTruthy();
  });

  it('displays street anchor marker with street name at low zoom (showDots=false)', async () => {
    const map = installMockMap();
    const markerTitles: string[] = [];
    
    const OriginalMarker = (globalThis.google as any).maps.Marker;
    (globalThis.google as any).maps.Marker = class extends OriginalMarker {
      constructor(opts: any) {
        super(opts);
        if (opts.title) {
          markerTitles.push(opts.title);
        }
      }
    };

    const fetchMock = vi.fn(async (url: RequestInfo) => {
      return {
        ok: true,
        json: async () => ({
          success: true,
          suburb: 'Torbay',
          groups: [
            {
              suburb: 'Torbay',
              streets: [
                {
                  street: 'Glamorgan Drive',
                  suburb: 'Torbay',
                  anchorLat: -36.69,
                  anchorLng: 174.74,
                  pendingCount: 12,
                  runId: 1,
                  addresses: ['1 Glamorgan Drive', '5 Glamorgan Drive', '10 Glamorgan Drive'],
                  addressCoords: [
                      { id: 'out-1', address: '1 Glamorgan Drive', lat: -36.69, lng: 174.74, sent: false, status: 'unsent' },
                    { id: 'out-2', address: '5 Glamorgan Drive', lat: -36.692, lng: 174.741, sent: false, status: 'unsent' },
                  ],
                },
              ],
            },
          ],
          runs: [{ runId: 1, totalPending: 12 }],
        }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={null}
        sentStatus="unsent"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
        onSendStreet={vi.fn()}
      />
    );

    await waitFor(() => {
      const glamorganMarkers = markerTitles.filter(t => t.includes('Glamorgan Drive'));
      expect(glamorganMarkers.length).toBeGreaterThan(0);
      const anchorTitle = glamorganMarkers.find(t => !t.includes('·'));
      expect(anchorTitle).toBe('Glamorgan Drive');
      const dotMarkers = glamorganMarkers.filter(t => t.includes('·'));
      expect(dotMarkers.length).toBe(0);
    });
  });

  it('displays address markers with specific address and status', async () => {
    const map = installMockMap();
    const markerTitles: string[] = [];
    
    const OriginalMarker = (globalThis.google as any).maps.Marker;
    (globalThis.google as any).maps.Marker = class extends OriginalMarker {
      constructor(opts: any) {
        super(opts);
        if (opts.title) {
          markerTitles.push(opts.title);
        }
      }
    };

    const fetchMock = vi.fn(async (url: RequestInfo) => {
      return {
        ok: true,
        json: async () => ({
          success: true,
          suburb: 'Torbay',
          groups: [
            {
              suburb: 'Torbay',
              streets: [
                {
                  street: 'Glamorgan Drive',
                  suburb: 'Torbay',
                  anchorLat: -36.69,
                  anchorLng: 174.74,
                  pendingCount: 2,
                  runId: 1,
                  addresses: ['1 Glamorgan Drive', '5 Glamorgan Drive'],
                  addressCoords: [
                    { address: '1 Glamorgan Drive', lat: -36.69, lng: 174.74, sent: false, status: 'unsent' },
                    { address: '5 Glamorgan Drive', lat: -36.692, lng: 174.741, sent: false, status: 'unsent' },
                  ],
                },
              ],
            },
          ],
          runs: [{ runId: 1, totalPending: 2 }],
        }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={1}
        sentStatus="unsent"
        selectedStreet="Glamorgan Drive"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      // With selectedStreet set, address markers should be visible regardless of zoom
      const addressMarkersWithStatus = markerTitles.filter(t => 
        t.includes('Glamorgan Drive') && (t.includes('Unsent') || t.includes('Sent'))
      );
      expect(addressMarkersWithStatus.length).toBeGreaterThan(0);
      
      // Verify address markers contain actual addresses with status
      expect(markerTitles.some(t => t.includes('1 Glamorgan Drive') && t.includes('Unsent'))).toBeTruthy();
    });
  });

  it('opens an info window with the address when a dot marker is clicked', async () => {
    installMockMap();
    const openedContents: Array<Node | string> = [];
    const InfoWindowMock = class {
      static instances: unknown[] = [];
      content: unknown = null;
      constructor() {
        InfoWindowMock.instances.push(this);
      }
      setContent(c: Node | string) {
        this.content = c;
      }
      setPosition() {}
      open() {
        openedContents.push(this.content as Node | string);
      }
      close() {}
    };
    (globalThis.google as any).maps.InfoWindow = InfoWindowMock;

    const dotClickHandlers: Array<() => void> = [];
    const sendStreet = vi.fn();
    const OriginalMarker = (globalThis.google as any).maps.Marker;
    (globalThis.google as any).maps.Marker = class extends OriginalMarker {
      constructor(opts: any) {
        super(opts);
        if (opts.title && opts.title.includes('·')) {
          dotClickHandlers.push(() => this.listeners['click']?.());
        }
      }
    };

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        suburb: 'Torbay',
        groups: [
          {
            suburb: 'Torbay',
            streets: [
              {
                street: 'Glamorgan Drive',
                suburb: 'Torbay',
                anchorLat: -36.69,
                anchorLng: 174.74,
                pendingCount: 2,
                runId: 1,
                addressCoords: [
                  { id: 'out-1', address: '1 Glamorgan Drive', lat: -36.69, lng: 174.74, sent: false, status: 'unsent' },
                  { id: 'out-2', address: '5 Glamorgan Drive', lat: -36.692, lng: 174.741, sent: false, status: 'unsent' },
                ],
              },
            ],
          },
        ],
        runs: [{ runId: 1, totalPending: 2 }],
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={1}
        sentStatus="unsent"
        selectedStreet="Glamorgan Drive"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
        onSendStreet={sendStreet}
      />
    );

    await waitFor(() => {
      expect(dotClickHandlers.length).toBeGreaterThan(0);
    });

    dotClickHandlers[0]();

    expect(openedContents.length).toBe(1);
    const text = typeof openedContents[0] === 'string' ? openedContents[0] : (openedContents[0] as Node).textContent ?? '';
    expect(text).toContain('1 Glamorgan Drive');
    expect(text).toContain('Unsent');
    expect(text).toContain('Google Maps');
    // The address itself must be a clickable Google Maps link.
    const addressLink = openedContents[0] instanceof Element ? openedContents[0].querySelector('a') : null;
    expect(addressLink?.textContent).toContain('1 Glamorgan Drive');
    const addressHref = decodeURIComponent(addressLink?.getAttribute('href') ?? '');
    expect(addressHref).toContain('https://www.google.com/maps?q=');
    expect(addressHref).toContain('1 Glamorgan Drive');
    expect(addressHref).toContain('Torbay');
    expect(addressLink?.getAttribute('target')).toBe('_blank');
    expect(addressLink?.getAttribute('rel')).toContain('noopener');
    const sendStreetButton = Array.from((openedContents[0] as HTMLElement).querySelectorAll('button'))
      .find((button) => button.textContent === 'Send for Street');
    expect(sendStreetButton).toBeTruthy();
    fireEvent.click(sendStreetButton!);
    expect(sendStreet).toHaveBeenCalledWith('Torbay', 'Glamorgan Drive', [
      { id: 'out-1', address: '1 Glamorgan Drive' },
      { id: 'out-2', address: '5 Glamorgan Drive' },
    ]);
    expect((InfoWindowMock as unknown as { instances: unknown[] }).instances.length).toBe(1);
  });

  it('does not refetch coordinates after marking an address as sent', async () => {
    installMockMap();
    const markerClicks: Array<() => void> = [];
    const OriginalMarker = (globalThis.google as any).maps.Marker;
    (globalThis.google as any).maps.Marker = class extends OriginalMarker {
      constructor(options: { title?: string }) {
        super(options);
        if (options.title?.includes('Unsent')) {
          markerClicks.push(() => this.listeners.click?.());
        }
      }
    };

    let openedContent: HTMLElement | null = null;
    (globalThis.google as any).maps.InfoWindow = class {
      setContent(content: HTMLElement) {
        openedContent = content;
      }
      setPosition() {}
      open() {}
      close() {}
    };

    const makePayload = (status: 'unsent' | 'sent') => {
      const payload = coordsPayload([{ runId: 1, totalPending: 1 }]);
      const address = payload.groups[0].streets[0].addressCoords![0];
      address.id = 'out-1';
      address.status = status;
      address.sent = status === 'sent';
      return payload;
    };
    const fetchMock = vi.fn(async (url: RequestInfo, init?: RequestInit) => {
      if (init?.method === 'PATCH') {
        return { ok: true, json: async () => ({ success: true }) };
      }
      const clusterRequestCount = fetchMock.mock.calls.filter(([requestUrl]) =>
        String(requestUrl).includes('/api/admin/outreach/street-clusters')
      ).length;
      return {
        ok: true,
        json: async () => makePayload(clusterRequestCount > 1 ? 'sent' : 'unsent'),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={null}
        selectedStreet="Glamorgan Drive"
        sentStatus="all"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );

    await waitFor(() => expect(markerClicks.length).toBeGreaterThan(0));
    markerClicks[0]();
    expect(openedContent).toBeTruthy();
    const sentButton = Array.from(openedContent!.querySelectorAll('button')).find((button) => button.textContent === 'Sent');
    expect(sentButton).toBeTruthy();
    fireEvent.click(sentButton!);

    await waitFor(() => expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')
    ).toBe(true));
    const clusterRequests = fetchMock.mock.calls.filter(([requestUrl]) =>
      String(requestUrl).includes('/api/admin/outreach/street-clusters')
    );
    expect(clusterRequests).toHaveLength(1);
  });

  it('shows the nearest unsent address after locating', async () => {
    installMockMap();
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: (pos: { coords: { latitude: number; longitude: number; accuracy: number } }) => void) =>
          success({ coords: { latitude: -36.6895, longitude: 174.7395, accuracy: 30 } })
        ),
      },
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        suburb: 'Torbay',
        groups: [
          {
            suburb: 'Torbay',
            streets: [
              {
                street: 'Glamorgan Drive',
                suburb: 'Torbay',
                anchorLat: -36.69,
                anchorLng: 174.74,
                pendingCount: 1,
                runId: 1,
                addressCoords: [
                  { address: '1 Glamorgan Drive', lat: -36.69, lng: 174.74, sent: false, status: 'unsent' },
                ],
              },
            ],
          },
        ],
        runs: [{ runId: 1, totalPending: 1 }],
      }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={null}
        sentStatus="unsent"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Locate me' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Locate me' }));

    await waitFor(() => {
      expect(screen.getByText(/Nearest unsent/)).toBeTruthy();
    });

    const nearestText = screen.getByText(/Nearest unsent/).textContent ?? '';
    expect(nearestText).toContain('1 Glamorgan Drive');
    const distanceText = screen.getByText(/Distance/).textContent ?? '';
    expect(distanceText).toContain('m');

    // The nearest-unsent address must be a clickable Google Maps link (same
    // behaviour as clicking an unsent red-dot marker's InfoWindow link).
    const nearestLink = screen.getByRole('link', { name: /1 Glamorgan Drive/ });
    const nearestHref = decodeURIComponent(nearestLink.getAttribute('href') ?? '');
    expect(nearestHref).toContain('https://www.google.com/maps?q=');
    expect(nearestHref).toContain('1 Glamorgan Drive');
    expect(nearestHref).toContain('Torbay');
    expect(nearestLink.getAttribute('target')).toBe('_blank');
    expect(nearestLink.getAttribute('rel')).toContain('noopener');
  });

  it('closes the location panel when its close button is clicked', async () => {
    installMockMap();
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((success: (pos: { coords: { latitude: number; longitude: number; accuracy: number } }) => void) =>
          success({ coords: { latitude: -36.6895, longitude: 174.7395, accuracy: 30 } })
        ),
      },
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => coordsPayload([{ runId: 1, totalPending: 1 }]),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={null}
        sentStatus="unsent"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Locate me' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Locate me' }));

    await waitFor(() => {
      expect(screen.getByText('Your location')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close location info' }));

    await waitFor(() => {
      expect(screen.queryByText('Your location')).toBeNull();
    });
  });

  it('closes the legend when its close button is clicked', async () => {
    installMockMap();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => coordsPayload([{ runId: 1, totalPending: 12 }]),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <OutreachMapView
        suburb="Torbay"
        activeRunId={null}
        sentStatus="unsent"
        onRunSelect={vi.fn()}
        onStreetSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Unsent')).toBeTruthy();
    });
    expect(screen.getByText('Sent')).toBeTruthy();
    expect(screen.getByText('No junk mail')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close legend' }));

    await waitFor(() => {
      expect(screen.queryByText('Unsent')).toBeNull();
      expect(screen.queryByText('Sent')).toBeNull();
      expect(screen.queryByText('No junk mail')).toBeNull();
    });
  });
});