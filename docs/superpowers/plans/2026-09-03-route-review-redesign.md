# Route Review Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark Leaflet stop editor with the approved light, map-first Route Review app for viewing and finger-tracing a fixed 100-stop Lodi route, then distribute the same frontend as an iPad PWA and a Windows Tauri package.

**Architecture:** Keep one React/Vite frontend. Domain state lives in a validated `RouteDocument`; a storage-injected `RouteStore` owns persistence/import/export/reset, while pure geometry functions and a stateful `DrawingController` process input without mutating stops. `RouteMap` is the MapLibre adapter: it translates React props into GeoJSON sources/layers and emits typed selection/drawing events, leaving all domain mutations in `RouteReviewApp`.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Tailwind CSS 4, MapLibre GL JS 6, browser `localStorage`, Vitest 4, Testing Library, Playwright 1.62, `vite-plugin-pwa` 1.3, Tauri 2, npm

**Spec:** `docs/superpowers/specs/2026-09-03-route-review-redesign-design.md`

## Global Constraints

- Keep React 19, TypeScript, Vite, Tailwind CSS, npm, and browser-local persistence.
- Replace Leaflet with MapLibre GL JS and use key-free OpenFreeMap vector tiles.
- Add no backend, database, container, hosted application service, or paid map API key.
- Add Tauri 2 only as a thin Windows wrapper; end users must not need Rust installed.
- Keep stops and route geometry independent; drawing must never add, remove, move, or reorder stops.
- `RouteDocument.schemaVersion` is exactly `1`.
- The checked-in Lodi fixture contains exactly 100 uniquely identified, consecutively sequenced public OpenStreetMap POIs and no private homes.
- 2D is the default; 3D uses approximately 55 degrees of pitch, a slight bearing, and genuine building extrusion.
- All controls have accessible names, visible focus, and at least 44-by-44 CSS-pixel targets.
- Respect safe-area insets and dynamic viewport height; prevent page scrolling while preserving map gestures.
- Build a portable static `dist/`; publishing waits for an engineer-selected GitHub repository and visibility.
- **Stack decision:** established React/Vite repository using its existing stack plus the MapLibre and Tauri deviations approved in the specification. **Stack deviations:** MapLibre GL JS and Tauri 2, exactly as justified in the approved specification; test and PWA build dependencies are build-time support for its verification and distribution requirements.

---

## File Structure

### Domain and state

- `src/domain/routeDocument.ts` — domain types, schema-v1 parser, clone helper, and field-specific validation errors.
- `src/domain/routeGeometry.ts` — pure filtering, smoothing, simplification, endpoint preservation, and mileage calculations.
- `src/domain/DrawingController.ts` — the deep drawing module; owns strokes and exposes one immutable snapshot interface.
- `src/store/RouteStore.ts` — storage adapter for validated load/save/import/reset with explicit save status.
- `src/data/lodiRoute.json` — checked-in deterministic application fixture.
- `src/data/lodiRoute.ts` — typed, validated fixture export and attribution constants.
- `data/lodi-osm-source.json` — checked-in raw public OSM source snapshot.
- `scripts/build-lodi-fixture.mjs` — deterministic source-to-fixture transformation.

### Map seam

- `src/map/StopLayer.ts` — stop-to-GeoJSON conversion and adaptive stop layer definitions.
- `src/map/RouteLayer.ts` — route-to-GeoJSON conversion and cased route layer definitions.
- `src/map/RouteMap.tsx` — MapLibre lifecycle, pointer capture, camera mode, selection events, and map error rendering.

### UI

- `src/App.tsx` — `RouteReviewApp` composition and top-level mode/draft transitions.
- `src/components/TopBar.tsx` — app/route title, View/Draw/Edit mode control, and 2D/3D control.
- `src/components/RouteOverview.tsx` — overlay card, drawing instructions/actions, selected-stop details, and file actions.
- `src/components/StatusBar.tsx` — stop count, geometry mileage, and persistence status.
- `src/index.css` — Option C design tokens, responsive map-first layout, focus, safe area, and MapLibre overrides.

### Verification and distribution

