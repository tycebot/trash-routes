import { describe, expect, it } from 'vitest';
import { migrateRouteDocument, orderedStops, parseRouteDocument, RouteDocumentError } from './routeDocument';

const validV2 = {
  schemaVersion: 2,
  routes: [{
    id: 'lodi-demo',
    name: 'Lodi Demo Route',
    days: [{
      id: 'monday',
      name: 'Monday',
      stops: [
        { id: 'a', name: 'Stop A', lat: 38.13, lng: -121.28 },
        { id: 'b', name: 'Stop B', lat: 38.14, lng: -121.27 },
      ],
      stopOrder: ['b', 'a'],
    }],
  }],
};

const validV1 = {
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
  it('parses one route containing multiple days and ordered stop IDs', () => {
    const document = parseRouteDocument(validV2);
    expect(document.routes[0].days[0].stopOrder).toEqual(['b', 'a']);
    expect(document).not.toBe(validV2);
  });

  it('allows an empty order for a day that has not been configured', () => {
    const document = parseRouteDocument({
      ...validV2,
      routes: [{ ...validV2.routes[0], days: [{ ...validV2.routes[0].days[0], stopOrder: [] }] }],
    });
    expect(document.routes[0].days[0].stopOrder).toEqual([]);
  });

  it('migrates a legacy document into one route and one day', () => {
    const migrated = migrateRouteDocument(validV1);
    expect(migrated).toMatchObject({
      schemaVersion: 2,
      routes: [{
        id: 'lodi-demo',
        name: 'Lodi Route Review',
        days: [{ id: 'lodi-demo-day-1', name: 'Route day', stopOrder: ['osm-node-1', 'osm-node-2'] }],
      }],
    });
    expect((migrated as typeof validV2).routes[0].days[0].stops[0]).toEqual({
      id: 'osm-node-1', name: 'Lodi City Hall', lat: 38.1342, lng: -121.2722,
    });
  });

  it('returns stops in the configured order', () => {
    const document = parseRouteDocument(validV2);
    expect(orderedStops(document.routes[0].days[0]).map((stop) => stop.id)).toEqual(['b', 'a']);
  });

  it.each([
    [{ ...validV2, schemaVersion: 1 }, 'schemaVersion'],
    [{ ...validV2, routes: [{ ...validV2.routes[0], id: ' ' }] }, 'routes[0].id'],
    [{ ...validV2, routes: [{ ...validV2.routes[0], days: [validV2.routes[0].days[0], validV2.routes[0].days[0]] }] }, 'days[1].id'],
    [{ ...validV2, routes: [{ ...validV2.routes[0], days: [{ ...validV2.routes[0].days[0], stops: [validV2.routes[0].days[0].stops[0], validV2.routes[0].days[0].stops[0]] }] }] }, 'stops[1].id'],
    [{ ...validV2, routes: [{ ...validV2.routes[0], days: [{ ...validV2.routes[0].days[0], stopOrder: ['b', 'b'] }] }] }, 'stopOrder[1]'],
    [{ ...validV2, routes: [{ ...validV2.routes[0], days: [{ ...validV2.routes[0].days[0], stopOrder: ['missing', 'a'] }] }] }, 'stopOrder[0]'],
    [{ ...validV2, routes: [{ ...validV2.routes[0], days: [{ ...validV2.routes[0].days[0], stops: [{ ...validV2.routes[0].days[0].stops[0], lat: 91 }] }] }] }, 'stops[0].lat'],
    [{ ...validV2, routes: [{ ...validV2.routes[0], days: [{ ...validV2.routes[0].days[0], stopOrder: ['a'] }] }] }, 'stopOrder'],
  ])('rejects invalid input at %s', (input, field) => {
    expect(() => parseRouteDocument(input)).toThrow(RouteDocumentError);
    expect(() => parseRouteDocument(input)).toThrow(field);
  });
});
