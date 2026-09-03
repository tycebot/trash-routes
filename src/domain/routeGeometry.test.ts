import { describe, expect, it } from 'vitest';
import { processDrawnPoints, routeMiles } from './routeGeometry';

const point = (x: number, y: number, lng: number, lat: number, time: number) =>
  ({ x, y, lng, lat, time });

describe('processDrawnPoints', () => {
  it('throttles, filters, smooths, simplifies, and preserves endpoints', () => {
    const input = [
      point(0, 0, -121.2800, 38.1300, 0),
      point(1, 1, -121.2799, 38.1301, 4),
      point(8, 0, -121.2790, 38.1300, 20),
      point(16, 8, -121.2780, 38.1310, 40),
      point(24, 8, -121.2770, 38.1310, 60),
    ];
    const route = processDrawnPoints(input, {
      throttleMs: 16,
      minimumScreenDistancePx: 4,
      smoothingWindow: 3,
      simplifyTolerancePx: 1.5,
    });
    expect(route?.coordinates[0]).toEqual([-121.28, 38.13]);
    expect(route?.coordinates.at(-1)).toEqual([-121.277, 38.131]);
    expect(route!.coordinates.length).toBeLessThan(input.length);
  });

  it('rejects fewer than two distinct coordinates', () => {
    expect(processDrawnPoints([point(0, 0, -121.28, 38.13, 0)])).toBeNull();
  });
});

describe('routeMiles', () => {
  it('uses route geometry and returns a known great-circle distance', () => {
    expect(routeMiles({ coordinates: [[-121.2722, 38.1342], [-121.2801, 38.1306]] }))
      .toBeCloseTo(0.52, 1);
    expect(routeMiles(null)).toBe(0);
  });
});
