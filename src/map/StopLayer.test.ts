import { expect, it } from 'vitest';
import { STOP_LAYER_DEFINITIONS, stopsToGeoJson } from './StopLayer';

it('keeps all stops visible while labels appear at neighborhood zoom', () => {
  const data = stopsToGeoJson([
    { id: 'a', name: 'City Hall', lat: 38.13, lng: -121.27, sequence: 1 },
  ], 'a');
  expect(data.features[0].properties).toMatchObject({ id: 'a', sequence: 1, selected: true });
  expect(STOP_LAYER_DEFINITIONS.point.minzoom).toBe(0);
  expect(STOP_LAYER_DEFINITIONS.label.minzoom).toBe(13);
  expect(STOP_LAYER_DEFINITIONS.label.layout?.['symbol-sort-key']).toEqual(['get', 'sequence']);
});
