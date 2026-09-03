import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { RouteGeometry, RouteMode, TrashStop } from '../domain/routeDocument';
import type { ScreenGeoPoint } from '../domain/routeGeometry';
import { routeLayerDefinitions, routeToGeoJson, type RouteLayerKind } from './RouteLayer';
import { STOP_LAYER_DEFINITIONS, stopsToGeoJson } from './StopLayer';

export type MapPresentation = '2d' | '3d';
export type MapError = 'unsupported' | 'initialization' | 'style' | null;

export interface RouteMapProps {
  stops: TrashStop[];
  selectedStopId: string | null;
  savedRoute: RouteGeometry | null;
  referenceRoute: RouteGeometry | null;
  draftRoute: RouteGeometry | null;
  mode: RouteMode;
  presentation: MapPresentation;
  drawingActive: boolean;
  onSelectStop(id: string): void;
  onStrokeStart(point: ScreenGeoPoint): void;
  onStrokePoint(point: ScreenGeoPoint): void;
  onStrokeEnd(point: ScreenGeoPoint): void;
  onMapError(error: MapError): void;
}

const ROUTE_KINDS: RouteLayerKind[] = ['saved', 'reference', 'draft'];

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
        if (map.getLayer('natural_earth')) map.setPaintProperty('natural_earth', 'raster-saturation', -0.15);
        for (const kind of ROUTE_KINDS) {
          const sourceId = `${kind}-route`;
          if (!map.getSource(sourceId)) map.addSource(sourceId, { type: 'geojson', data: routeToGeoJson(null) });
          for (const layer of routeLayerDefinitions(kind)) if (!map.getLayer(layer.id)) map.addLayer(layer);
        }
        if (!map.getSource('stops')) map.addSource('stops', { type: 'geojson', data: stopsToGeoJson([], null) });
        for (const layer of Object.values(STOP_LAYER_DEFINITIONS)) {
          if (!map.getLayer(layer.id)) map.addLayer(layer);
        }
        const current = propsRef.current;
        (map.getSource('stops') as GeoJSONSource | undefined)?.setData(
          stopsToGeoJson(current.stops, current.selectedStopId),
        );
        for (const [kind, route] of [
          ['saved', current.savedRoute],
          ['reference', current.referenceRoute],
          ['draft', current.draftRoute],
        ] as const) {
          (map.getSource(`${kind}-route`) as GeoJSONSource | undefined)?.setData(routeToGeoJson(route));
        }
        const is3d = current.presentation === '3d';
        map.easeTo(is3d
          ? { pitch: 55, bearing: -12, duration: 500 }
          : { pitch: 0, bearing: 0, duration: 500 });
        if (map.getLayer('building-3d')) {
          map.setLayoutProperty('building-3d', 'visibility', is3d ? 'visible' : 'none');
        }
        setLoadedGeneration(generation);
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
      stops: stopsToGeoJson(props.stops, props.selectedStopId),
      saved: routeToGeoJson(props.savedRoute),
      reference: routeToGeoJson(props.referenceRoute),
      draft: routeToGeoJson(props.draftRoute),
    };
    (map.getSource('stops') as GeoJSONSource | undefined)?.setData(sourceData.stops);
    for (const kind of ROUTE_KINDS) {
      (map.getSource(`${kind}-route`) as GeoJSONSource | undefined)?.setData(sourceData[kind]);
    }
  }, [generation, loadedGeneration, props.stops, props.selectedStopId, props.savedRoute, props.referenceRoute, props.draftRoute]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadedGeneration !== generation) return;
    const is3d = props.presentation === '3d';
    map.easeTo(is3d
      ? { pitch: 55, bearing: -12, duration: 500 }
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

  const pointFromEvent = (event: ReactPointerEvent<HTMLDivElement>): ScreenGeoPoint | null => {
    const map = mapRef.current;
    if (!map) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const geographic = map.unproject([x, y]);
    return { x, y, lng: geographic.lng, lat: geographic.lat, time: event.timeStamp };
  };

  const canDraw = props.drawingActive && (props.mode === 'draw' || props.mode === 'edit');
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDraw || activePointerRef.current !== null) return;
    const point = pointFromEvent(event);
    if (!point) return;
    activePointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    mapRef.current?.dragPan.disable();
    props.onStrokeStart(point);
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    const point = pointFromEvent(event);
    if (point) props.onStrokePoint(point);
  };
  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    const point = pointFromEvent(event);
    if (point) props.onStrokeEnd(point);
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
