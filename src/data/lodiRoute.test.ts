import { describe, expect, it } from 'vitest';
import { routeMiles, stopOrderToGeometry } from '../domain/routeGeometry';
import { LODI_RETRIEVED_ON, LODI_ROUTE, LODI_SOURCE_URL } from './lodiRoute';

describe('Lodi demo fixture', () => {
  it('contains one route with five 100-stop route days', () => {
    expect(LODI_ROUTE.schemaVersion).toBe(2);
    expect(LODI_ROUTE.routes).toHaveLength(1);
    expect(LODI_ROUTE.routes[0].days).toHaveLength(5);
    const expectedStopIds = new Set(LODI_ROUTE.routes[0].days[0].stops.map((stop) => stop.id));
    for (const day of LODI_ROUTE.routes[0].days) {
      expect(day.stops).toHaveLength(100);
      expect(new Set(day.stops.map((stop) => stop.id))).toEqual(expectedStopIds);
      expect(day.stopOrder).toHaveLength(100);
      expect(new Set(day.stopOrder)).toEqual(expectedStopIds);
      expect(day.stops.every((stop) => stop.name.length > 0)).toBe(true);
    }
    expect(new Set(LODI_ROUTE.routes[0].days.map((day) => day.stopOrder.join('|'))).size).toBe(5);
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

  it('keeps the demonstration route compact enough to explain at a glance', () => {
    const monday = LODI_ROUTE.routes[0].days[0];
    expect(routeMiles(stopOrderToGeometry(monday.stops, monday.stopOrder))).toBeLessThan(7);
    const stopsById = new Map(monday.stops.map((stop) => [stop.id, stop]));
    for (let index = 1; index < monday.stopOrder.length; index += 1) {
      const pair = [monday.stopOrder[index - 1], monday.stopOrder[index]]
        .map((id) => stopsById.get(id)!);
      expect(routeMiles({ coordinates: pair.map((stop) => [stop.lng, stop.lat]) })).toBeLessThan(0.5);
    }
  });

  it('does not include residential-only source objects', () => {
    const forbidden = new Set(['apartments', 'residential']);
    expect(LODI_ROUTE.routes[0].days.flatMap((day) => day.stops).every((stop) =>
      ![...forbidden].some((word) => stop.name.toLowerCase().includes(word)),
    )).toBe(true);
  });
});