- `src/test/setup.ts` — jsdom matchers and browser mocks.
- `src/**/*.test.ts(x)` — colocated domain and UI integration tests.
- `e2e/route-review.spec.ts` — Chromium and iPad-WebKit walkthrough automation.
- `playwright.config.ts` — production-build web server and desktop/iPad projects.
- `public/manifest.webmanifest`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/apple-touch-icon.png` — install metadata and real PNG icons.
- `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/src/main.rs`, `src-tauri/capabilities/default.json`, `src-tauri/icons/*` — minimal Tauri 2 wrapper.
- `.github/workflows/verify.yml`, `.github/workflows/pages.yml`, `.github/workflows/windows-release.yml` — pull-request verification, Pages deployment, and tagged Windows release.
- `README.md` — local/static usage, iPad installation, Windows release, data attribution, and publication prerequisites.

Remove the superseded `src/components/Map.tsx`, `Toolbar.tsx`, `StopList.tsx`, `StatsBar.tsx`, `src/data/sampleStops.ts`, `src/store.ts`, `src/types.ts`, and unused starter assets/CSS.

---

### Task 1: Establish the Test Harness and Route Document Contract

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.app.json`
- Modify: `.gitignore`
- Create: `src/test/setup.ts`
- Create: `src/domain/routeDocument.test.ts`
- Create: `src/domain/routeDocument.ts`

**Interfaces:**
- Consumes: no earlier task.
- Produces: `RouteMode = 'view' | 'draw' | 'edit'`, `TrashStop`, `RouteGeometry`, `RouteDocument`, `RouteDocumentError`, `parseRouteDocument(value: unknown): RouteDocument`, and `cloneRouteDocument(document: RouteDocument): RouteDocument`.

- [ ] **Step 1: Install runtime, test, PWA, and desktop build dependencies**

```bash
npm uninstall leaflet react-leaflet @types/leaflet
npm install maplibre-gl vite-plugin-pwa
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test @tauri-apps/cli
```

Update scripts to expose deterministic checks:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "preview": "vite preview",
    "tauri": "tauri"
  }
}
```

Add `vitest.config.ts` with jsdom, globals, `src/test/setup.ts`, and CSS enabled. Add `vite.config.ts`, `vitest.config.ts`, and `playwright.config.ts` to `tsconfig.app.json` only if imported by application tests; otherwise keep application compilation scoped to `src`.

- [ ] **Step 2: Write failing schema tests**

```ts
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
```

- [ ] **Step 3: Run the schema test and verify the red state**

Run: `npm test -- src/domain/routeDocument.test.ts`

Expected: FAIL because `./routeDocument` does not exist.

- [ ] **Step 4: Implement the schema-v1 parser**

Use this exact public contract and central `fail` helper; validate object shape, finite/ranged coordinates, non-empty strings, unique IDs, unique consecutive sequences `1..stops.length`, and either `null` or at least two distinct `[lng, lat]` pairs:

```ts
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
  constructor(readonly field: string, message: string) {
    super(`${field}: ${message}`);
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
    if (!sequences.has(sequence)) throw new RouteDocumentError('stops.sequence', `must contain ${sequence}`);
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
```

- [ ] **Step 5: Run focused and static checks**

Run: `npm test -- src/domain/routeDocument.test.ts && npm run lint && npm run build`

Expected: all commands exit 0.

- [ ] **Step 6: Commit the contract**

```bash
git add package.json package-lock.json tsconfig.app.json .gitignore vitest.config.ts src/test src/domain/routeDocument.ts src/domain/routeDocument.test.ts
git commit -m "test: define route document contract"
```

---

### Task 2: Check In the Attributed 100-Stop Lodi Fixture

**Files:**
- Create: `data/lodi-overpass-query.txt`
- Create: `data/lodi-osm-source.json`
- Create: `scripts/build-lodi-fixture.mjs`
- Create: `src/data/lodiRoute.json`
- Create: `src/data/lodiRoute.ts`
- Create: `src/data/lodiRoute.test.ts`

**Interfaces:**
- Consumes: `parseRouteDocument(value)` from Task 1.
- Produces: `LODI_ROUTE: RouteDocument`, `LODI_SOURCE_URL: string`, and `LODI_RETRIEVED_ON: '2026-09-03'`.

- [ ] **Step 1: Save the reproducible public-POI query and raw response**

Create `data/lodi-overpass-query.txt`:

```overpass
[out:json][timeout:60];
(
  nwr["name"]["amenity"](38.08,-121.36,38.20,-121.20);
  nwr["name"]["shop"](38.08,-121.36,38.20,-121.20);
  nwr["name"]["office"](38.08,-121.36,38.20,-121.20);
  nwr["name"]["tourism"](38.08,-121.36,38.20,-121.20);
  nwr["name"]["leisure"](38.08,-121.36,38.20,-121.20);
);
out center tags;
```

Fetch once and check in the response so the application and tests never depend on Overpass:

```bash
curl --fail --retry 3 --data-urlencode 'data@data/lodi-overpass-query.txt' \
  https://overpass-api.de/api/interpreter > data/lodi-osm-source.json
```

- [ ] **Step 2: Write the failing fixture invariant test**

```ts
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
```

- [ ] **Step 3: Run the fixture test and verify the red state**

Run: `npm test -- src/data/lodiRoute.test.ts`

Expected: FAIL because `./lodiRoute` does not exist.

- [ ] **Step 4: Implement deterministic fixture generation**

In `scripts/build-lodi-fixture.mjs`, read the saved Overpass JSON and:

1. Accept nodes by `lat/lon`, ways/relations by `center.lat/center.lon`.
2. Require a trimmed `tags.name` and at least one public-facing category tag: `amenity`, `shop`, `office`, `tourism`, or `leisure`.
3. Reject `access=private`, `access=no`, `amenity=parking_entrance`, and objects whose only place classification is residential.
4. De-duplicate normalized `name|lat.toFixed(5)|lng.toFixed(5)`.
5. Sort by latitude descending, then longitude ascending, then OSM type and numeric ID.
6. Take the first 100 and assign IDs `${type}-${id}` and sequence positions `1..100`.
7. Set `route` to the following independently authored Lodi overview trace; it is route geometry, not a calculation that joins stop coordinates. During the Task 12 map walkthrough, move any segment that does not follow a visible public street and preserve the resulting reviewed coordinates in this constant.
8. Throw unless exactly 100 candidates remain.

The output shape is:

```js
const DEMO_ROUTE_COORDINATES = [
  [-121.2930, 38.1450], [-121.2820, 38.1450], [-121.2700, 38.1450], [-121.2570, 38.1450],
  [-121.2520, 38.1370], [-121.2640, 38.1370], [-121.2780, 38.1370], [-121.2900, 38.1370],
  [-121.2900, 38.1280], [-121.2780, 38.1280], [-121.2640, 38.1280], [-121.2520, 38.1280],
  [-121.2520, 38.1180], [-121.2650, 38.1180], [-121.2790, 38.1180], [-121.2910, 38.1180],
  [-121.2930, 38.1280], [-121.2930, 38.1450],
];
const routeDocument = {
  schemaVersion: 1,
  routeId: 'lodi-demo',
  routeName: 'Lodi Route Review',
  stops,
  route: { coordinates: DEMO_ROUTE_COORDINATES },
};
process.stdout.write(`${JSON.stringify(routeDocument, null, 2)}\n`);
```

Generate and inspect the fixture:

```bash
node scripts/build-lodi-fixture.mjs data/lodi-osm-source.json > src/data/lodiRoute.json
node -e "const d=require('./src/data/lodiRoute.json'); console.log(d.stops.length, d.stops[0], d.stops[99])"
```

Read all 100 names and source tags. If any selected object is residential/private, add its OSM ID to an explicit `EXCLUDED_OSM_IDS` set in the script, regenerate, and retain the reason in an adjacent comment.

- [ ] **Step 5: Export the validated fixture and attribution**

```ts
import rawRoute from './lodiRoute.json';
import { parseRouteDocument } from '../domain/routeDocument';

export const LODI_SOURCE_URL = 'https://www.openstreetmap.org/copyright';
export const LODI_RETRIEVED_ON = '2026-09-03' as const;
export const LODI_ROUTE = parseRouteDocument(rawRoute);
```

Enable `resolveJsonModule` in `tsconfig.app.json`.

- [ ] **Step 6: Verify and commit the fixture**

Run: `npm test -- src/data/lodiRoute.test.ts && npm run build`

Expected: PASS and exactly 100 stops.

```bash
git add data scripts src/data tsconfig.app.json
git commit -m "feat: add attributed Lodi route fixture"
```

---

### Task 3: Process Drawn Geometry and Calculate Mileage

**Files:**
- Create: `src/domain/routeGeometry.test.ts`
- Create: `src/domain/routeGeometry.ts`

**Interfaces:**
- Consumes: `RouteGeometry` from Task 1.
- Produces: `ScreenGeoPoint`, `GeometryProcessingOptions`, `DEFAULT_GEOMETRY_OPTIONS`, `processDrawnPoints(points, options?): RouteGeometry | null`, and `routeMiles(route): number`.

- [ ] **Step 1: Write failing geometry tests**

```ts
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
```

- [ ] **Step 2: Run tests and verify the red state**

Run: `npm test -- src/domain/routeGeometry.test.ts`

Expected: FAIL because `./routeGeometry` does not exist.

- [ ] **Step 3: Implement the pure processing pipeline**

```ts
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
```

Implement, in order: retain first/last while throttling intermediate samples; retain first/last while filtering Euclidean screen distance; apply a centered moving average to interior geographic and screen coordinates; run Ramer-Douglas-Peucker against smoothed screen coordinates; restore the original first and last geographic coordinates; reject results with fewer than two distinct geographic pairs. Implement haversine segment summation with Earth radius `3958.8` miles and no rounding in `routeMiles`.

- [ ] **Step 4: Verify geometry behavior**

Run: `npm test -- src/domain/routeGeometry.test.ts && npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit the pure geometry module**

```bash
git add src/domain/routeGeometry.ts src/domain/routeGeometry.test.ts
git commit -m "feat: process drawn route geometry"
```

---

### Task 4: Build the Stroke-Oriented Drawing Controller

**Files:**
- Create: `src/domain/DrawingController.test.ts`
- Create: `src/domain/DrawingController.ts`

**Interfaces:**
- Consumes: `ScreenGeoPoint`, `GeometryProcessingOptions`, and `processDrawnPoints` from Task 3.
- Produces: `DrawingSnapshot` and class `DrawingController` with `start()`, `beginStroke(point)`, `appendPoint(point)`, `endStroke(point)`, `undo()`, `clear()`, `cancel()`, and `snapshot()`.

- [ ] **Step 1: Write failing controller tests**

```ts
import { describe, expect, it } from 'vitest';
import { DrawingController } from './DrawingController';

const p = (x: number, lng: number, time: number) => ({ x, y: 0, lng, lat: 38.13, time });

describe('DrawingController', () => {
  it('previews processed geometry and undoes a complete stroke', () => {
    const drawing = new DrawingController();
    drawing.start();
    drawing.beginStroke(p(0, -121.28, 0));
    drawing.appendPoint(p(8, -121.272, 16));
    drawing.endStroke(p(10, -121.27, 20));
    drawing.beginStroke(p(20, -121.26, 40));
    drawing.appendPoint(p(28, -121.252, 56));
    drawing.endStroke(p(30, -121.25, 60));
    expect(drawing.snapshot().canSave).toBe(true);
    drawing.undo();
    expect(drawing.snapshot().strokeCount).toBe(1);
  });

  it('clear removes only the draft and cancel exits drawing', () => {
    const drawing = new DrawingController();
    drawing.start();
    drawing.beginStroke(p(0, -121.28, 0));
    drawing.appendPoint(p(8, -121.272, 16));
    drawing.endStroke(p(10, -121.27, 20));
    drawing.clear();
    expect(drawing.snapshot()).toMatchObject({ active: true, geometry: null, canSave: false });
    drawing.cancel();
    expect(drawing.snapshot()).toMatchObject({ active: false, geometry: null });
  });
});
```

- [ ] **Step 2: Run tests and verify the red state**

Run: `npm test -- src/domain/DrawingController.test.ts`

Expected: FAIL because `./DrawingController` does not exist.

- [ ] **Step 3: Implement the deep drawing module**

```ts
export interface DrawingSnapshot {
  active: boolean;
  pointerActive: boolean;
  strokeCount: number;
  geometry: RouteGeometry | null;
  canUndo: boolean;
  canSave: boolean;
  validationMessage: string | null;
}

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
    if (!this.active) return this.snapshot();
    this.current = [point];
    return this.snapshot();
  }

  appendPoint(point: ScreenGeoPoint): DrawingSnapshot {
    const last = this.current?.at(-1);
    if (!last) return this.snapshot();
    const distance = Math.hypot(point.x - last.x, point.y - last.y);
    if (point.time - last.time >= this.options.throttleMs &&
        distance >= this.options.minimumScreenDistancePx) this.current!.push(point);
    return this.snapshot();
  }

  endStroke(point: ScreenGeoPoint): DrawingSnapshot {
    if (!this.current) return this.snapshot();
    const last = this.current.at(-1)!;
    if (point.x !== last.x || point.y !== last.y || point.lng !== last.lng || point.lat !== last.lat) {
      this.current.push(point);
    }
    if (this.current.length > 1) this.strokes.push(this.current);
    this.current = null;
    return this.snapshot();
  }

  undo(): DrawingSnapshot { this.strokes.pop(); return this.snapshot(); }
  clear(): DrawingSnapshot { this.strokes = []; this.current = null; return this.snapshot(); }
  cancel(): DrawingSnapshot { this.active = false; this.strokes = []; this.current = null; return this.snapshot(); }

  snapshot(): DrawingSnapshot {
    const joined = [...this.strokes, ...(this.current ? [this.current] : [])]
      .flatMap((stroke, index) => index === 0 ? stroke : stroke.slice(1));
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
```

Keep complete strokes private. In `appendPoint`, discard samples that arrive sooner than `options.throttleMs` after the retained sample or are nearer than `options.minimumScreenDistancePx`. `endStroke(point)` appends its final pointer coordinate without those gates before completing the stroke. Join strokes in capture order, remove a duplicate join coordinate, and process the aggregate for every returned snapshot. `undo()` pops one complete stroke, never one coordinate. Return cloned snapshots. Use the validation message `A route requires at least two distinct points.` whenever active geometry cannot be saved.

- [ ] **Step 4: Verify and commit the controller**

Run: `npm test -- src/domain/DrawingController.test.ts && npm run lint`

Expected: PASS.

```bash
git add src/domain/DrawingController.ts src/domain/DrawingController.test.ts
git commit -m "feat: add stroke drawing controller"
```

---

### Task 5: Validate, Persist, Import, Export, and Reset Routes

**Files:**
- Create: `src/store/RouteStore.test.ts`
- Create: `src/store/RouteStore.ts`
- Delete: `src/store.ts`
- Delete: `src/types.ts`

**Interfaces:**
- Consumes: `RouteDocument`, `RouteGeometry`, parser/clone helpers from Task 1, and `LODI_ROUTE` from Task 2.
- Produces: `SaveStatus = 'saved' | 'unsaved' | 'storage-error'`, `RouteStoreSnapshot`, `StorageAdapter`, and `RouteStore` methods `getSnapshot()`, `subscribe(listener)`, `replaceRoute(route)`, `importJson(json)`, `exportJson()`, and `reset()`.

- [ ] **Step 1: Write failing store tests with an injected memory adapter**

```ts
import { describe, expect, it } from 'vitest';
import { LODI_ROUTE } from '../data/lodiRoute';
import { RouteStore } from './RouteStore';

const memoryStorage = (initial?: string) => {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
    removeItem: () => { value = null; },
  };
};

describe('RouteStore', () => {
  it('loads validated local data and falls back to the demo on invalid data', () => {
    expect(new RouteStore(memoryStorage('{"bad":true}'), LODI_ROUTE).getSnapshot().document)
      .toEqual(LODI_ROUTE);
  });

  it('does not overwrite valid state after invalid import', () => {
    const store = new RouteStore(memoryStorage(), LODI_ROUTE);
    const before = store.getSnapshot().document;
    const result = store.importJson('{"schemaVersion":2}');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('invalid import unexpectedly succeeded');
    expect(result.error).toContain('schemaVersion');
    expect(store.getSnapshot().document).toEqual(before);
  });

  it('replaces only route geometry and persists it', () => {
    const store = new RouteStore(memoryStorage(), LODI_ROUTE);
    const originalStops = store.getSnapshot().document.stops;
    store.replaceRoute({ coordinates: [[-121.28, 38.13], [-121.27, 38.14]] });
    expect(store.getSnapshot().document.stops).toEqual(originalStops);
    expect(store.getSnapshot().saveStatus).toBe('saved');
  });

  it('keeps in-memory changes when storage throws', () => {
    const failing = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
    const store = new RouteStore(failing, LODI_ROUTE);
    store.replaceRoute({ coordinates: [[-121.28, 38.13], [-121.27, 38.14]] });
    expect(store.getSnapshot().document.route).not.toBeNull();
    expect(store.getSnapshot().saveStatus).toBe('storage-error');
  });
});
```

- [ ] **Step 2: Run tests and verify the red state**

Run: `npm test -- src/store/RouteStore.test.ts`

Expected: FAIL because `./RouteStore` does not exist.

- [ ] **Step 3: Implement storage behind one interface**

```ts
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type ImportResult = { ok: true } | { ok: false; error: string };
export interface RouteStoreSnapshot {
  document: RouteDocument;
  saveStatus: 'saved' | 'unsaved' | 'storage-error';
}
```

Use storage key `trash-routes-route-document-v1`. Validate both loaded and imported values. Mutate internal state only after parsing succeeds. `replaceRoute` must clone coordinates while retaining an unchanged clone of `stops`; `reset` restores a clone of `LODI_ROUTE`; `exportJson` returns only the `RouteDocument`, formatted with two spaces. Notify subscribers after each successful state mutation, including mutations that fail to persist.

- [ ] **Step 4: Verify and commit the store**

Run: `npm test -- src/store/RouteStore.test.ts && npm run build`

Expected: PASS.

```bash
git add src/store src/store.ts src/types.ts
git commit -m "feat: add validated route persistence"
```

---

### Task 6: Define MapLibre Stop and Route Layers

**Files:**
- Create: `src/map/StopLayer.test.ts`
- Create: `src/map/StopLayer.ts`
- Create: `src/map/RouteLayer.test.ts`
- Create: `src/map/RouteLayer.ts`

**Interfaces:**
- Consumes: `TrashStop` and `RouteGeometry` from Task 1.
- Produces: `stopsToGeoJson(stops, selectedStopId)`, `STOP_LAYER_DEFINITIONS`, `routeToGeoJson(route)`, and `routeLayerDefinitions(kind)` for `saved | reference | draft`.

- [ ] **Step 1: Write failing layer-definition tests**

```ts
import { describe, expect, it } from 'vitest';
import { STOP_LAYER_DEFINITIONS, stopsToGeoJson } from './StopLayer';
import { routeLayerDefinitions } from './RouteLayer';

it('keeps all stops visible while labels appear at neighborhood zoom', () => {
  const data = stopsToGeoJson([
    { id: 'a', name: 'City Hall', lat: 38.13, lng: -121.27, sequence: 1 },
  ], 'a');
  expect(data.features[0].properties).toMatchObject({ id: 'a', sequence: 1, selected: true });
  expect(STOP_LAYER_DEFINITIONS.point.minzoom).toBe(0);
  expect(STOP_LAYER_DEFINITIONS.label.minzoom).toBe(13);
  expect(STOP_LAYER_DEFINITIONS.label.layout?.['symbol-sort-key']).toEqual(['get', 'sequence']);
});

it.each(['saved', 'reference', 'draft'] as const)('creates white casing and colored line for %s', (kind) => {
  const layers = routeLayerDefinitions(kind);
  expect(layers.map((layer) => layer.id)).toEqual([`${kind}-route-casing`, `${kind}-route-line`]);
});
```

- [ ] **Step 2: Run tests and verify the red state**

Run: `npm test -- src/map/StopLayer.test.ts src/map/RouteLayer.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement typed GeoJSON and style definitions**

Create one stop source with properties `{ id, name, sequence, selected }`. Use a halo circle, a white-centered circle with indigo outline, and a symbol layer with `text-field: ['to-string', ['get', 'sequence']]`, collision enabled, `minzoom: 13`, and a white text halo. Selected expressions switch halo/outline to amber and increase radius, so selection differs by color and shape.

Create one line source per route kind. Each pair of layers uses round caps/joins; saved and draft lines use a white 8px casing plus indigo/amber 5px line, while reference uses 5px/3px at low opacity. `routeToGeoJson(null)` returns an empty feature collection.

- [ ] **Step 4: Verify and commit the layer contracts**

Run: `npm test -- src/map/StopLayer.test.ts src/map/RouteLayer.test.ts && npm run lint`

Expected: PASS.

```bash
git add src/map
git commit -m "feat: define adaptive MapLibre route layers"
```

---

### Task 7: Implement the MapLibre Adapter, Drawing Events, and 2D/3D Camera

**Files:**
- Create: `src/map/RouteMap.test.tsx`
- Create: `src/map/RouteMap.tsx`
- Delete: `src/components/Map.tsx`
- Modify: `src/test/setup.ts`

**Interfaces:**
- Consumes: layer helpers from Task 6, `RouteMode`, stop/route types from Task 1, and `ScreenGeoPoint` from Task 3.
- Produces: `MapPresentation = '2d' | '3d'`, `MapError = 'unsupported' | 'initialization' | 'style' | null`, and `RouteMapProps` callbacks `onSelectStop(id)`, `onStrokeStart(point)`, `onStrokePoint(point)`, `onStrokeEnd(point)`, and `onMapError(error)`. Retry remains internal to the map adapter.

- [ ] **Step 1: Write failing map integration tests around a mocked MapLibre constructor**

Mock `maplibre-gl` at the imported seam with `vi.mock`, returning one `createFakeMap()` instance; do not expose a test-only factory through the production `RouteMapProps` interface.

```tsx
it('changes pitch/bearing and building visibility for 3D', async () => {
  const map = createFakeMap();
  mockedMapConstructor.mockReturnValue(map);
  render(<RouteMap {...props} presentation="3d" />);
  map.emit('load');
  expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ pitch: 55, bearing: -12 }));
  expect(map.setLayoutProperty).toHaveBeenCalledWith('building-3d', 'visibility', 'visible');
});

it('captures drawing pointers without moving stops', async () => {
  const onStrokePoint = vi.fn();
  render(<RouteMap {...props} mode="draw" drawingActive onStrokePoint={onStrokePoint} />);
  fireEvent.pointerMove(screen.getByTestId('route-map'), { pointerId: 7, clientX: 20, clientY: 30 });
  expect(onStrokePoint).toHaveBeenCalledWith(expect.objectContaining({ x: 20, y: 30 }));
  expect(props.stops).toEqual(originalStops);
});
```

The fake implements only the MapLibre methods/events crossed by `RouteMap`; put it in the test file and keep the production interface limited to domain/UI inputs and emitted events.

- [ ] **Step 2: Run the map test and verify the red state**

Run: `npm test -- src/map/RouteMap.test.tsx`

Expected: FAIL because `./RouteMap` does not exist.

- [ ] **Step 3: Initialize MapLibre and synchronize sources**

Use style URL `https://tiles.openfreemap.org/styles/liberty`, center `[-121.2722, 38.1342]`, overview zoom `12`, and built-in `NavigationControl`. Import `maplibre-gl/dist/maplibre-gl.css`. On style load, set the `natural_earth` layer's `raster-saturation` to `-0.15` when that layer exists, retaining recognizable natural colors with slightly reduced saturation. Then add stop/saved/reference/draft sources and Task 6 layers only when absent. Update existing `GeoJSONSource.setData` calls when props change; never rebuild the map for a mode transition.

On stop layer click, call `onSelectStop(String(feature.properties.id))`. Keep selected details in React, not MapLibre popup HTML.

- [ ] **Step 4: Implement camera and building visibility**

OpenFreeMap Liberty already defines `building-3d` from vector source `openmaptiles`, source-layer `building`. Apply:

```ts
map.easeTo(presentation === '3d'
  ? { pitch: 55, bearing: -12, duration: 500 }
  : { pitch: 0, bearing: 0, duration: 500 });
map.setLayoutProperty('building-3d', 'visibility', presentation === '3d' ? 'visible' : 'none');
```

After style load, default the extrusion to hidden for 2D. Keep all custom sources/layers above `building-3d` by adding them after the style finishes loading.

- [ ] **Step 5: Implement pointer capture and failure states**

Before construction, reject `!maplibregl.supported()` as `unsupported`. Convert `clientX/clientY` to map-local screen coordinates and call `map.unproject([x, y])`. Only when `drawingActive` and mode is Draw/Edit: capture mouse, touch, or Apple Pencil as ordinary Pointer Events on `pointerdown`, call stroke callbacks, and disable `dragPan` for the active pointer; restore `dragPan` on `pointerup`, `pointercancel`, mode change, and unmount. Set `touchAction: drawingActive ? 'none' : 'pan-x pan-y'` on the canvas container. On `pointerup`, convert and pass the final point to `onStrokeEnd(point)`. Map constructor exceptions emit `initialization`; style/tile `error` events emit `style`. A Retry button increments an internal map-generation key and reconstructs the adapter.

- [ ] **Step 6: Verify map behavior and commit**

Run: `npm test -- src/map/RouteMap.test.tsx src/map/StopLayer.test.ts src/map/RouteLayer.test.ts && npm run build`

Expected: PASS.

```bash
git add src/map src/components/Map.tsx src/test/setup.ts
git commit -m "feat: replace Leaflet with MapLibre map adapter"
```

---

### Task 8: Assemble Route Review Modes and the Option C Interface

**Files:**
- Create: `src/components/TopBar.tsx`
- Create: `src/components/RouteOverview.tsx`
- Create: `src/components/StatusBar.tsx`
- Create: `src/App.test.tsx`
- Rewrite: `src/App.tsx`
- Rewrite: `src/index.css`
- Modify: `src/main.tsx`
- Modify: `index.html`
- Delete: `src/App.css`
- Delete: `src/components/Toolbar.tsx`
- Delete: `src/components/StopList.tsx`
- Delete: `src/components/StatsBar.tsx`
- Delete: `src/data/sampleStops.ts`
- Delete: `src/assets/hero.png`
- Delete: `src/assets/react.svg`
- Delete: `src/assets/vite.svg`

**Interfaces:**
- Consumes: `RouteStore`, `DrawingController`, `routeMiles`, `RouteMap`, `MapPresentation`, `LODI_ROUTE`.
- Produces: `RouteReviewApp({ store? })`, visible View/Draw/Edit transitions, save-confirmation behavior, selected-stop details, import/export/reset controls, and save-status feedback.

- [ ] **Step 1: Write failing UI integration tests**

Mock only `RouteMap`, preserving its typed callback interface:

```tsx
it('draws independently of stops and saves processed geometry', async () => {
  const store = createMemoryRouteStore();
  const originalStops = store.getSnapshot().document.stops;
  const user = userEvent.setup();
  render(<RouteReviewApp store={store} />);
  await user.click(screen.getByRole('button', { name: 'Draw' }));
  expect(screen.queryByText('Lodi City Hall')).not.toBeInTheDocument(); // no stop list
  await user.click(screen.getByRole('button', { name: 'Start drawing' }));
  emitStroke([sampleA, sampleB, sampleC]);
  await user.click(screen.getByRole('button', { name: 'Save route' }));
  expect(store.getSnapshot().document.stops).toEqual(originalStops);
  expect(store.getSnapshot().document.route?.coordinates.length).toBeGreaterThanOrEqual(2);
});

it('keeps the original edit route until save and restores it on cancel', async () => {
  const store = createMemoryRouteStore(withSavedRoute());
  const original = structuredClone(store.getSnapshot().document.route);
  render(<RouteReviewApp store={store} />);
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
  await userEvent.click(screen.getByRole('button', { name: 'Redraw' }));
  emitStroke([sampleA, sampleB]);
  expect(store.getSnapshot().document.route).toEqual(original);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel drawing' }));
  expect(store.getSnapshot().document.route).toEqual(original);
});

it('selects a stop and exposes name, sequence, and coordinates', async () => {
  render(<RouteReviewApp store={createMemoryRouteStore()} />);
  selectStop('node-123');
  expect(screen.getByText('Stop 1 of 100')).toBeVisible();
  expect(screen.getByText(/38\.\d{4}, -121\.\d{4}/)).toBeVisible();
});
```

Also cover: mode-specific Start drawing/Redraw actions, Clear, whole-stroke Undo, replacement confirmation, mileage update after Save, invalid import message, reset, 2D/3D text state, and map error while Import/Export remain reachable.

- [ ] **Step 2: Run the UI tests and verify the red state**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL against the old dark Leaflet UI.

- [ ] **Step 3: Build the top-level transition model**

`RouteReviewApp` owns only UI mode, map presentation, selected stop ID, import error, map error, a `RouteStore` snapshot, and one stable `DrawingController`. Derive map geometries exactly as follows:

```ts
const savedRoute = mode === 'draw' ? null : document.route;
const referenceRoute = mode === 'edit' && drawing.active ? document.route : null;
const draftRoute = drawing.active ? drawing.geometry : null;
```

Entering modes cancels a draft without changing the document. Draw’s Start drawing hides the saved route. Edit’s Redraw keeps it as a faint reference. Save asks `Replace the saved route?` only when `document.route !== null`, then calls `store.replaceRoute(drawing.geometry!)`, cancels the draft, and returns to View. Cancel never touches the store. Clear calls only `drawing.clear()`.

Use an injected `store` prop for tests and a module-level browser-local store for production.

- [ ] **Step 4: Build the map-first controls and details**

`TopBar` renders text labels only: app name `Route Review`, route name, segmented View/Draw/Edit buttons with `aria-pressed`, and 2D/3D buttons with `aria-pressed`. `RouteOverview` renders stop total and route name by default; it switches to drawing instructions/actions while active and selected-stop details after selection. Put Import, Export, and Reset in a compact `Actions` disclosure inside the overview so they remain available in map-failure states. File import reads text and displays the exact `RouteDocumentError.message` returned by the store. Export creates `route-review-${routeId}.json`, clicks it, then revokes its object URL.

`StatusBar` renders `${stops.length} stops`, `${routeMiles(route).toFixed(1)} mi`, and one of `Saved locally`, `Unsaved`, or `Could not save locally`.

- [ ] **Step 5: Apply the Option C visual system and accessibility constraints**

Define CSS tokens:

```css
:root {
  color: #24262b;
  background: #f7f5ef;
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --surface: rgba(255, 254, 250, 0.94);
  --text: #24262b;
  --muted: #667085;
  --line: #d9dce3;
  --indigo: #4f46e5;
  --amber: #d97706;
  --danger: #b42318;
}

html, body, #root { width: 100%; height: 100%; overflow: hidden; overscroll-behavior: none; }
button, label[role="button"] { min-width: 44px; min-height: 44px; }
:focus-visible { outline: 3px solid #4f46e5; outline-offset: 2px; }
.app-shell { height: 100dvh; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
```

Use a compact top bar, full remaining map, upper-left floating overview card, and slim footer; never render a bottom stop list. Add a selected marker shape change and textual mode state. Update theme metadata in `index.html` to warm white, title to `Route Review`, and add manifest/Apple icon links prepared in Task 9. Remove emoji and all Leaflet CSS.

- [ ] **Step 6: Verify UI integration and commit**

Run: `npm test -- src/App.test.tsx && npm run lint && npm run build`

Expected: PASS with no Leaflet import or emoji in `src`.

```bash
git add src index.html
git commit -m "feat: build map-first Route Review interface"
```

---

### Task 9: Make the Static Build an Installable iPad PWA

**Files:**
- Modify: `vite.config.ts`
- Create: `public/manifest.webmanifest`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/apple-touch-icon.png`
- Create: `src/vite-env.d.ts`
- Create: `src/pwa.test.ts`
- Modify: `index.html`
- Delete: `public/icons.svg`

**Interfaces:**
- Consumes: the Vite app from Task 8.
- Produces: relative/base-path-safe assets, manifest, generated service worker, installable metadata, and iPad PNG icons.

- [ ] **Step 1: Write a failing production-artifact test**

```ts
// @vitest-environment node
import { access, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

it('emits installable PWA files with base-relative references', async () => {
  const html = await readFile('dist/index.html', 'utf8');
  expect(html).toContain('manifest.webmanifest');
  expect(html).not.toMatch(/(?:src|href)="\/(?:assets|manifest)/);
  await access('dist/manifest.webmanifest');
  await access('dist/sw.js');
  const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
  expect(manifest).toMatchObject({ name: 'Route Review', display: 'standalone' });
});
```

- [ ] **Step 2: Run the production test and verify the red state**

Run: `npm run build && npm test -- src/pwa.test.ts`

Expected: FAIL because no manifest/service worker exists.

- [ ] **Step 3: Configure Vite’s base and service worker**

Set `base: './'` so both GitHub Pages project paths and Tauri load assets. Add `VitePWA` with `registerType: 'autoUpdate'`, `injectRegister: 'auto'`, `manifest: false`, and Workbox glob patterns for HTML, JS, CSS, SVG, PNG, and WebP; the checked-in `public/manifest.webmanifest` is the single manifest source. Do not precache map tiles or remote OpenFreeMap resources.

Create a manifest with `name`/`short_name` `Route Review`, `start_url: './'`, `scope: './'`, `display: 'standalone'`, `background_color: '#f7f5ef'`, `theme_color: '#f7f5ef'`, and 192/512 maskable-capable PNG entries. Generate restrained indigo route-line icons as actual PNG files; the Apple icon is 180x180. Register `virtual:pwa-register` in `main.tsx`.

- [ ] **Step 4: Verify a served static production build**

Run:

```bash
npm run build
npm test -- src/pwa.test.ts
python3 -m http.server 4173 -d dist >/tmp/trash-routes-http.log 2>&1 & server=$!
sleep 1
curl --fail http://127.0.0.1:4173/ >/dev/null
curl --fail http://127.0.0.1:4173/manifest.webmanifest >/dev/null
kill $server
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the PWA distribution**

```bash
git add vite.config.ts public src/main.tsx src/vite-env.d.ts src/pwa.test.ts index.html
git commit -m "feat: package Route Review as an iPad PWA"
```

---

### Task 10: Add Browser Walkthrough Coverage

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/route-review.spec.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: production app from Task 9.
- Produces: Chromium desktop and WebKit iPad projects against `npm run preview -- --host 127.0.0.1`.

- [ ] **Step 1: Configure Playwright and install browsers**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-ipad', use: { ...devices['iPad Pro 11'] } },
  ],
});
```

Run: `npx playwright install chromium webkit`

- [ ] **Step 2: Write the walkthrough test**

Test these observable flows with accessible selectors: initial 100-stop overview; select a stop and inspect details; zoom until numbered stop labels are rendered; enter Draw, Start drawing, dispatch a mouse/pointer trace on the map canvas, verify Save enables, save, and observe mileage/save status; enter Edit, Redraw, trace, Cancel, and verify old mileage remains; Redraw again and Save; toggle 3D and assert the 3D button is pressed while overlays remain; export to a Playwright download, reset, import the downloaded JSON, and recover the route; inspect manifest response and service-worker registration on the iPad project.

Use route interception to fulfill the OpenFreeMap style URL with a minimal vector-compatible test style only in interaction tests, making CI deterministic while leaving one separate `@live-map` smoke test opt-in via `RUN_LIVE_MAP=1`.

```ts
test('route review draw, edit, and persistence walkthrough', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('100 stops')).toBeVisible();
  await page.getByRole('button', { name: 'Draw' }).click();
  await page.getByRole('button', { name: 'Start drawing' }).click();
  const map = page.getByTestId('route-map');
  const box = await map.boundingBox();
  if (!box) throw new Error('map has no layout box');
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 150, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Save route' })).toBeEnabled();
});
```

- [ ] **Step 3: Run browser verification and inspect both projects**

Run: `npm run test:e2e`

Expected: Chromium and WebKit projects pass. On failure, inspect `playwright-report/` and retained traces; do not weaken assertions around the acceptance flows.

- [ ] **Step 4: Commit browser coverage**

```bash
git add playwright.config.ts e2e .gitignore
git commit -m "test: cover desktop and iPad route workflows"
```

---

### Task 11: Add Tauri and GitHub Distribution Workflows

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/icons/icon.ico`
- Create: `src-tauri/icons/32x32.png`
- Create: `src-tauri/icons/128x128.png`
- Create: `src-tauri/icons/128x128@2x.png`
- Create: `.github/workflows/verify.yml`
- Create: `.github/workflows/pages.yml`
- Create: `.github/workflows/windows-release.yml`
- Create: `scripts/verify-distribution.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: static `dist/` from Task 9 and all checks from Tasks 1–10.
- Produces: thin Tauri bundle config, local distribution structure check, Pages artifact workflow, and version-tagged Windows `.exe` release workflow.

- [ ] **Step 1: Initialize the thin wrapper without adding application logic**

Use package identifier `com.trashroutes.routereview`, product name `Route Review`, `beforeDevCommand: npm run dev`, `devUrl: http://localhost:1420`, `beforeBuildCommand: npm run build`, and `frontendDist: ../dist`. Configure one 1180x820 resizable window with a 900x650 minimum and `bundle.targets: ['nsis']`. `main.rs` contains only:

```rust
fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Route Review");
}
```

Use Tauri 2 dependencies `tauri = { version = "2", features = [] }` and build dependency `tauri-build = { version = "2", features = [] }`. Generate checked-in icons with `npx tauri icon public/icons/icon-512.png`.

- [ ] **Step 2: Write and run a failing distribution structure check**

`scripts/verify-distribution.mjs` parses the three workflow YAML files as text plus `src-tauri/tauri.conf.json` and asserts:

- Pages workflow has `pages: write`, `id-token: write`, `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages`.
- Verify workflow runs `npm ci`, `npm run lint`, `npm test`, `npm run build`, and Chromium Playwright.
- Windows workflow triggers tags `v*`, runs on `windows-latest`, executes `npm ci`, and uses `tauri-apps/tauri-action` with release asset upload.
- Tauri `frontendDist` is `../dist`, product name is `Route Review`, and NSIS is a bundle target.

Run: `node scripts/verify-distribution.mjs`

Expected: FAIL before the workflows/config exist.

- [ ] **Step 3: Add least-privilege GitHub workflows**

`verify.yml`: pull requests and pushes; Ubuntu; checkout, Node setup with npm cache, `npm ci`, lint, unit tests, build, install Chromium, and Chromium Playwright.

`pages.yml`: pushes to the eventual default branch plus manual dispatch; permissions `contents: read`, `pages: write`, `id-token: write`; concurrency group `pages`; npm build; configure/upload/deploy Pages using `dist`. Keep relative Vite assets so no repository name is hard-coded.

`windows-release.yml`: tags `v*`; permissions `contents: write`; `windows-latest`; Rust stable; Node with npm cache; `npm ci`; unit/build checks; `tauri-apps/tauri-action` configured with `tagName: __VERSION__`, `releaseName: Route Review __VERSION__`, and draft release creation. The NSIS output provides the `.exe` installer.

- [ ] **Step 4: Verify local build/config structure**

Run:

```bash
npm run build
node scripts/verify-distribution.mjs
npm run tauri -- info
```

Expected: frontend build and structure checks pass; Tauri reports a valid project. Do not claim a Windows binary was built locally—the actual `.exe` is produced on `windows-latest` after publication and a version tag.

- [ ] **Step 5: Commit distribution automation**

```bash
git add src-tauri .github scripts/verify-distribution.mjs package.json package-lock.json
git commit -m "build: add Pages and Windows distributions"
```

---

### Task 12: Document Operation, Attribution, and Final Verification

**Files:**
- Rewrite: `README.md`
- Modify: `index.html`
- Remove if unused: `public/favicon.svg`

**Interfaces:**
- Consumes: all earlier tasks.
- Produces: operator/user documentation and one final verification record in the implementation completion report.

- [ ] **Step 1: Rewrite README around the delivered product**

Document exactly:

- `npm ci`, `npm run dev`, `npm test`, `npm run build`, `npm run test:e2e`, and serving `dist` with `python3 -m http.server -d dist`.
- Route Review modes: View selects fixed stops; Draw traces a replacement without changing stops; Edit redraws the saved route while preserving it until Save.
- Import/export schema and non-destructive invalid import behavior.
- Lodi fixture source: OpenStreetMap contributors, `https://www.openstreetmap.org/copyright`, retrieval date `2026-09-03`, checked-in source snapshot/query paths, and confirmation that private homes were excluded.
- iPad installation: Safari → Share → Add to Home Screen; iPadOS cannot run Windows `.exe` files.
- Windows download: create a `v*` tag after publishing to the engineer-selected repository, then download the NSIS `.exe` from the GitHub Release.
- GitHub Pages setup and the explicit blocker that this repository currently has no remote; repository selection and visibility remain engineer decisions.
- OpenFreeMap attribution and that no paid map key or application backend is required.

- [ ] **Step 2: Run the full automated verification from a clean dependency install**

```bash
rm -rf node_modules dist
npm ci
npm run lint
npm test
npm run build
node scripts/verify-distribution.mjs
npx playwright install chromium webkit
npm run test:e2e
npm run tauri -- info
git status --short
```

Expected: lint, unit/UI tests, static build, workflow/Tauri structure check, Chromium walkthrough, WebKit iPad walkthrough, and Tauri info all exit 0. `git status --short` contains no generated `dist`, Playwright report, test results, or `node_modules` entries.

- [ ] **Step 3: Perform the required visual browser walkthrough**

At desktop Chromium and iPad Pro 11 WebKit sizes, manually verify:

1. Warm-white Option C chrome, natural map, white-cased indigo route, no emoji, no dark prototype remnants, and exactly 100 overview points.
2. Panning, wheel/pinch zoom, zoom controls, adaptive sequence labels, persistent amber selected stop, and the compact name/coordinates/sequence card.
3. Draw with mouse and touch-style pointer input; confirm map pan is suspended only for the active drawing pointer; Clear and whole-stroke Undo; Save updates geometry mileage.
4. Edit with faint saved reference; Cancel restores it immediately; redraw and Save replaces it without any stop or sequence change.
5. 2D north-up/zero-pitch and 3D pitched buildings while stops, routes, selection, and drawing remain usable.
6. Invalid import identifies a field and preserves current data; export/reset/re-import succeeds; simulated storage failure keeps the in-memory route and reports the error.
7. Served `dist/` loads directly and under a nested base path; manifest, service worker, standalone metadata, safe areas, and 44px targets are present.
8. Simulated WebGL unsupported and style failure states show support/Retry messages while import/export remain available.

Record any discrepancy as a failing test or a concrete repair before completion.

- [ ] **Step 4: Commit documentation and any verification-driven repairs**

```bash
git add README.md index.html public src e2e scripts
git commit -m "docs: explain Route Review installation and data"
```

Do not create an empty commit if verification required no tracked repair outside `README.md`.

- [ ] **Step 5: Report publication boundaries accurately**

State that the static/PWA build and local Tauri configuration were verified; state that Pages publication and the Windows `.exe` remain pending until the engineer selects a GitHub repository/visibility, pushes the commits, enables Pages via Actions, and creates a `v*` tag.
