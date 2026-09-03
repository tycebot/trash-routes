import { describe, expect, it } from 'vitest';
import { LODI_RETRIEVED_ON, LODI_ROUTE, LODI_SOURCE_URL } from './lodiRoute';

describe('Lodi demo fixture', () => {
  it('contains exactly 100 stable, sequenced public POIs', () => {
    expect(LODI_ROUTE.stops).toHaveLength(100);
    expect(new Set(LODI_ROUTE.stops.map((stop) => stop.id)).size).toBe(100);
    expect(LODI_ROUTE.stops.map((stop) => stop.sequence)).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 1),
    );
    expect(LODI_ROUTE.stops.every((stop) => stop.name.length > 0)).toBe(true);
    expect(LODI_ROUTE.route?.coordinates.length).toBeGreaterThanOrEqual(16);
    expect(LODI_SOURCE_URL).toBe('https://www.openstreetmap.org/copyright');
    expect(LODI_RETRIEVED_ON).toBe('2026-09-03');
  });

  it('does not include residential-only source objects', () => {
    const forbidden = new Set(['house', 'apartments', 'residential']);
    expect(LODI_ROUTE.stops.every((stop) =>
      ![...forbidden].some((word) => stop.name.toLowerCase().includes(word)),
    )).toBe(true);
  });
});
