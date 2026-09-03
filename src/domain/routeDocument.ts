export type RouteMode = 'view' | 'draw' | 'edit';

export interface TrashStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  sequence: number;
}

export interface RouteGeometry {
  coordinates: Array<[longitude: number, latitude: number]>;
}

export interface RouteDocument {
  schemaVersion: 1;
  routeId: string;
  routeName: string;
  stops: TrashStop[];
  route: RouteGeometry | null;
}

export class RouteDocumentError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`${field}: ${message}`);
    this.field = field;
    this.name = 'RouteDocumentError';
  }
}

export function cloneRouteDocument(document: RouteDocument): RouteDocument {
  return structuredClone(document);
}

const record = (value: unknown, field: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RouteDocumentError(field, 'must be an object');
  }
  return value as Record<string, unknown>;
};

const text = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RouteDocumentError(field, 'must be a non-empty string');
  }
  return value.trim();
};

const coordinate = (value: unknown, field: string, min: number, max: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RouteDocumentError(field, `must be between ${min} and ${max}`);
  }
  return value;
};

export function parseRouteDocument(value: unknown): RouteDocument {
  const root = record(value, 'document');
  if (root.schemaVersion !== 1) throw new RouteDocumentError('schemaVersion', 'must equal 1');
  if (!Array.isArray(root.stops)) throw new RouteDocumentError('stops', 'must be an array');
  const ids = new Set<string>();
  const sequences = new Set<number>();
  const stops = root.stops.map((rawStop, index): TrashStop => {
    const field = `stops[${index}]`;
    const stop = record(rawStop, field);
    const id = text(stop.id, `${field}.id`);
    if (ids.has(id)) throw new RouteDocumentError(`${field}.id`, 'must be unique');
    ids.add(id);
    if (!Number.isInteger(stop.sequence) || (stop.sequence as number) < 1) {
      throw new RouteDocumentError(`${field}.sequence`, 'must be a positive integer');
    }
    const sequence = stop.sequence as number;
    if (sequences.has(sequence)) throw new RouteDocumentError(`${field}.sequence`, 'must be unique');
    sequences.add(sequence);
    return {
      id,
      name: text(stop.name, `${field}.name`),
      lat: coordinate(stop.lat, `${field}.lat`, -90, 90),
      lng: coordinate(stop.lng, `${field}.lng`, -180, 180),
      sequence,
    };
  });
  for (let sequence = 1; sequence <= stops.length; sequence += 1) {
    if (!sequences.has(sequence)) {
      throw new RouteDocumentError(`stops[${sequence - 1}].sequence`, `must contain ${sequence}`);
    }
  }
  let route: RouteGeometry | null = null;
  if (root.route !== null) {
    const rawRoute = record(root.route, 'route');
    if (!Array.isArray(rawRoute.coordinates) || rawRoute.coordinates.length < 2) {
      throw new RouteDocumentError('route.coordinates', 'must contain at least two points');
    }
    const coordinates = rawRoute.coordinates.map((rawPoint, index): [number, number] => {
      if (!Array.isArray(rawPoint) || rawPoint.length !== 2) {
        throw new RouteDocumentError(`route.coordinates[${index}]`, 'must be [longitude, latitude]');
      }
      return [
        coordinate(rawPoint[0], `route.coordinates[${index}][0]`, -180, 180),
        coordinate(rawPoint[1], `route.coordinates[${index}][1]`, -90, 90),
      ];
    });
    if (!coordinates.some((point) => point[0] !== coordinates[0][0] || point[1] !== coordinates[0][1])) {
      throw new RouteDocumentError('route.coordinates', 'must contain two distinct points');
    }
    route = { coordinates };
  }
  return cloneRouteDocument({
    schemaVersion: 1,
    routeId: text(root.routeId, 'routeId'),
    routeName: text(root.routeName, 'routeName'),
    stops,
    route,
  });
}
