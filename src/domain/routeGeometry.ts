import type { RouteGeometry, TrashStop } from './routeDocument';

export function stopOrderToGeometry(stops: TrashStop[], stopOrder: string[]): RouteGeometry | null {
  if (stops.length < 2 || stopOrder.length !== stops.length) return null;
  const stopsById = new Map(stops.map((stop) => [stop.id, stop]));
  const seen = new Set<string>();
  const coordinates: Array<[number, number]> = [];
  for (const id of stopOrder) {
    if (seen.has(id)) return null;
    const stop = stopsById.get(id);
    if (!stop) return null;
    seen.add(id);
    coordinates.push([stop.lng, stop.lat]);
  }
  if (seen.size !== stops.length || !coordinates.some(([lng, lat]) => lng !== coordinates[0][0] || lat !== coordinates[0][1])) {
    return null;
  }
  return { coordinates };
}

export interface ScreenGeoPoint {
  x: number;
  y: number;
  lng: number;
  lat: number;
  time: number;
}

export interface GeometryProcessingOptions {
  throttleMs: number;
  minimumScreenDistancePx: number;
  smoothingWindow: number;
  simplifyTolerancePx: number;
}

export const DEFAULT_GEOMETRY_OPTIONS: GeometryProcessingOptions = {
  throttleMs: 16,
  minimumScreenDistancePx: 4,
  smoothingWindow: 3,
  simplifyTolerancePx: 1.5,
};

function retainWithGate(
  points: ScreenGeoPoint[],
  keep: (candidate: ScreenGeoPoint, retained: ScreenGeoPoint) => boolean,
): ScreenGeoPoint[] {
  if (points.length <= 2) return [...points];
  const result = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    if (keep(points[index], result.at(-1)!)) result.push(points[index]);
  }
  const last = points.at(-1)!;
  if (last !== result.at(-1)) result.push(last);
  return result;
}

function smooth(points: ScreenGeoPoint[], window: number): ScreenGeoPoint[] {
  if (points.length <= 2 || window <= 1) return points.map((point) => ({ ...point }));
  const radius = Math.floor(window / 2);
  return points.map((point, index) => {
    if (index === 0 || index === points.length - 1) return { ...point };
    const slice = points.slice(Math.max(0, index - radius), Math.min(points.length, index + radius + 1));
    const average = (key: keyof ScreenGeoPoint) =>
      slice.reduce((sum, item) => sum + item[key], 0) / slice.length;
    return { x: average('x'), y: average('y'), lng: average('lng'), lat: average('lat'), time: point.time };
  });
}

function perpendicularDistance(point: ScreenGeoPoint, start: ScreenGeoPoint, end: ScreenGeoPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function simplify(points: ScreenGeoPoint[], tolerance: number): ScreenGeoPoint[] {
  if (points.length <= 2) return [...points];
  let furthestIndex = -1;
  let furthestDistance = tolerance;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], points[0], points.at(-1)!);
    if (distance > furthestDistance) {
      furthestDistance = distance;
      furthestIndex = index;
    }
  }
  if (furthestIndex < 0) return [points[0], points.at(-1)!];
  return [
    ...simplify(points.slice(0, furthestIndex + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(furthestIndex), tolerance),
  ];
}

export function processDrawnPoints(
  points: ScreenGeoPoint[],
  options: GeometryProcessingOptions = DEFAULT_GEOMETRY_OPTIONS,
): RouteGeometry | null {
  if (points.length < 2) return null;
  const originalFirst = points[0];
  const originalLast = points.at(-1)!;
  const throttled = retainWithGate(points, (candidate, retained) => candidate.time - retained.time >= options.throttleMs);
  const filtered = retainWithGate(throttled, (candidate, retained) =>
    Math.hypot(candidate.x - retained.x, candidate.y - retained.y) >= options.minimumScreenDistancePx,
  );
  const simplified = simplify(smooth(filtered, options.smoothingWindow), options.simplifyTolerancePx);
  const coordinates: Array<[number, number]> = simplified.map((point) => [point.lng, point.lat]);
  coordinates[0] = [originalFirst.lng, originalFirst.lat];
  coordinates[coordinates.length - 1] = [originalLast.lng, originalLast.lat];
  if (!coordinates.some(([lng, lat]) => lng !== coordinates[0][0] || lat !== coordinates[0][1])) return null;
  return { coordinates };
}

const toRadians = (degrees: number) => degrees * Math.PI / 180;

export function routeMiles(route: RouteGeometry | null): number {
  if (!route) return 0;
  let miles = 0;
  for (let index = 1; index < route.coordinates.length; index += 1) {
    const [lng1, lat1] = route.coordinates[index - 1];
    const [lng2, lat2] = route.coordinates[index];
    const deltaLat = toRadians(lat2 - lat1);
    const deltaLng = toRadians(lng2 - lng1);
    const a = Math.sin(deltaLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) ** 2;
    miles += 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return miles;
}
