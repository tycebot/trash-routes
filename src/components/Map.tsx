import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { store } from '../store';
import type { TrashStop, Mode } from '../types';

// Fix Leaflet marker icons
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

interface MapProps {
  stops: TrashStop[];
  routeOrder: string[];
  mode: Mode;
  onMapClick: (lat: number, lng: number) => void;
  onLineClick: (lat: number, lng: number) => void;
  onRemoveStop: (id: string) => void;
}

export function MapView({ stops, routeOrder, mode, onMapClick, onLineClick, onRemoveStop }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLineRef = useRef<L.Polyline | null>(null);
  const editHandlesRef = useRef<Map<string, L.Marker>>(new Map());
  const modeRef = useRef(mode);
  const clickRef = useRef(onMapClick);
  const lineClickRef = useRef(onLineClick);
  const removeRef = useRef(onRemoveStop);

  // Keep refs in sync
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { clickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { lineClickRef.current = onLineClick; }, [onLineClick]);
  useEffect(() => { removeRef.current = onRemoveStop; }, [onRemoveStop]);

  // Bigger, more visible marker icon with name label
  const makeIcon = useCallback((orderIndex: number, m: Mode) => {
    const inRoute = orderIndex >= 0;
    const color = m === 'draw'
      ? (inRoute ? '#3b82f6' : '#64748b')
      : (inRoute ? '#f59e0b' : '#64748b');

    return L.divIcon({
      className: '',
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          <div style="
            width:44px;height:44px;border-radius:50%;
            background:${color};
            border:4px solid white;
            box-shadow:0 3px 10px rgba(0,0,0,0.4), 0 0 0 2px rgba(0,0,0,0.1);
            display:flex;align-items:center;justify-content:center;
            color:white;font-weight:800;font-size:16px;
            font-family:-apple-system,system-ui,sans-serif;
            user-select:none;
            ${m === 'edit' ? 'cursor:grab;' : ''}
          ">${inRoute ? orderIndex + 1 : '•'}</div>
          <div style="
            margin-top:2px;padding:1px 6px;
            background:rgba(0,0,0,0.7);color:white;
            border-radius:4px;font-size:11px;font-weight:600;
            white-space:nowrap;max-width:100px;
            overflow:hidden;text-overflow:ellipsis;
            font-family:-apple-system,system-ui,sans-serif;
          ">${orderIndex >= 0 ? 'Stop ' + (orderIndex + 1) : 'New'}</div>
        </div>
      `,
      iconSize: [44, 54],
      iconAnchor: [22, 22],
      popupAnchor: [0, -28],
    });
  }, []);

  // Edit handle icon (small circle on the route line)
  const makeHandleIcon = useCallback(() => L.divIcon({
    className: '',
    html: `<div style="
      width:22px;height:22px;border-radius:50%;
      background:#f59e0b;border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,0.4), 0 0 0 2px rgba(245,158,11,0.3);
      cursor:grab;transition:transform 0.15s;
    " onmouseover="this.style.transform='scale(1.3)'"
       onmouseout="this.style.transform='scale(1)'">
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  }), []);

  // Initialize map
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([30.2672, -97.7431], 14);

    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.attribution({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Click to add stop in draw mode
    const handleClick = (e: L.LeafletMouseEvent) => {
      // Don't fire if clicking on a marker or handle
      if ((e.originalEvent.target as HTMLElement)?.closest('.leaflet-marker-icon') ||
          (e.originalEvent.target as HTMLElement)?.closest('.edit-handle')) return;
      if (modeRef.current === 'draw') {
        clickRef.current(e.latlng.lat, e.latlng.lng);
      }
    };
    map.on('click', handleClick);

    mapRef.current = map;

    return () => {
      map.off('click', handleClick);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const routeMap = new Map(routeOrder.map((id, i) => [id, i]));
    const currentIds = new Set(stops.map((s) => s.id));
    const existingIds = new Set(markersRef.current.keys());

    // Remove deleted markers
    existingIds.forEach((id) => {
      if (!currentIds.has(id)) {
        const existing = markersRef.current.get(id);
        if (existing) map.removeLayer(existing);
        markersRef.current.delete(id);
      }
    });

    // Add/update markers
    stops.forEach((stop) => {
      const orderIndex = routeMap.get(stop.id) ?? -1;
      const existing = markersRef.current.get(stop.id);

      if (!existing) {
        const marker = L.marker([stop.lat, stop.lng], {
          icon: makeIcon(orderIndex, mode),
          draggable: mode === 'edit',
        })
          .bindPopup(`<div style="font-family:system-ui;font-size:14px"><b>${stop.name}</b><br/>${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}</div>`)
          .addTo(map);

        if (mode === 'edit') {
          marker.on('dragend', (e: L.DragEndEvent) => {
            const latlng = (e.target as L.Marker).getLatLng();
            store.updateStopPosition(stop.id, latlng.lat, latlng.lng);
          });
        }

        markersRef.current.set(stop.id, marker);
      } else {
        existing.setIcon(makeIcon(orderIndex, mode));
        existing.setPopupContent(`<div style="font-family:system-ui;font-size:14px"><b>${stop.name}</b><br/>${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}</div>`);
        existing.setLatLng([stop.lat, stop.lng]);
      }
    });
  }, [stops, routeOrder, mode, makeIcon]);

  // Update route line + edit handles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    if (routeOrder.length >= 2) {
      const latlngs = routeOrder
        .map((id) => stops.find((s) => s.id === id))
        .filter(Boolean)
        .map((s) => [s!.lat, s!.lng] as [number, number]);

      const isDraw = mode === 'draw';
      routeLineRef.current = L.polyline(latlngs, {
        color: isDraw ? '#3b82f6' : '#f59e0b',
        weight: isDraw ? 3 : 5,
        opacity: 0.85,
        dashArray: isDraw ? '8, 6' : undefined,
        lineJoin: 'round',
      }).addTo(map);

      // In edit mode, add click handler on the line to insert stops
      if (mode === 'edit') {
        routeLineRef.current.on('click', (e: L.LeafletMouseEvent) => {
          lineClickRef.current(e.latlng.lat, e.latlng.lng);
        });
      }
    }

    // Update edit handles
    const currentIds = new Set(routeOrder);
    const existingHandles = new Set(editHandlesRef.current.keys());

    // Remove deleted handles
    existingHandles.forEach((id) => {
      if (!currentIds.has(id)) {
        const handle = editHandlesRef.current.get(id);
        if (handle) map.removeLayer(handle);
        editHandlesRef.current.delete(id);
      }
    });

    // Add/update handles
    routeOrder.forEach((id) => {
      const stop = stops.find((s) => s.id === id);
      if (!stop) return;

      const existing = editHandlesRef.current.get(id);
      if (!existing) {
        const handle = L.marker([stop.lat, stop.lng], {
          icon: makeHandleIcon(),
          interactive: true,
        }).addTo(map);

        // Double-click handle to remove stop
        handle.on('dblclick', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          removeRef.current(id);
        });

        editHandlesRef.current.set(id, handle);
      } else {
        existing.setLatLng([stop.lat, stop.lng]);
      }
    });
  }, [stops, routeOrder, mode, makeHandleIcon]);

  return <div ref={containerRef} className="w-full h-full" />;
}
