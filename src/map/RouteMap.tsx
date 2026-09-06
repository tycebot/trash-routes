import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { RouteGeometry, RouteMode, TrashStop } from '../domain/routeDocument';
import { routeLayerDefinitions, routeToGeoJson, type RouteLayerKind } from './RouteLayer';
import { STOP_LAYER_DEFINITIONS, stopsToGeoJson } from './StopLayer';

export type MapPresentation = '2d' | '3d';
export type MapError = 'unsupported' | 'initialization' | 'style' | null;

export interface RouteMapProps {
  stops: TrashStop[];
  displayOrder: string[];
  selectedStopId: string | null;
  savedRoute: RouteGeometry | null;
  referenceRoute: RouteGeometry | null;
  draftRoute: RouteGeometry | null;
  mode: RouteMode;
  presentation: MapPresentation;
  drawingActive: boolean;
  onSelectStop(id: string): void;
  onSequenceStart(): void;
  onStopContact(id: string): void;
  onSequenceEnd(): void;
  onMapError(error: MapError): void;
}

maplibregl.setWorkerUrl(mapLibreWorkerUrl);

const ROUTE_KINDS: RouteLayerKind[] = ['saved', 'reference', 'draft'];

function frameStops(map: MapLibreMap, stops: TrashStop[]): void {
  if (stops.length < 2) return;
  const lngs = stops.map((stop) => stop.lng);
  const lats = stops.map((stop) => stop.lat);
  const bounds: [[number, number], [number, number]] = [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
  const padding = window.innerWidth >= 1280
    ? { top: 56, right: 56, bottom: 56, left: 56 }
    : window.innerWidth > 720
      ? { top: 56, right: 56, bottom: 56, left: 380 }
      : { top: 220, right: 40, bottom: 56, left: 40 };
  map.fitBounds(bounds, { padding, maxZoom: 14, duration: 0 });
}

function mapSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function RouteMap(props: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const propsRef = useRef(props);
  const [generation, setGeneration] = useState(0);
  const [loadedGeneration, setLoadedGeneration] = useState(-1);
  const [mapError, setMapError] = useState<MapError>(() => mapSupported() ? null : 'unsupported');

  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  const reportError = (error: MapError) => {
    setMapError(error);
    propsRef.current.onMapError(error);
  };

  useEffect(() => {
    if (!mapSupported()) {
      propsRef.current.onMapError('unsupported');
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [-121.2722, 38.1342],
        zoom: 12,
      });
    } catch {
      queueMicrotask(() => reportError('initialization'));
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      try {
        const current = propsRef.current;
        const routes = {
          saved: current.savedRoute,
          reference: current.referenceRoute,
          draft: current.draftRoute,
        };
        if (map.getLayer('natural_earth')) map.setPaintProperty('natural_earth', 'raster-saturation', -0.15);
        for (const kind of ROUTE_KINDS) {
          const sourceId = `${kind}-route`;
          if (!map.getSource(sourceId)) map.addSource(sourceId, { type: 'geojson', data: routeToGeoJson(routes[kind]) });
          for (const layer of routeLayerDefinitions(kind)) if (!map.getLayer(layer.id)) map.addLayer(layer);
        }
        if (!map.getSource('stops')) {
          map.addSource('stops', { type: 'geojson', data: stopsToGeoJson(current.stops, current.displayOrder, current.selectedStopId) });
        }
        for (const layer of Object.values(STOP_LAYER_DEFINITIONS)) {
          if (!map.getLayer(layer.id)) map.addLayer(layer);
        }
        (map.getSource('stops') as GeoJSONSource | undefined)?.setData(
          stopsToGeoJson(current.stops, current.displayOrder, current.selectedStopId),
        );
        for (const [kind, route] of [
          ['saved', current.savedRoute],
          ['reference', current.referenceRoute],
          ['draft', current.draftRoute],
        ] as const) {
          (map.getSource(`${kind}-route`) as GeoJSONSource | undefined)?.setData(routeToGeoJson(route));
        }
        frameStops(map, current.stops);
        const is3d = current.presentation === '3d';
        map.easeTo(is3d
          ? { pitch: 55, bearing: -12, zoom: Math.max(map.getZoom(), 15), duration: 700 }
          : { pitch: 0, bearing: 0, duration: 500 });
        if (map.getLayer('building-3d')) {
          map.setLayoutProperty('building-3d', 'visibility', is3d ? 'visible' : 'none');
        }
        map.once('idle', () => setLoadedGeneration(generation));
        setMapError(null);
        current.onMapError(null);
      } catch {
        reportError('style');
      }
    });

    map.on('click', 'stop-point', (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id;
      if (id !== undefined && id !== null) propsRef.current.onSelectStop(String(id));
    });
    map.on('error', () => reportError('style'));

    return () => {
      activePointerRef.current = null;
      map.dragPan.enable();
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [generation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadedGeneration !== generation) return;
    const sourceData = {
      stops: stopsToGeoJson(props.stops, props.displayOrder, props.selectedStopId),
      saved: routeToGeoJson(props.savedRoute),
      reference: routeToGeoJson(props.referenceRoute),
      draft: routeToGeoJson(props.draftRoute),
    };
    (map.getSource('stops') as GeoJSONSource | undefined)?.setData(sourceData.stops);
    for (const kind of ROUTE_KINDS) {
      (map.getSource(`${kind}-route`) as GeoJSONSource | undefined)?.setData(sourceData[kind]);
    }
  }, [generation, loadedGeneration, props.stops, props.displayOrder, props.selectedStopId, props.savedRoute, props.referenceRoute, props.draftRoute]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadedGeneration !== generation) return;
    const is3d = props.presentation === '3d';
    map.easeTo(is3d
      ? { pitch: 55, bearing: -12, zoom: Math.max(map.getZoom(), 15), duration: 700 }
      : { pitch: 0, bearing: 0, duration: 500 });
    if (map.getLayer('building-3d')) {
      map.setLayoutProperty('building-3d', 'visibility', is3d ? 'visible' : 'none');
    }
  }, [generation, loadedGeneration, props.presentation]);

  useEffect(() => {
    if (props.drawingActive && (props.mode === 'draw' || props.mode === 'edit')) return;
    activePointerRef.current = null;
    mapRef.current?.dragPan.enable();
  }, [props.drawingActive, props.mode]);

  const stopAtPoint = (event: ReactPointerEvent<HTMLDivElement>): string | null => {
    const map = mapRef.current;
    if (!map || loadedGeneration !== generation) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const radius = 16;
    const features = map.queryRenderedFeatures(
      [[x - radius, y - radius], [x + radius, y + radius]],
      { layers: ['stop-point'] },
    );
    return features
      .map((feature) => {
        const id = feature.properties?.id;
        if (id === undefined || feature.geometry.type !== 'Point') return null;
        const [lng, lat] = feature.geometry.coordinates as [number, number];
        const projected = map.project([lng, lat]);
        return { id: String(id), distance: Math.hypot(projected.x - x, projected.y - y) };
      })
      .filter((candidate): candidate is { id: string; distance: number } => candidate !== null)
      .sort((left, right) => left.distance - right.distance)[0]?.id ?? null;
  };

  const canDraw = props.drawingActive && (props.mode === 'draw' || props.mode === 'edit');
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDraw || activePointerRef.current !== null) return;
    const stopId = stopAtPoint(event);
    if (!stopId) return;
    activePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    mapRef.current?.dragPan.disable();
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
    mapRef.current?.dragPan.enable();
  };

  const retry = () => {
    setMapError(null);
    props.onMapError(null);
    setGeneration((value) => value + 1);
  };

  if (mapError === 'unsupported') {
    return <div className="map-message" role="alert">WebGL is unavailable in this browser. Route map rendering is not supported.</div>;
  }

  return (
    <div className="route-map-frame">
      <div
        ref={containerRef}
        data-testid="route-map"
        data-map-ready={loadedGeneration === generation ? 'true' : 'false'}
        aria-busy={loadedGeneration !== generation}
        className="route-map"
        style={{ touchAction: canDraw ? 'none' : 'pan-x pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      />
      {mapError && (
        <div className="map-error" role="alert">
          <span>{mapError === 'style' ? 'The map style could not be loaded.' : 'The map could not be initialized.'}</span>
          <button type="button" onClick={retry}>Retry map</button>
        </div>
      )}
    </div>
  );
}
