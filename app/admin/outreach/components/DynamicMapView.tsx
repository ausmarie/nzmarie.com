'use client';

import React, { useCallback, useState } from 'react';
import nextDynamic from 'next/dynamic';
import type { OutreachMapViewProps } from './OutreachMapView';

function createMapView() {
  return nextDynamic(() => import('./OutreachMapView'), { ssr: false });
}

interface MapChunkErrorBoundaryProps {
  children: React.ReactNode;
  onRetry: () => void;
}

interface MapChunkErrorBoundaryState {
  failed: boolean;
}

class MapChunkErrorBoundary extends React.Component<MapChunkErrorBoundaryProps, MapChunkErrorBoundaryState> {
  state: MapChunkErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): MapChunkErrorBoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          data-testid="map-chunk-fallback"
          style={{
            height: '100%',
            minHeight: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: '#4a5568',
            background: '#f8fafc',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Failed to load the map view.</p>
          <button
            onClick={this.props.onRetry}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '2px solid #e2e8f0',
              background: 'white',
              color: '#2d3748',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DynamicMapView(props: OutreachMapViewProps) {
  const [MapView, setMapView] = useState(createMapView);
  const [attempt, setAttempt] = useState(0);

  const handleRetry = useCallback(() => {
    setMapView(createMapView());
    setAttempt((a) => a + 1);
  }, []);

  return (
    <MapChunkErrorBoundary key={attempt} onRetry={handleRetry}>
      <MapView {...props} />
    </MapChunkErrorBoundary>
  );
}
