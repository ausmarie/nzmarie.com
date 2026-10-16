'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { FaExpand, FaCompress, FaCrosshairs, FaSpinner, FaTimes } from 'react-icons/fa';
import {
  statusColor,
  haversineMeters,
  type AddressStatus,
} from '@/lib/outreach-map';

interface AddressCoord {
  address: string;
  lat: number;
  lng: number;
  sent: boolean;
  status: AddressStatus;
}

interface ClusterStreet {
  suburb: string;
  street: string;
  anchorLat: number | null;
  anchorLng: number | null;
  pendingCount: number;
  addressCount?: number;
  runId?: number;
  addressCoords?: AddressCoord[];
  addresses?: string[];
}

interface RunSummary {
  runId: number;
  totalPending: number;
}

interface ClusterPayload {
  suburb: string;
  groups: Array<{ suburb: string; streets: ClusterStreet[] }>;
  runs: RunSummary[];
}

export interface OutreachMapViewProps {
  suburb: string;
  activeRunId: number | null;
  selectedStreet?: string | null;
  sentStatus: 'all' | 'unsent' | 'sent';
  reportQuarter?: string;
  onRunSelect: (runId: number) => void;
  onStreetSelect: (suburb: string, street: string) => void;
  onCoordsLoaded?: (
    streetStatusMap: Map<string, 'has-unsent' | 'all-sent' | 'junk-only' | 'no-pending'>,
    counts: { total: number; unsent: number; sent: number; junk: number }
  ) => void;
  statusFilter?: 'all' | 'unsent' | 'sent' | 'junk';
  onStatusFilterChange?: (status: 'all' | 'unsent' | 'sent' | 'junk') => void;
}

const MAX_BOUNDS_ZOOM = 16;

function dotScaleForZoom(zoom: number, isUnsent: boolean): number | null {
  if (zoom < 13) return null;
  if (zoom < 14) return isUnsent ? 4 : 3;
  if (zoom < 15) return isUnsent ? 5 : 4;
  return isUnsent ? 6 : 5;
}

