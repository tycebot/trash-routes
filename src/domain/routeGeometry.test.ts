import { describe, expect, it } from 'vitest';
import { routeMiles, stopOrderToGeometry } from './routeGeometry';

const stops = [
  { id: 'a', name: 'A', lat: 38.13, lng: -121.28 },
  { id: 'b', name: 'B', lat: 38.14, lng: -121.27 },
  { id: 'c', name: 'C', lat: 38.15, lng: -121.26 },
];

describe('stopOrderToGeometry', () => {
  it('creates a line in the requested stop order', () => {
    expect(stopOrderToGeometry(stops, ['c', 'a', 'b'])).toEqual({
      coordinates: [[-121.26, 38.15], [-121.28, 38.13], [-121.27, 38.14]],
    });
  });

  it('creates a live preview after two stops even when more stops remain', () => {
    expect(stopOrderToGeometry(stops, ['a', 'b'])).toEqual({
      coordinates: [[-121.28, 38.13], [-121.27, 38.14]],
    });
  });

  it('returns null for fewer than two stops, duplicates, or unknown IDs', () => {
    expect(stopOrderToGeometry([], [])).toBeNull();
    expect(stopOrderToGeometry(stops, ['a'])).toBeNull();
    expect(stopOrderToGeometry(stops, ['a', 'a', 'b'])).toBeNull();
    expect(stopOrderToGeometry(stops, ['a', 'b', 'missing'])).toBeNull();
  });
});

describe('routeMiles', () => {
  it('uses route geometry and returns a known great-circle distance', () => {
    expect(routeMiles({ coordinates: [[-121.2722, 38.1342], [-121.2801, 38.1306]] }))
      .toBeCloseTo(0.52, 1);
    expect(routeMiles(null)).toBe(0);
  });
});
