import type { FeatureCollection, LineString } from 'geojson';
import type { LineLayerSpecification } from 'maplibre-gl';
import type { RouteGeometry } from '../domain/routeDocument';

export type RouteLayerKind = 'saved' | 'reference' | 'draft';

export function routeToGeoJson(route: RouteGeometry | null): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: route ? [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: route.coordinates },
    }] : [],
  };
}

export function routeLayerDefinitions(kind: RouteLayerKind): [LineLayerSpecification, LineLayerSpecification] {
  const reference = kind === 'reference';
  const source = `${kind}-route`;
  const common = { 'line-cap': 'round', 'line-join': 'round' } as const;
  return [
    {
      id: `${kind}-route-casing`,
      type: 'line',
      source,
      layout: common,
      paint: {
        'line-color': '#ffffff',
        'line-width': reference ? 5 : 8,
        'line-opacity': reference ? 0.42 : 0.96,
      },
    },
    {
      id: `${kind}-route-line`,
      type: 'line',
      source,
      layout: common,
      paint: {
        'line-color': kind === 'draft' ? '#d97706' : '#4f46e5',
        'line-width': reference ? 3 : 5,
        'line-opacity': reference ? 0.34 : 0.92,
      },
    },
  ];
}
