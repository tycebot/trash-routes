export interface TrashStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface RouteDay {
  id: string;
  name: string;
  stops: TrashStop[];
  stopOrder: string[];
}

export interface TrashRoute {
  id: string;
  name: string;
  days: RouteDay[];
}

export interface RouteDocument {
  schemaVersion: 2;
  routes: TrashRoute[];
}

interface LegacyTrashStop extends TrashStop {
  sequence: number;
}

interface LegacyRouteDocument {
  schemaVersion: 1;
  routeId: string;
  routeName: string;
  stops: LegacyTrashStop[];
  route: { coordinates: Array<[number, number]> } | null;
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

const uniqueId = (value: unknown, field: string, ids: Set<string>): string => {
  const id = text(value, field);
  if (ids.has(id)) throw new RouteDocumentError(field, 'must be unique');
  ids.add(id);
  return id;
};

const parseStop = (value: unknown, field: string, ids: Set<string>): TrashStop => {
  const stop = record(value, field);
  return {
    id: uniqueId(stop.id, `${field}.id`, ids),
    name: text(stop.name, `${field}.name`),
    lat: coordinate(stop.lat, `${field}.lat`, -90, 90),
    lng: coordinate(stop.lng, `${field}.lng`, -180, 180),
  };
};

const parseStopOrder = (
  value: unknown,
  field: string,
  stops: TrashStop[],
): string[] => {
  if (!Array.isArray(value)) throw new RouteDocumentError(field, 'must be an array');
  if (value.length !== 0 && value.length !== stops.length) {
    throw new RouteDocumentError(field, 'must contain every stop exactly once or be empty');
  }
  const ids = new Set<string>();
  return value.map((rawId, index) => {
    const id = text(rawId, `${field}[${index}]`);
    if (ids.has(id)) throw new RouteDocumentError(`${field}[${index}]`, 'must be unique');
    if (!stops.some((stop) => stop.id === id)) {
      throw new RouteDocumentError(`${field}[${index}]`, 'must reference a stop in this day');
    }
    ids.add(id);
    return id;
  });
};

export function parseRouteDocument(value: unknown): RouteDocument {
  const root = record(value, 'document');
  if (root.schemaVersion !== 2) throw new RouteDocumentError('schemaVersion', 'must equal 2');
  if (!Array.isArray(root.routes)) throw new RouteDocumentError('routes', 'must be an array');

  const routeIds = new Set<string>();
  const routes = root.routes.map((rawRoute, routeIndex): TrashRoute => {
    const routeField = `routes[${routeIndex}]`;
    const route = record(rawRoute, routeField);
    const id = uniqueId(route.id, `${routeField}.id`, routeIds);
    const name = text(route.name, `${routeField}.name`);
    if (!Array.isArray(route.days)) throw new RouteDocumentError(`${routeField}.days`, 'must be an array');

    const dayIds = new Set<string>();
    const days = route.days.map((rawDay, dayIndex): RouteDay => {
      const dayField = `${routeField}.days[${dayIndex}]`;
      const day = record(rawDay, dayField);
      const dayId = uniqueId(day.id, `${dayField}.id`, dayIds);
      const dayName = text(day.name, `${dayField}.name`);
      if (!Array.isArray(day.stops)) throw new RouteDocumentError(`${dayField}.stops`, 'must be an array');
      const stopIds = new Set<string>();
      const stops = day.stops.map((rawStop, stopIndex) =>
        parseStop(rawStop, `${dayField}.stops[${stopIndex}]`, stopIds));
      const stopOrder = parseStopOrder(day.stopOrder, `${dayField}.stopOrder`, stops);
      return { id: dayId, name: dayName, stops, stopOrder };
    });

    return { id, name, days };
  });

  return cloneRouteDocument({ schemaVersion: 2, routes });
}

function parseLegacyRouteDocument(value: unknown): LegacyRouteDocument {
  const root = record(value, 'document');
  if (root.schemaVersion !== 1) throw new RouteDocumentError('schemaVersion', 'must equal 1');
  const routeId = text(root.routeId, 'routeId');
  const routeName = text(root.routeName, 'routeName');
  if (!Array.isArray(root.stops)) throw new RouteDocumentError('stops', 'must be an array');

  const ids = new Set<string>();
  const sequences = new Set<number>();
  const stops = root.stops.map((rawStop, index): LegacyTrashStop => {
    const field = `stops[${index}]`;
    const stop = record(rawStop, field);
    const id = uniqueId(stop.id, `${field}.id`, ids);
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

  let route: LegacyRouteDocument['route'] = null;
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
  return { schemaVersion: 1, routeId, routeName, stops, route };
}

export function migrateRouteDocument(value: unknown): RouteDocument {
  const legacy = parseLegacyRouteDocument(value);
  const stops = legacy.stops
    .toSorted((left, right) => left.sequence - right.sequence)
    .map(({ id, name, lat, lng }) => ({ id, name, lat, lng }));
  return parseRouteDocument({
    schemaVersion: 2,
    routes: [{
      id: legacy.routeId,
      name: legacy.routeName,
      days: [{
        id: `${legacy.routeId}-day-1`,
        name: 'Route day',
        stops,
        stopOrder: stops.map((stop) => stop.id),
      }],
    }],
  });
}

export function orderedStops(day: RouteDay): TrashStop[] {
  const stops = new Map(day.stops.map((stop) => [stop.id, stop]));
  return day.stopOrder.flatMap((id) => {
    const stop = stops.get(id);
    return stop ? [stop] : [];
  });
}
