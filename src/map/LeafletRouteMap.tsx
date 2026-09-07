import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import L, { type LayerGroup, type Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RouteGeometry, TrashStop } from '../domain/routeDocument';
import type { RouteMapProps } from './RouteMap';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function routeLatLngs(route: RouteGeometry | null): Array<[number, number]> {
  return route?.coordinates.map(([lng, lat]) => [lat, lng]) ?? [];
}

function addRoute(group: LayerGroup, route: RouteGeometry | null, color: string, opacity: number, weight: number): void {
  const points = routeLatLngs(route);
  if (points.length < 2) return;
  L.polyline(points, { color: '#ffffff', opacity: opacity * 0.9, weight: weight + 3, lineCap: 'round', lineJoin: 'round' }).addTo(group);
  L.polyline(points, { color, opacity, weight, lineCap: 'round', lineJoin: 'round' }).addTo(group);
}

function frameStops(map: LeafletMap, stops: TrashStop[]): void {
  if (stops.length < 2) return;
  const bounds = L.latLngBounds(stops.map((stop) => [stop.lat, stop.lng] as [number, number]));
  const desktop = window.innerWidth >= 1280;
  const tablet = window.innerWidth > 720 && !desktop;
  map.fitBounds(bounds, {
    paddingTopLeft: desktop ? [56, 56] : tablet ? [380, 56] : [40, 220],
    paddingBottomRight: desktop ? [56, 56] : [56, 56],
    maxZoom: 14,
    animate: false,
  });
}

interface LeafletRouteMapProps extends RouteMapProps {
  webglUnavailable?: boolean;
}

export function LeafletRouteMap(props: LeafletRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LayerGroup | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const propsRef = useRef(props);

  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = L.map(container, { zoomControl: true, attributionControl: true }).setView([38.1342, -121.2722], 13);
    const tiles = L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION, detectRetina: true }).addTo(map);
    layersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    propsRef.current.onMapError(null);
    tiles.on('tileerror', () => propsRef.current.onMapError('style'));
    frameStops(map, propsRef.current.stops);

    return () => {
      activePointerRef.current = null;
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layersRef.current;
    if (!map || !group) return;
    group.clearLayers();
    addRoute(group, props.referenceRoute, '#4f46e5', 0.3, 3);
    addRoute(group, props.savedRoute, '#4f46e5', 0.92, 5);
    addRoute(group, props.draftRoute, '#d97706', 0.96, 5);

    const sequenceById = new Map(props.displayOrder.map((id, index) => [id, index + 1]));
    for (const stop of props.stops) {
      const sequence = sequenceById.get(stop.id) ?? null;
      const endpoint = sequence === 1 ? 'start' : sequence === props.displayOrder.length && props.displayOrder.length > 1 ? 'finish' : 'none';
      const selected = stop.id === props.selectedStopId;
      const color = endpoint === 'start' ? '#16a34a' : endpoint === 'finish' ? '#dc2626' : selected ? '#d97706' : '#4f46e5';
      const marker = L.circleMarker([stop.lat, stop.lng], {
        radius: endpoint === 'none' ? selected ? 7 : 5 : 7,
        color,
        fillColor: endpoint === 'none' ? '#ffffff' : color,
        fillOpacity: 1,
        opacity: 1,
        weight: selected ? 3 : 2,
      }).addTo(group);
      marker.on('click', () => {
        if (!propsRef.current.drawingActive) propsRef.current.onSelectStop(stop.id);
      });
      if (sequence !== null) {
        marker.bindTooltip(String(sequence), {
          permanent: true,
          direction: 'center',
          className: 'leaflet-stop-sequence',
        });
      }
      if (endpoint !== 'none') {
        marker.bindTooltip(endpoint.toUpperCase(), {
          permanent: true,
          direction: 'bottom',
          offset: [0, 8],
          className: `leaflet-endpoint-label ${endpoint}`,
        }).openTooltip();
      }
    }
  }, [props.displayOrder, props.draftRoute, props.referenceRoute, props.savedRoute, props.selectedStopId, props.stops]);

  useEffect(() => {
    if (props.drawingActive && (props.mode === 'draw' || props.mode === 'edit')) return;
    activePointerRef.current = null;
    mapRef.current?.dragging.enable();
  }, [props.drawingActive, props.mode]);

  const stopAtPoint = (event: ReactPointerEvent<HTMLDivElement>): string | null => {
    const map = mapRef.current;
    if (!map) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const pointer = L.point(event.clientX - rect.left, event.clientY - rect.top);
    return props.stops
      .map((stop) => ({ stop, distance: map.latLngToContainerPoint([stop.lat, stop.lng]).distanceTo(pointer) }))
      .filter(({ distance }) => distance <= 18)
      .sort((left, right) => left.distance - right.distance)[0]?.stop.id ?? null;
  };

  const canSequence = props.drawingActive && (props.mode === 'draw' || props.mode === 'edit');
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canSequence || activePointerRef.current !== null) return;
    const stopId = stopAtPoint(event);
    if (!stopId) return;
    event.preventDefault();
    event.stopPropagation();
    activePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    mapRef.current?.dragging.disable();
    props.onSequenceStart();
    props.onStopContact(stopId);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    const stopId = stopAtPoint(event);
    if (stopId) props.onStopContact(stopId);
  };
  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    const stopId = stopAtPoint(event);
    if (stopId) props.onStopContact(stopId);
    props.onSequenceEnd();
    activePointerRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    mapRef.current?.dragging.enable();
  };

  return (
    <div className="route-map-frame fallback-route-map" data-testid="fallback-route-map" data-map-engine="leaflet">
      <div className="compatibility-badge">
        {props.webglUnavailable ? '3D requires WebGL · showing 2D' : 'Detailed map · 2D'}
      </div>
      <div
        ref={containerRef}
        className="leaflet-route-map"
        data-testid="route-map"
        style={{ touchAction: canSequence ? 'none' : 'pan-x pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      />
    </div>
  );
}
