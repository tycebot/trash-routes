import { useCallback, useMemo, useRef } from 'react';
import type { MouseEvent } from 'react';
import type { TrashStop, Mode } from '../types';

interface MapProps {
  stops: TrashStop[];
  routeOrder: string[];
  mode: Mode;
  onMapClick: (lat: number, lng: number) => void;
  onLineClick: (lat: number, lng: number) => void;
  onRemoveStop: (id: string) => void;
}

function projectClickToLatLng(rect: DOMRect, x: number, y: number): [number, number] {
  const latTop = 30.305;
  const latBottom = 30.235;
  const lngLeft = -97.79;
  const lngRight = -97.71;
  const xRatio = rect.width === 0 ? 0.5 : Math.min(1, Math.max(0, x / rect.width));
  const yRatio = rect.height === 0 ? 0.5 : Math.min(1, Math.max(0, y / rect.height));
  const lat = latTop - (latTop - latBottom) * yRatio;
  const lng = lngLeft + (lngRight - lngLeft) * xRatio;
  return [lat, lng];
}

export function MapView({ stops, routeOrder, mode, onMapClick, onLineClick, onRemoveStop }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const orderedStops = useMemo(
    () => routeOrder.map((id) => stops.find((stop) => stop.id === id)).filter(Boolean) as TrashStop[],
    [routeOrder, stops],
  );

  const handleMapClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (mode !== 'draw' || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const [lat, lng] = projectClickToLatLng(rect, event.clientX - rect.left, event.clientY - rect.top);
    onMapClick(lat, lng);
  }, [mode, onMapClick]);

  const handleLineClick = useCallback(() => {
    if (mode !== 'edit') return;
    const source = orderedStops.length > 0 ? orderedStops : stops;
    if (source.length === 0) return;
    const avgLat = source.reduce((sum, stop) => sum + stop.lat, 0) / source.length;
    const avgLng = source.reduce((sum, stop) => sum + stop.lng, 0) / source.length;
    onLineClick(avgLat, avgLng);
  }, [mode, onLineClick, orderedStops, stops]);

  return (
    <div
      ref={containerRef}
      onClick={handleMapClick}
      style={{
        height: '100%',
        width: '100%',
        padding: '16px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#e2e8f0',
        display: 'grid',
        gap: '12px',
        alignContent: 'start',
        overflow: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>Route map</div>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
            {mode === 'draw' ? 'Click the map to add a stop.' : mode === 'edit' ? 'Use the route controls to insert or remove stops.' : 'Viewing the current route.'}
          </div>
        </div>
        <button
          type="button"
          onClick={handleLineClick}
          disabled={mode !== 'edit' || orderedStops.length === 0}
          style={{
            border: '1px solid #f59e0b',
            background: mode === 'edit' ? 'rgba(245, 158, 11, 0.14)' : 'transparent',
            color: '#fbbf24',
            padding: '8px 12px',
            borderRadius: '999px',
            cursor: mode === 'edit' ? 'pointer' : 'not-allowed',
          }}
        >
          Insert on route
        </button>
      </div>

      <div style={{
        border: '1px solid rgba(148, 163, 184, 0.35)',
        borderRadius: '20px',
        background: 'rgba(15, 23, 42, 0.7)',
        minHeight: '320px',
        padding: '16px',
        boxShadow: '0 20px 50px rgba(15, 23, 42, 0.35)',
      }}>
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {orderedStops.map((stop, index) => (
              <span
                key={stop.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '999px',
                  background: index === 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  fontSize: '13px',
                }}
              >
                <strong style={{ color: index === 0 ? '#93c5fd' : '#fbbf24' }}>{index + 1}</strong>
                <span>{stop.name}</span>
                {mode !== 'view' && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveStop(stop.id);
                    }}
                    style={{
                      border: 'none',
                      background: 'rgba(239, 68, 68, 0.9)',
                      color: 'white',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                    }}
                    aria-label={`Remove ${stop.name}`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>

          <div
            style={{
              borderRadius: '16px',
              minHeight: '240px',
              background:
                'linear-gradient(90deg, rgba(71, 85, 105, 0.18) 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(rgba(71, 85, 105, 0.18) 1px, transparent 1px) 0 0 / 24px 24px, rgba(15, 23, 42, 0.55)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              padding: '16px',
              display: 'grid',
              gap: '12px',
              alignContent: 'start',
            }}
          >
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Placeholder map surface for the route-review redesign.
            </div>
            {stops.map((stop) => (
              <div
                key={stop.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: 'rgba(30, 41, 59, 0.88)',
                  border: '1px solid rgba(148, 163, 184, 0.18)',
                }}
              >
                <span style={{ fontWeight: 600 }}>{stop.name}</span>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                  {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
