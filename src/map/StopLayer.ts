import type { FeatureCollection, Point } from 'geojson';
import type { CircleLayerSpecification, SymbolLayerSpecification } from 'maplibre-gl';
import type { TrashStop } from '../domain/routeDocument';

interface StopProperties {
  id: string;
  name: string;
  sequence: number | null;
  selected: boolean;
  configured: boolean;
}

export function stopsToGeoJson(
  stops: TrashStop[],
  stopOrder: string[],
  selectedStopId: string | null,
): FeatureCollection<Point, StopProperties> {
  const sequenceById = new Map(stopOrder.map((id, index) => [id, index + 1]));
  return {
    type: 'FeatureCollection',
    features: stops.map((stop) => {
      const sequence = sequenceById.get(stop.id) ?? null;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [stop.lng, stop.lat] },
        properties: {
          id: stop.id,
          name: stop.name,
          sequence,
          selected: stop.id === selectedStopId,
          configured: sequence !== null,
        },
      };
    }),
  };
}

const halo: CircleLayerSpecification = {
  id: 'stop-halo',
  type: 'circle',
  source: 'stops',
  minzoom: 0,
  paint: {
    'circle-radius': ['case', ['get', 'selected'], 11, 8],
    'circle-color': ['case', ['get', 'selected'], '#f59e0b', 'rgba(79, 70, 229, 0.22)'],
    'circle-opacity': ['case', ['get', 'selected'], 0.32, 0.5],
  },
};

const point: CircleLayerSpecification = {
  id: 'stop-point',
  type: 'circle',
  source: 'stops',
  minzoom: 0,
  paint: {
    'circle-radius': ['case', ['get', 'selected'], 6.5, 5],
    'circle-color': '#ffffff',
    'circle-stroke-width': ['case', ['get', 'selected'], 3, 2],
    'circle-stroke-color': ['case', ['get', 'selected'], '#d97706', '#4f46e5'],
  },
};

const label: SymbolLayerSpecification = {
  id: 'stop-label',
  type: 'symbol',
  source: 'stops',
  minzoom: 13,
  layout: {
    'text-field': ['case', ['get', 'configured'], ['to-string', ['get', 'sequence']], ''],
    'text-size': 11,
    'text-font': ['Noto Sans Bold'],
    'text-allow-overlap': false,
    'symbol-sort-key': ['coalesce', ['get', 'sequence'], 9999],
  },
  paint: {
    'text-color': '#24262b',
    'text-halo-color': '#ffffff',
    'text-halo-width': 2,
  },
};

export const STOP_LAYER_DEFINITIONS = { halo, point, label } as const;
