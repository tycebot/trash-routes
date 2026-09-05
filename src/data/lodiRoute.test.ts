import { describe, expect, it } from 'vitest';
import { routeMiles, stopOrderToGeometry } from '../domain/routeGeometry';
import { LODI_RETRIEVED_ON, LODI_ROUTE, LODI_SOURCE_URL } from './lodiRoute';

describe('Lodi demo fixture', () => {
  it('contains one route with several days and exactly 100 stable public POIs', () => {
    expect(LODI_ROUTE.schemaVersion).toBe(2);
    expect(LODI_ROUTE.routes).toHaveLength(1);
    expect(LODI_ROUTE.routes[0].days).toHaveLength(5);
    expect(LODI_ROUTE.routes[0].days.flatMap((day) => day.stops)).toHaveLength(100);
    expect(new Set(LODI_ROUTE.routes[0].days.flatMap((day) => day.stops.map((stop) => stop.id))).size).toBe(100);
    expect(LODI_ROUTE.routes[0].days.every((day) =>
      day.stopOrder.length === day.stops.length && new Set(day.stopOrder).size === day.stops.length,
    )).toBe(true);
    expect(LODI_ROUTE.routes[0].days.flatMap((day) => day.stops).every((stop) => stop.name.length > 0)).toBe(true);
    expect(LODI_SOURCE_URL).toBe('https://www.openstreetmap.org/copyright');
    expect(LODI_RETRIEVED_ON).toBe('2026-09-03');
  });

  it('routes through every day’s stop sequence', () => {
    for (const day of LODI_ROUTE.routes[0].days) {
      expect(stopOrderToGeometry(day.stops, day.stopOrder)?.coordinates).toEqual(
        day.stopOrder.map((id) => {
          const stop = day.stops.find((candidate) => candidate.id === id)!;
          return [stop.lng, stop.lat];
        }),
      );
    }
  });

  it('uses compact visit orders without cross-region jumps', () => {
    for (const day of LODI_ROUTE.routes[0].days) {
      expect(routeMiles(stopOrderToGeometry(day.stops, day.stopOrder))).toBeLessThan(15);
    }
  });

  it('does not include residential-only source objects', () => {
    const forbidden = new Set(['house', 'apartments', 'residential']);
    expect(LODI_ROUTE.routes[0].days.flatMap((day) => day.stops).every((stop) =>
      ![...forbidden].some((word) => stop.name.toLowerCase().includes(word)),
    )).toBe(true);
  });
});