function buildAddressInfoWindowContent(address: string, statusLabel: string, color: string, suburb?: string): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = 'padding:8px 10px;min-width:190px;font-family:inherit;';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;font-weight:700;font-size:13px;color:#1f2937;';
  const dot = document.createElement('span');
  dot.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;flex-shrink:0;`;
  row.appendChild(dot);
  const addressLink = document.createElement('a');
  addressLink.href = `https://www.google.com/maps?q=${encodeURIComponent([address, suburb].filter(Boolean).join(', '))}`;
  addressLink.target = '_blank';
  addressLink.rel = 'noopener noreferrer';
  addressLink.textContent = address;
  addressLink.style.cssText = 'color:#2563eb;text-decoration:underline;font-weight:700;';
  row.appendChild(addressLink);
  container.appendChild(row);
  const status = document.createElement('div');
  status.style.cssText = 'font-size:11px;color:#6b7280;margin-top:2px;';
  status.textContent = statusLabel;
  container.appendChild(status);
  const link = document.createElement('a');
  link.href = `https://www.google.com/maps?q=${encodeURIComponent([address, suburb].filter(Boolean).join(', '))}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Google Maps ↗';
  link.style.cssText = 'display:inline-block;margin-top:6px;font-size:12px;font-weight:600;color:#2563eb;text-decoration:none;';
  container.appendChild(link);
  return container;
}

interface NearestUnsentResult {
  address: string;
  suburb: string;
  distanceM: number;
  lat: number;
  lng: number;
}

function computeNearestUnsent(
  userLocation: { lat: number; lng: number },
  coordsData: ClusterPayload | null
): NearestUnsentResult | null {
  if (!coordsData) return null;
  let best: NearestUnsentResult | null = null;
  for (const g of coordsData.groups ?? []) {
    for (const s of g.streets ?? []) {
      for (const a of s.addressCoords ?? []) {
        if (a.lat == null || a.lng == null) continue;
        if (a.status !== 'unsent') continue;
        const d = haversineMeters(userLocation, { lat: a.lat, lng: a.lng });
        if (!best || d < best.distanceM) {
          best = { address: a.address, suburb: s.suburb || g.suburb || '', distanceM: d, lat: a.lat, lng: a.lng };
        }
      }
    }
  }
  return best;
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function NativeMarkerManager({
  map,
  groups,
  activeRunId,
  selectedStreet,
  onStreetSelect,
  statusFilter = 'all',
}: {
  map: google.maps.Map;
  groups: Array<{ suburb?: string; streets: ClusterStreet[] }>;
  activeRunId: number | null;
  selectedStreet: string | null;
  onStreetSelect: (suburb: string, street: string) => void;
  statusFilter?: 'all' | 'unsent' | 'sent' | 'junk';
}) {
  const onStreetSelectRef = useRef(onStreetSelect);
  onStreetSelectRef.current = onStreetSelect;

  const [zoom, setZoom] = useState<number>(() => map.getZoom() ?? 12);
  useEffect(() => {
    const listener = map.addListener('zoom_changed', () => {
      setZoom(map.getZoom() ?? 12);
    });
    return () => google.maps.event.removeListener(listener);
  }, [map]);

  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  useEffect(() => {
    const listener = map.addListener('click', () => {
      infoWindowRef.current?.close();
    });
    return () => google.maps.event.removeListener(listener);
  }, [map]);

  useEffect(() => {
    return () => {
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
    };
  }, []);

  useEffect(() => {
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];

    const flatStreets: Array<{ suburb: string; street: ClusterStreet }> = [];
    for (const g of groups) {
      for (const s of g.streets ?? []) {
        flatStreets.push({ suburb: g.suburb || s.suburb || '', street: s });
      }
    }

    const newMarkers: google.maps.Marker[] = [];

    for (const { suburb, street } of flatStreets) {
      if (street.anchorLat == null || street.anchorLng == null) continue;

      let hasMatchingAddresses = false;
      if (statusFilter === 'all') {
        hasMatchingAddresses = (street.addressCoords ?? []).length > 0;
      } else {
        hasMatchingAddresses = (street.addressCoords ?? []).some(a => {
          const isUnsent = a.status === 'unsent';
          const isSent = a.status === 'sent';
          const isJunk = a.status === 'junk';
          if (statusFilter === 'unsent') return isUnsent;
          if (statusFilter === 'sent') return isSent;
          if (statusFilter === 'junk') return isJunk;
          return false;
        });
      }

      if (!hasMatchingAddresses) continue;

      const runIndex = street.runId ?? 1;
      const isSelected = selectedStreet === street.street;
      const streetName = street.street;

      const isInActiveRun = activeRunId != null && runIndex === activeRunId;
      const showDots = zoom >= 13 || isSelected || isInActiveRun || statusFilter !== 'all';

      if (showDots) {
        const renderedAddresses = new Set<string>();
        for (const a of street.addressCoords ?? []) {
          if (a.lat == null || a.lng == null) continue;
          const key = a.address.trim().toLowerCase();
          if (renderedAddresses.has(key)) continue;
          renderedAddresses.add(key);

          const isUnsent = a.status === 'unsent';
          const isSent = a.status === 'sent';
          const isJunk = a.status === 'junk';

          if (statusFilter !== 'all') {
            if (statusFilter === 'unsent' && !isUnsent) continue;
            if (statusFilter === 'sent' && !isSent) continue;
            if (statusFilter === 'junk' && !isJunk) continue;
          }

          const scale = isSelected
            ? (isUnsent ? 8 : 6)
            : isInActiveRun
              ? (isUnsent ? 6 : 5)
              : dotScaleForZoom(zoom, isUnsent);

          if (scale == null) continue;

          const dotColor = statusColor(a.status);
          const statusLabel = isUnsent ? 'Unsent' : isJunk ? 'No junk mail' : 'Sent';

          const dotMarker = new google.maps.Marker({
            position: { lat: a.lat, lng: a.lng },
            map,
            title: `${a.address} · ${statusLabel}`,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale,
              fillColor: dotColor,
              fillOpacity: 1.0,
              strokeColor: '#ffffff',
              strokeWeight: 1.5,
            },
            zIndex: isUnsent ? 500 : isJunk ? 450 : 300,
          });
          dotMarker.addListener('click', () => {
            onStreetSelectRef.current(suburb, streetName);
            if (!infoWindowRef.current) infoWindowRef.current = new google.maps.InfoWindow();
            infoWindowRef.current.setContent(buildAddressInfoWindowContent(a.address, statusLabel, dotColor, suburb));
            infoWindowRef.current.setPosition({ lat: a.lat, lng: a.lng });
            infoWindowRef.current.open(map);
          });
          newMarkers.push(dotMarker);
        }
      } else {
        const coords = street.addressCoords ?? [];
        const hasUnsent = coords.some(a => a.status === 'unsent');
        const hasJunk = coords.some(a => a.status === 'junk');
        const anchorColor = hasUnsent ? '#dc2626' : hasJunk ? '#eab308' : '#7c3aed';

        const anchorMarker = new google.maps.Marker({
          position: { lat: street.anchorLat, lng: street.anchorLng },
          map,
          title: streetName,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: anchorColor,
            fillOpacity: 1.0,
            strokeColor: '#ffffff',
            strokeWeight: 1.5,
          },
          zIndex: isSelected ? 2000 : 1000,
        });
        anchorMarker.addListener('click', () => {
          onStreetSelectRef.current(suburb, streetName);
        });
        newMarkers.push(anchorMarker);
      }
    }

    markersRef.current = newMarkers;

    return () => {
      for (const m of markersRef.current) m.setMap(null);
      markersRef.current = [];
    };
  }, [map, groups, activeRunId, selectedStreet, zoom, statusFilter]);

  return null;
}

function MapInner({
  coordsData,
  activeRunId,
  selectedStreet,
  onStreetSelect,
  onMapLoad,
  error,
  statusFilter,
}: {
  coordsData: ClusterPayload | null;
  activeRunId: number | null;
  selectedStreet: string | null;
  onStreetSelect: (suburb: string, street: string) => void;
  onMapLoad: (map: google.maps.Map) => void;
  error: string | null;
  statusFilter: 'all' | 'unsent' | 'sent' | 'junk';
}) {
  const map = useMap();
  const [legendVisible, setLegendVisible] = useState(true);

  useEffect(() => {
    if (map) onMapLoad(map);
  }, [map, onMapLoad]);

  return (
    <>
      {error && (
        <div style={{
          position: 'absolute', left: 12, top: 46, zIndex: 50,
          color: '#dc2626', background: 'rgba(255,255,255,.92)',
          padding: '4px 8px', borderRadius: 6, fontSize: '0.85rem',
        }}>
          {error}
        </div>
      )}

      {coordsData && legendVisible && (
        <div style={{
          position: 'absolute', left: 12, bottom: 28, zIndex: 50,
          background: 'rgba(255,255,255,.95)', border: '1px solid #e5e7eb',
          borderRadius: 8, padding: '6px 10px', fontSize: '11px', color: '#374151',
          display: 'flex', flexDirection: 'column', gap: 3,
          boxShadow: '0 1px 4px rgba(0,0,0,.12)', pointerEvents: 'none',
        }}>
          <button
            type="button"
            onClick={() => setLegendVisible(false)}
            aria-label="Close legend"
            title="Close legend"
            style={{
              position: 'absolute', top: 2, right: 2,
              pointerEvents: 'auto', width: 18, height: 18, borderRadius: '50%',
              border: 'none', background: '#e5e7eb', color: '#4b5563',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 9, lineHeight: 1,
            }}
          >
            <FaTimes />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#dc2626', border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', flexShrink: 0 }} />
            Unsent
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#7c3aed', border: '2px solid #fff', flexShrink: 0 }} />
            Sent
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#eab308', border: '2px solid #fff', flexShrink: 0 }} />
            No junk mail
          </div>
        </div>
      )}

      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <GoogleMap
          defaultCenter={{ lat: -36.6966, lng: 174.7454 }}
          defaultZoom={12}
          mapTypeControl={true}
          fullscreenControl={false}
          gestureHandling="greedy"
          style={{ width: '100%', height: '100%' }}
        />
        {map && coordsData && (
          <NativeMarkerManager
            map={map}
            groups={coordsData.groups ?? []}
            activeRunId={activeRunId}
            selectedStreet={selectedStreet}
            onStreetSelect={onStreetSelect}
            statusFilter={statusFilter}
          />
        )}
      </div>
    </>
  );
}

export default function OutreachMapView({
  suburb,
  activeRunId,
  selectedStreet,
  sentStatus,
  reportQuarter,
  onStreetSelect,
  onCoordsLoaded,
  statusFilter: externalStatusFilter = 'all',
}: OutreachMapViewProps) {
  const [coordsData, setCoordsData] = useState<ClusterPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [locationPanelOpen, setLocationPanelOpen] = useState(true);
  const [nearest, setNearest] = useState<{ address: string; suburb: string; distanceM: number } | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const userCircleRef = useRef<google.maps.Circle | null>(null);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((f) => !f);
  }, []);

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocateError('Geolocation is not supported by this browser');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocationPanelOpen(true);
        setLocating(false);
      },
      (err) => {
        setLocateError(err.message || 'Unable to determine your location');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, []);

  const statusFilter = externalStatusFilter;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;

    const marker = new google.maps.Marker({
      position: { lat: userLocation.lat, lng: userLocation.lng },
      map,
      title: 'Your location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#2563eb',
        fillOpacity: 1.0,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
      zIndex: 3000,
    });
    userMarkerRef.current = marker;

    let circle: google.maps.Circle | null = null;
    if (userLocation.accuracy) {
      circle = new google.maps.Circle({
        map,
        center: { lat: userLocation.lat, lng: userLocation.lng },
        radius: userLocation.accuracy,
        fillColor: '#2563eb',
        fillOpacity: 0.12,
        strokeColor: '#2563eb',
        strokeOpacity: 0.4,
        strokeWeight: 1,
      });
      userCircleRef.current = circle;
    }

    const nearestPoint = computeNearestUnsent(userLocation, coordsData);
    setNearest(nearestPoint ? { address: nearestPoint.address, suburb: nearestPoint.suburb, distanceM: nearestPoint.distanceM } : null);

    const pts: { lat: number; lng: number }[] = [{ lat: userLocation.lat, lng: userLocation.lng }];
    if (nearestPoint) pts.push({ lat: nearestPoint.lat, lng: nearestPoint.lng });
    const bounds = new google.maps.LatLngBounds();
    for (const p of pts) bounds.extend(new google.maps.LatLng(p.lat, p.lng));
    map.fitBounds(bounds);

    return () => {
      marker.setMap(null);
      circle?.setMap(null);
      userMarkerRef.current = null;
      userCircleRef.current = null;
    };
  }, [userLocation, coordsData]);

  useEffect(() => {
    return () => {
      userMarkerRef.current?.setMap(null);
      userCircleRef.current?.setMap(null);
    };
  }, []);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const onCoordsLoadedRef = useRef(onCoordsLoaded);
  onCoordsLoadedRef.current = onCoordsLoaded;

  const loadCoords = useCallback(async () => {
    if (!suburb) return;
    setError(null);
    try {
      const params = new URLSearchParams({
        suburb,
        radius: '500',
        budget: '20',
        status: 'pending',
        sent_status: sentStatus,
        address_coords: 'true',
      });
      if (reportQuarter) params.set('report_quarter', reportQuarter);
      const res = await fetch(`/api/admin/outreach/street-clusters?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch coords');
      const body = await res.json();
      if (body.success === false) throw new Error(body.error || 'Failed to load');
      setCoordsData(body);
      if (onCoordsLoadedRef.current) {
        const sm = new Map<string, 'has-unsent' | 'all-sent' | 'junk-only' | 'no-pending'>();
        let unsentCount = 0;
        let sentCount = 0;
        let junkCount = 0;
        for (const g of (body.groups ?? []) as Array<{ streets: ClusterStreet[] }>) {
          for (const s of g.streets ?? []) {
            const coords = s.addressCoords ?? [];
            let state: 'has-unsent' | 'all-sent' | 'junk-only' | 'no-pending';
            if (coords.length === 0) {
              state = 'no-pending';
            } else if (coords.some((c) => c.status === 'unsent')) {
              state = 'has-unsent';
            } else if (coords.every((c) => c.status === 'junk')) {
              state = 'junk-only';
            } else {
              state = 'all-sent';
            }
            sm.set(s.street, state);
            for (const c of coords) {
              if (c.status === 'unsent') unsentCount++;
              else if (c.status === 'sent') sentCount++;
              else if (c.status === 'junk') junkCount++;
            }
          }
        }
        onCoordsLoadedRef.current(sm, {
          total: unsentCount + sentCount + junkCount,
          unsent: unsentCount,
          sent: sentCount,
          junk: junkCount,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [suburb, sentStatus, reportQuarter]);

  useEffect(() => { if (suburb) loadCoords(); }, [suburb, loadCoords]);

  const allPoints = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    if (!coordsData) return pts;
    for (const g of coordsData.groups ?? []) {
      for (const s of g.streets ?? []) {
        if (s.anchorLat != null && s.anchorLng != null) pts.push({ lat: s.anchorLat, lng: s.anchorLng });
        for (const a of s.addressCoords ?? []) {
          if (a.lat != null && a.lng != null) pts.push({ lat: a.lat, lng: a.lng });
        }
      }
    }
    return pts;
  }, [coordsData]);

  const fitToBounds = useCallback((points: { lat: number; lng: number }[]) => {
    const map = mapRef.current;
    if (!map || points.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const p of points) bounds.extend(new google.maps.LatLng(p.lat, p.lng));
    map.fitBounds(bounds);
    google.maps.event.addListenerOnce(map, 'idle', () => {
      const z = map.getZoom();
      if (typeof z === 'number' && z > MAX_BOUNDS_ZOOM) map.setZoom(MAX_BOUNDS_ZOOM);
    });
  }, []);


  const lastFittedRunRef = useRef<number | null>(null);
  useEffect(() => {
    if (activeRunId != null && activeRunId !== lastFittedRunRef.current && coordsData) {
      lastFittedRunRef.current = activeRunId;
      const pts: { lat: number; lng: number }[] = [];
      for (const g of coordsData.groups ?? []) {
        for (const s of g.streets ?? []) {
          if (s.runId !== activeRunId) continue;
          if (s.anchorLat != null && s.anchorLng != null) pts.push({ lat: s.anchorLat, lng: s.anchorLng });
          for (const a of s.addressCoords ?? []) {
            if (a.lat != null && a.lng != null) pts.push({ lat: a.lat, lng: a.lng });
          }
        }
      }
      if (pts.length > 0) fitToBounds(pts);
    } else if (activeRunId == null) {
      lastFittedRunRef.current = null;
    }
  }, [activeRunId, coordsData, fitToBounds]);

  const focusStreet = useCallback((streetName: string) => {
    const map = mapRef.current;
    if (!map || !coordsData) return;
    const target = (coordsData.groups ?? [])
      .flatMap((g) => g.streets ?? [])
      .find((s) => s.street === streetName);
    if (!target || target.anchorLat == null || target.anchorLng == null) return;
    const pts = (target.addressCoords ?? [])
      .filter((a) => a.lat != null && a.lng != null)
      .map((a) => ({ lat: a.lat, lng: a.lng }));
    if (pts.length === 0) pts.push({ lat: target.anchorLat, lng: target.anchorLng });
    const bounds = new google.maps.LatLngBounds();
    for (const p of pts) bounds.extend(new google.maps.LatLng(p.lat, p.lng));
    map.fitBounds(bounds);
    google.maps.event.addListenerOnce(map, 'idle', () => {
      const z = map.getZoom();
      if (z != null && z < 15) map.setZoom(15);
      if (z != null && z > 17) map.setZoom(17);
    });
  }, [coordsData]);

  useEffect(() => {
    if (selectedStreet && coordsData) focusStreet(selectedStreet);
  }, [selectedStreet, coordsData, focusStreet]);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    if (!mapRef.current) {
      mapRef.current = map;
      fitToBounds(allPoints);
    }
  }, [allPoints, fitToBounds]);

  useEffect(() => {
    if (mapRef.current && allPoints.length > 0) fitToBounds(allPoints);
  }, [allPoints, fitToBounds]);

  if (!suburb) return (
    <div style={{ height: '100%', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', background: '#f8fafc', borderRadius: 12 }}>
      Select a report to view the delivery map.
    </div>
  );
  if (!apiKey) return (
    <div style={{ height: '100%', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', background: '#f8fafc', borderRadius: 12 }}>
      Map unavailable — Google Maps API key not configured.
    </div>
  );

  return (
    <APIProvider apiKey={apiKey} libraries={['places']}>
      <div
        ref={containerRef}
        style={{
          position: isFullscreen ? 'fixed' : 'relative',
          top: 0,
          left: 0,
          width: '100%',
          height: isFullscreen ? '100vh' : '100%',
          zIndex: isFullscreen ? 9999 : undefined,
          background: '#fff',
        }}
      >
        <MapInner
          coordsData={coordsData}
          activeRunId={activeRunId}
          selectedStreet={selectedStreet ?? null}
          onStreetSelect={onStreetSelect}
          onMapLoad={handleMapLoad}
          error={error}
          statusFilter={statusFilter}
        />
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 1000,
            width: 36,
            height: 36,
            borderRadius: 8,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#334155',
          }}
        >
          {isFullscreen ? <FaCompress /> : <FaExpand />}
        </button>
        <button
          type="button"
          onClick={handleLocate}
          disabled={locating}
          aria-label="Locate me"
          title="Locate me"
          style={{
            position: 'absolute',
            top: 56,
            right: 12,
            zIndex: 1000,
            width: 36,
            height: 36,
            borderRadius: 8,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#334155',
          }}
        >
          {locating ? <FaSpinner className="animate-spin" /> : <FaCrosshairs />}
        </button>
        {(userLocation || locateError) && locationPanelOpen && (
          <div style={{
            position: 'absolute',
            left: 12,
            bottom: 140,
            zIndex: 1000,
            maxWidth: 260,
            background: 'rgba(255,255,255,0.97)',
            border: locateError ? '1px solid #fecaca' : '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: '12px',
            color: '#1f2937',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>
            <button
              type="button"
              onClick={() => setLocationPanelOpen(false)}
              aria-label="Close location info"
              title="Close location info"
              style={{
                position: 'absolute', top: 6, right: 6,
                width: 20, height: 20, borderRadius: '50%',
                border: 'none', background: '#e2e8f0', color: '#4b5563',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 10, lineHeight: 1,
              }}
            >
              <FaTimes />
            </button>
            {locateError ? (
              <div style={{ color: '#dc2626', paddingRight: 20 }}>{locateError}</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 3, paddingRight: 18 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb', border: '2px solid #fff', boxShadow: '0 1px 2px rgba(0,0,0,0.3)', flexShrink: 0 }} />
                  Your location
                </div>
                {nearest ? (
                  <>
                    <div>
                      Nearest unsent:{' '}
                      <a
                        href={`https://www.google.com/maps?q=${encodeURIComponent([nearest.address, nearest.suburb].filter(Boolean).join(', '))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {nearest.address}
                      </a>
                    </div>
                    <div style={{ color: '#6b7280' }}>Distance {formatDistance(nearest.distanceM)}</div>
                  </>
                ) : (
                  <div style={{ color: '#6b7280' }}>No unsent addresses nearby</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </APIProvider>
  );
}
