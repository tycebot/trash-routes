import { describe, expect, it } from 'vitest';
import { parseRouteDocument, RouteDocumentError } from './routeDocument';

const valid = {
  schemaVersion: 1,
  routeId: 'lodi-demo',
  routeName: 'Lodi Route Review',
  stops: [
    { id: 'osm-node-1', name: 'Lodi City Hall', lat: 38.1342, lng: -121.2722, sequence: 1 },
    { id: 'osm-node-2', name: 'Lodi Public Library', lat: 38.1306, lng: -121.2801, sequence: 2 },
  ],
  route: { coordinates: [[-121.2722, 38.1342], [-121.2801, 38.1306]] },
};

describe('parseRouteDocument', () => {
  it('returns an isolated schema-v1 document', () => {
    const parsed = parseRouteDocument(valid);
    expect(parsed).toEqual(valid);
    expect(parsed).not.toBe(valid);
  });

  it.each([
    [{ ...valid, schemaVersion: 2 }, 'schemaVersion'],
    [{ ...valid, stops: [{ ...valid.stops[0], lat: 91 }] }, 'stops[0].lat'],
    [{ ...valid, stops: [valid.stops[0], { ...valid.stops[1], id: valid.stops[0].id }] }, 'stops[1].id'],
    [{ ...valid, stops: [valid.stops[0], { ...valid.stops[1], sequence: 3 }] }, 'stops[1].sequence'],
    [{ ...valid, route: { coordinates: [[-121.27, 38.13]] } }, 'route.coordinates'],
  ])('rejects invalid input at %s', (input, field) => {
    expect(() => parseRouteDocument(input)).toThrow(RouteDocumentError);
    expect(() => parseRouteDocument(input)).toThrow(field);
  });
});
