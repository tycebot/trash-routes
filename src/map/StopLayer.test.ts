import { expect, it } from 'vitest';
import { STOP_LAYER_DEFINITIONS, stopsToGeoJson } from './StopLayer';

const stops = [
  { id: 'a', name: 'City Hall', lat: 38.13, lng: -121.27 },
  { id: 'b', name: 'Library', lat: 38.14, lng: -121.28 },
];

it('projects configured sequence numbers and keeps unconfigured stops unlabeled', () => {
  const data = stopsToGeoJson(stops, ['b', 'a'], 'a');
  expect(data.features.map((feature) => feature.properties)).toEqual([
    { id: 'a', name: 'City Hall', sequence: 2, selected: true, configured: true },
    { id: 'b', name: 'Library', sequence: 1, selected: false, configured: true },
  ]);
  expect(STOP_LAYER_DEFINITIONS.point.minzoom).toBe(0);
  expect(STOP_LAYER_DEFINITIONS.label.minzoom).toBe(13);
  expect(STOP_LAYER_DEFINITIONS.label.layout?.['symbol-sort-key']).toEqual(['coalesce', ['get', 'sequence'], 9999]);
});

it('does not label stops while a day has no configured order', () => {
  const data = stopsToGeoJson(stops, [], null);
  expect(data.features.every((feature) => feature.properties.configured === false)).toBe(true);
});
