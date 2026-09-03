import type { RouteGeometry } from './routeDocument';
import {
  DEFAULT_GEOMETRY_OPTIONS,
  processDrawnPoints,
  type GeometryProcessingOptions,
  type ScreenGeoPoint,
} from './routeGeometry';

export interface DrawingSnapshot {
  active: boolean;
  pointerActive: boolean;
  strokeCount: number;
  geometry: RouteGeometry | null;
  canUndo: boolean;
  canSave: boolean;
  validationMessage: string | null;
}

const sameCoordinate = (left: ScreenGeoPoint, right: ScreenGeoPoint) =>
  left.lng === right.lng && left.lat === right.lat;

export class DrawingController {
  private active = false;
  private strokes: ScreenGeoPoint[][] = [];
  private current: ScreenGeoPoint[] | null = null;
  private readonly options: GeometryProcessingOptions;

  constructor(options = DEFAULT_GEOMETRY_OPTIONS) {
    this.options = { ...options };
  }

  start(): DrawingSnapshot {
    this.active = true;
    this.strokes = [];
    this.current = null;
    return this.snapshot();
  }

  beginStroke(point: ScreenGeoPoint): DrawingSnapshot {
    if (this.active) this.current = [{ ...point }];
    return this.snapshot();
  }

  appendPoint(point: ScreenGeoPoint): DrawingSnapshot {
    const last = this.current?.at(-1);
    if (!last) return this.snapshot();
    const distance = Math.hypot(point.x - last.x, point.y - last.y);
    if (point.time - last.time >= this.options.throttleMs &&
        distance >= this.options.minimumScreenDistancePx) {
      this.current!.push({ ...point });
    }
    return this.snapshot();
  }

  endStroke(point: ScreenGeoPoint): DrawingSnapshot {
    if (!this.current) return this.snapshot();
    const last = this.current.at(-1)!;
    if (point.x !== last.x || point.y !== last.y || point.lng !== last.lng || point.lat !== last.lat) {
      this.current.push({ ...point });
    }
    if (this.current.length > 1) this.strokes.push(this.current);
    this.current = null;
    return this.snapshot();
  }

  undo(): DrawingSnapshot {
    this.strokes.pop();
    return this.snapshot();
  }

  clear(): DrawingSnapshot {
    this.strokes = [];
    this.current = null;
    return this.snapshot();
  }

  cancel(): DrawingSnapshot {
    this.active = false;
    this.strokes = [];
    this.current = null;
    return this.snapshot();
  }

  snapshot(): DrawingSnapshot {
    const allStrokes = [...this.strokes, ...(this.current ? [this.current] : [])];
    const joined: ScreenGeoPoint[] = [];
    for (const stroke of allStrokes) {
      const start = joined.length > 0 && sameCoordinate(joined.at(-1)!, stroke[0]) ? 1 : 0;
      joined.push(...stroke.slice(start));
    }
    const geometry = processDrawnPoints(joined, this.options);
    return structuredClone({
      active: this.active,
      pointerActive: this.current !== null,
      strokeCount: this.strokes.length,
      geometry,
      canUndo: this.strokes.length > 0,
      canSave: geometry !== null,
      validationMessage: this.active && geometry === null
        ? 'A route requires at least two distinct points.'
        : null,
    });
  }
}
