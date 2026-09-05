# Route-day PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing Lodi Route Review PWA into a route → route-day presentation tool with tap/drag stop sequencing and reorder-only editing.

**Architecture:** Keep the existing React/Vite/TypeScript/MapLibre PWA. Replace the single route document with a validated route/day document whose ordered stop IDs are the source of truth; derive straight-segment GeoJSON lines from that order. Add route and day selection before the existing map workspace, then adapt the map gesture layer and local store to operate on one selected day.

**Tech Stack:** React 19, TypeScript, Vite, MapLibre GL, OpenFreeMap vector tiles, `vite-plugin-pwa`, Vitest, Testing Library, Playwright, existing npm toolchain.

**Spec:** `docs/superpowers/specs/2026-09-05-route-day-pwa-design.md`

## Global Constraints

- The repository is established; keep its existing React 19, TypeScript, Vite, MapLibre GL, OpenFreeMap, Vitest, Playwright, and `vite-plugin-pwa` stack.
- **Stack deviations: none.** Do not add a backend, database, authentication, routing service, or new frontend framework.
- Only the selected route day may be rendered in the workspace map.
- A saved sequence must contain every fixed stop exactly once.
- Draw and Edit must support both taps and continuous pointer drags across stops.
- Edit may reorder existing stops but may not add or remove stop membership.
- Route lines use straight segments between ordered stop coordinates; do not add road routing.
- Preserve the existing uncommitted changes in `src/map/RouteMap.tsx` and `src/map/RouteMap.test.tsx`.
- Preserve relative GitHub Pages paths, PWA manifest/icons/service worker, JSON import/export, local persistence, map-error recovery, and OSM/OpenFreeMap attribution.
- Do not claim offline basemap support; only the app shell and local route data may be available without network tiles.

---

### Task 1: Add schema-v2 route and route-day domain model

**Files:**
- Modify: `src/domain/routeDocument.ts`
- Modify: `src/domain/routeDocument.test.ts`
- Create/modify: `src/data/lodiRoute.test.ts` only if its fixtures need v2 helpers

**Interfaces:**
- Produces `TrashStop`, `RouteDay`, `TrashRoute`, and schema-v2 `RouteDocument` types.
- Produces `parseRouteDocument(value: unknown): RouteDocument` for schema version 2.
- Produces `migrateRouteDocument(value: unknown): unknown`, which wraps a validated schema-v1 document in one route and one day while preserving stop data and sequence order.
- Produces `orderedStops(day: RouteDay): TrashStop[]`, returning stops in `day.stopOrder` order.

- [ ] **Step 1: Write failing v2 validation tests**

Add tests covering:

```ts
it('parses one route containing multiple days and ordered stop IDs', () => {
  const document = parseRouteDocument({
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
  });
  expect(document.routes[0].days[0].stopOrder).toEqual(['b', 'a']);
});
```

Also test rejection of duplicate route/day/stop IDs, duplicate stop IDs within a day, unknown IDs in `stopOrder`, duplicate IDs in `stopOrder`, invalid coordinates, and a sequence that does not contain every stop when the document is saved/configured.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
npm test -- src/domain/routeDocument.test.ts
```

Expected: FAIL because the current parser only accepts schema version 1 and `TrashStop` currently owns the sequence number.

- [ ] **Step 3: Implement schema-v2 types and validation**

Use this shape:

```ts
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
```

Keep field-level `RouteDocumentError` messages. Validate all IDs, require each `stopOrder` ID to belong to the day, and permit an empty order for an unconfigured day. Preserve cloning and coordinate bounds.

- [ ] **Step 4: Implement schema-v1 migration and ordered-stop helper**

Convert the existing v1 shape as follows:

```ts
{
  schemaVersion: 2,
  routes: [{
    id: legacy.routeId,
    name: legacy.routeName,
    days: [{
      id: `${legacy.routeId}-day-1`,
      name: 'Route day',
      stops: legacy.stops.map(({ id, name, lat, lng }) => ({ id, name, lat, lng })),
      stopOrder: legacy.stops
        .toSorted((left, right) => left.sequence - right.sequence)
        .map((stop) => stop.id),
    }],
  }],
}
```

`migrateRouteDocument` must reject malformed legacy input through the same parser path rather than silently constructing partial data. `orderedStops` must return an empty array for an empty order and preserve the order IDs exactly.

- [ ] **Step 5: Run the focused tests and verify they pass**

Run:

```bash
npm test -- src/domain/routeDocument.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the domain model**

```bash
git add src/domain/routeDocument.ts src/domain/routeDocument.test.ts src/data/lodiRoute.test.ts
git commit -m "feat: model routes and route days"
```

---

### Task 2: Derive straight route geometry from stop order

**Files:**
- Modify: `src/domain/routeGeometry.ts`
- Modify: `src/domain/routeGeometry.test.ts`
- Modify: `src/map/RouteLayer.ts`
- Modify: `src/map/StopLayer.ts`
- Modify: corresponding map-layer tests

**Interfaces:**
- Produces `stopOrderToGeometry(stops: TrashStop[], stopOrder: string[]): RouteGeometry | null`.
- Updates `stopsToGeoJson(stops: TrashStop[], stopOrder: string[], selectedStopId: string | null)` to project display sequence numbers for map layers.
- Keeps `routeMiles(route: RouteGeometry | null): number` as the distance calculator.
- `routeToGeoJson` continues to consume `RouteGeometry | null`.

- [ ] **Step 1: Write failing geometry tests**

Add tests such as:

```ts
it('creates a line in the requested stop order', () => {
  const stops = [
    { id: 'a', name: 'A', lat: 38.13, lng: -121.28 },
    { id: 'b', name: 'B', lat: 38.14, lng: -121.27 },
    { id: 'c', name: 'C', lat: 38.15, lng: -121.26 },
  ];
  expect(stopOrderToGeometry(stops, ['c', 'a', 'b'])).toEqual({
    coordinates: [[-121.26, 38.15], [-121.28, 38.13], [-121.27, 38.14]],
  });
});

it('returns null until a complete valid order has at least two stops', () => {
  expect(stopOrderToGeometry([], [])).toBeNull();
});
```

Test unknown IDs, duplicate IDs, incomplete orders, and the display sequence numbers for unselected and selected stops.

- [ ] **Step 2: Run focused geometry and layer tests to verify failure**

```bash
npm test -- src/domain/routeGeometry.test.ts src/map/RouteLayer.test.ts src/map/StopLayer.test.ts
```

Expected: FAIL because current geometry is generated from arbitrary pointer samples and stop properties use the legacy `sequence` field.

- [ ] **Step 3: Implement order-derived geometry and map projections**

Implement `stopOrderToGeometry` with direct `[lng, lat]` coordinates. It must return null for fewer than two unique valid stops and never fabricate coordinates. Update stop GeoJSON properties so configured stops receive their 1-based position and unconfigured stops receive a non-number/hidden label state. Keep layer styling stable while making the saved route line reflect the derived coordinates.

- [ ] **Step 4: Run focused tests to verify pass**

```bash
npm test -- src/domain/routeGeometry.test.ts src/map/RouteLayer.test.ts src/map/StopLayer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit geometry changes**

```bash
git add src/domain/routeGeometry.ts src/domain/routeGeometry.test.ts src/map/RouteLayer.ts src/map/StopLayer.ts src/map/RouteLayer.test.ts src/map/StopLayer.test.ts
git commit -m "feat: derive route lines from stop order"
```

---

### Task 3: Build a one-route, multi-day Lodi fixture

**Files:**
- Modify: `scripts/build-lodi-fixture.mjs`
- Replace/update: `src/data/lodiRoute.json`
- Modify: `src/data/lodiRoute.ts`
- Modify: `src/data/lodiRoute.test.ts`
- Keep: `data/lodi-osm-source.json`, `data/lodi-overpass-query.txt`, and OSM attribution metadata

**Interfaces:**
- Produces a schema-v2 `LODI_ROUTE` document with one route and several days.
- The fixture generator remains deterministic and uses only the checked-in source snapshot.
- The fixture has exactly 100 public POIs, divided deterministically into named days such as Monday through Friday, with every day’s `stopOrder` containing each of its stops exactly once.

- [ ] **Step 1: Write failing fixture invariants**

Extend `src/data/lodiRoute.test.ts` to assert:

```ts
expect(LODI_ROUTE.schemaVersion).toBe(2);
expect(LODI_ROUTE.routes).toHaveLength(1);
expect(LODI_ROUTE.routes[0].days.length).toBeGreaterThanOrEqual(3);
expect(LODI_ROUTE.routes[0].days.flatMap((day) => day.stops)).toHaveLength(100);
for (const day of LODI_ROUTE.routes[0].days) {
  expect(new Set(day.stopOrder).size).toBe(day.stops.length);
  expect(day.stopOrder).toHaveLength(day.stops.length);
}
```

- [ ] **Step 2: Run the fixture test to verify failure**

```bash
npm test -- src/data/lodiRoute.test.ts
```

Expected: FAIL because the checked-in fixture is schema v1 with one stop list.

- [ ] **Step 3: Update the deterministic fixture generator**

Keep the existing source filtering and attribution. Partition the deterministic POI list into five stable groups, assign names Monday–Friday, and emit one route named `Lodi Demo Route`. Within each day, emit fixed stop records without sequence fields and emit `stopOrder` as the deterministic order for that day. Do not query the network during build or test.

- [ ] **Step 4: Regenerate and validate the fixture**

```bash
node scripts/build-lodi-fixture.mjs
npm test -- src/data/lodiRoute.test.ts
```

Expected: the generated JSON is stable, has one route, several days, and exactly 100 stops; the focused test passes.

- [ ] **Step 5: Commit the fixture**

```bash
git add scripts/build-lodi-fixture.mjs src/data/lodiRoute.json src/data/lodiRoute.ts src/data/lodiRoute.test.ts
 git commit -m "feat: split Lodi demo into route days"
```

---

### Task 4: Update local persistence, import/export, and day-order writes

**Files:**
- Modify: `src/store/RouteStore.ts`
- Modify: `src/store/RouteStore.test.ts`
- Modify: any tests/fixtures that construct `RouteDocument`

**Interfaces:**
- `RouteStore` continues to expose `getSnapshot`, `subscribe`, `importJson`, `exportJson`, and `reset`.
- Produces `replaceDayOrder(routeId: string, dayId: string, stopOrder: string[]): void`.
- Constructor accepts schema-v2 fallback data and migrates schema-v1 local storage before use.
- Import validation remains non-destructive.

- [ ] **Step 1: Write failing store tests**

Add tests for:

```ts
it('migrates a saved v1 document and exposes route days', () => {
  const storage = memoryStorage(JSON.stringify(legacyDocument));
  const store = new RouteStore(storage, LODI_ROUTE);
  expect(store.getSnapshot().document.schemaVersion).toBe(2);
  expect(store.getSnapshot().document.routes[0].days).toHaveLength(1);
});

it('replaces only the selected day order and persists it', () => {
  const store = new RouteStore(memoryStorage(), LODI_ROUTE);
  const day = LODI_ROUTE.routes[0].days[0];
  const reversed = [...day.stopOrder].reverse();
  store.replaceDayOrder(LODI_ROUTE.routes[0].id, day.id, reversed);
  expect(store.getSnapshot().document.routes[0].days[0].stopOrder).toEqual(reversed);
});
```

Also test unknown route/day IDs, incomplete/duplicate orders, reset to fixture, invalid v2 import, and storage errors.

- [ ] **Step 2: Run store tests to verify failure**

```bash
npm test -- src/store/RouteStore.test.ts
```

Expected: FAIL because the store currently replaces one top-level route geometry and has a v1 storage key/shape.

- [ ] **Step 3: Implement v2 store behavior**

Use a v2 storage key, but first read the existing `trash-routes-route-document-v1` key when the v2 key is absent. On construction, parse stored JSON; if it is v1, call `migrateRouteDocument`, validate the migrated result, and persist the v2 result. `replaceDayOrder` must validate that the order contains exactly the target day’s stop IDs before persisting. Keep `saved`, `unsaved`, and `storage-error` status transitions and leave the current document unchanged on invalid import or failed write.

- [ ] **Step 4: Run store tests to verify pass**

```bash
npm test -- src/store/RouteStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit persistence changes**

```bash
git add src/store/RouteStore.ts src/store/RouteStore.test.ts
 git commit -m "feat: persist route day sequences"
```

---

### Task 5: Replace freehand drawing with stop-sequence controller

**Files:**
- Create: `src/domain/StopSequenceController.ts`
- Create: `src/domain/StopSequenceController.test.ts`
- Remove or stop importing: `src/domain/DrawingController.ts`
- Modify: `src/domain/routeGeometry.ts` only if controller needs a shared completeness helper

**Interfaces:**

```ts
export type SequenceMode = 'draw' | 'edit';

export interface StopSequenceSnapshot {
  active: boolean;
  pointerActive: boolean;
  sequence: string[];
  canUndo: boolean;
  canSave: boolean;
  validationMessage: string | null;
}

export class StopSequenceController {
  start(mode: SequenceMode, allowedStopIds: string[]): StopSequenceSnapshot;
  contactStop(stopId: string): StopSequenceSnapshot;
  beginPointer(): StopSequenceSnapshot;
  endPointer(): StopSequenceSnapshot;
  undo(): StopSequenceSnapshot;
  clear(): StopSequenceSnapshot;
  cancel(): StopSequenceSnapshot;
  snapshot(): StopSequenceSnapshot;
}
```

`start('draw', ids)` begins with an empty sequence. `start('edit', ids)` also begins a new working order but limits contacts to the existing IDs. `canSave` is true only when every allowed ID appears exactly once.

- [ ] **Step 1: Write failing controller tests**

Cover:

```ts
it('appends a contacted stop once and reports completeness', () => {
  const controller = new StopSequenceController();
  controller.start('draw', ['a', 'b']);
  controller.contactStop('a');
  expect(controller.contactStop('a').sequence).toEqual(['a']);
  expect(controller.contactStop('b')).toMatchObject({ sequence: ['a', 'b'], canSave: true });
});
```

Also test ignored unknown IDs, drag-style repeated contacts, undo removes the last selected stop, clear, cancel, edit allowed-membership restriction, incomplete validation, and a fresh edit sequence leaving the saved order untouched until the app saves it.

- [ ] **Step 2: Run controller tests to verify failure**

```bash
npm test -- src/domain/StopSequenceController.test.ts
```

Expected: FAIL because only the freehand `DrawingController` exists.

- [ ] **Step 3: Implement the controller**

Maintain a working sequence and a history of sequence snapshots for undo. `contactStop` appends only an allowed ID not already present. Do not store pointer coordinates or arbitrary geometry. `snapshot` reports a message such as `Select all N stops before saving` while incomplete and returns `canSave: true` only for a complete sequence.

- [ ] **Step 4: Run controller tests to verify pass**

```bash
npm test -- src/domain/StopSequenceController.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the controller**

```bash
git add src/domain/StopSequenceController.ts src/domain/StopSequenceController.test.ts
 git commit -m "feat: sequence stops with tap and drag"
```

---

### Task 6: Adapt MapLibre layers and pointer hit-testing

**Files:**
- Modify: `src/map/RouteMap.tsx`
- Modify: `src/map/RouteMap.test.tsx`
- Modify: `src/map/StopLayer.ts`
- Modify: `src/map/RouteLayer.ts`
- Preserve: the existing uncommitted `RouteMap.tsx` and `RouteMap.test.tsx` changes, including the 3D zoom update

**Interfaces:**
- `RouteMapProps` consumes selected-day stops, saved order geometry, reference order geometry, draft order geometry, and `onStopContact(stopId: string)`.
- MapLibre pointer handling calls `onStopContact` for the nearest rendered stop within a small screen-space hit radius.
- Existing map errors, retry behavior, camera handling, 2D/3D state, and map-ready test IDs remain available.

- [ ] **Step 1: Write failing map tests**

Add mock-map coverage for:

```ts
it('contacts the nearest stop while sequencing', () => {
  map.queryRenderedFeatures.mockReturnValue([
    { properties: { id: 'stop-b' }, geometry: { type: 'Point', coordinates: [-121.27, 38.14] } },
  ]);
  render(<RouteMap {...propsForDrawMode} />);
  fireEvent.pointerDown(screen.getByTestId('route-map'), { pointerId: 1, clientX: 100, clientY: 80 });
  expect(propsForDrawMode.onStopContact).toHaveBeenCalledWith('stop-b');
});
```

Test repeated pointer moves, pointer capture/release, map drag-pan disable/enable, no stop hit, and preservation of the current `getZoom()` 3D behavior.

- [ ] **Step 2: Run map tests to verify failure**

```bash
npm test -- src/map/RouteMap.test.tsx
```

Expected: FAIL because the current props and callbacks consume arbitrary `ScreenGeoPoint` strokes.

- [ ] **Step 3: Implement stop hit-testing and layer updates**

Use `queryRenderedFeatures` with the `stop-point` layer and a small bounding box around the pointer coordinate; choose the nearest feature when multiple stops fall inside the box. On a valid contact, call `onStopContact`. Disable map panning for an active Draw/Edit pointer sequence, release pointer capture on pointer up/cancel, and restore panning. Keep map panning and stop selection behavior in View mode.

- [ ] **Step 4: Run map tests to verify pass**

```bash
npm test -- src/map/RouteMap.test.tsx src/map/RouteLayer.test.ts src/map/StopLayer.test.ts
```

Expected: PASS, including the pre-existing 3D zoom expectation and the uncommitted camera changes.

- [ ] **Step 5: Commit map integration**

```bash
git add src/map/RouteMap.tsx src/map/RouteMap.test.tsx src/map/StopLayer.ts src/map/RouteLayer.ts
 git commit -m "feat: connect map gestures to stop sequencing"
```

If the two pre-existing map edits are intentionally user-owned, include them in this commit only after confirming they still pass; never discard them to resolve conflicts.

---

### Task 7: Add route/day selection and compose the workspace modes

**Files:**
- Create: `src/components/RouteSelector.tsx`
- Create: `src/components/DaySelector.tsx`
- Create: `src/components/InstallHelp.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/TopBar.tsx`
- Modify: `src/components/RouteOverview.tsx`
- Modify: `src/index.css`

**Interfaces:**
- `RouteSelectorProps` accepts `routes: TrashRoute[]` and `onSelectRoute(routeId: string): void`.
- `DaySelectorProps` accepts `route: TrashRoute`, `onSelectDay(dayId: string): void`, and `onBack(): void`.
- `RouteReviewApp` owns `selectedRouteId`, `selectedDayId`, `mode`, and the `StopSequenceController` snapshot.
- The existing JSON import/export/reset actions remain available only when a document is loaded and continue to operate on the complete v2 document.

- [ ] **Step 1: Write failing app/component tests**

Replace the legacy one-document assumptions with tests such as:

```tsx
it('selects a route then a day before showing its workspace', async () => {
  const user = userEvent.setup();
  render(<RouteReviewApp store={createMemoryRouteStore()} />);
  expect(screen.getByRole('heading', { name: 'Routes' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: /Lodi Demo Route/ }));
  expect(screen.getByRole('heading', { name: 'Route days' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: /Monday/ }));
  expect(screen.getByTestId('route-map')).toBeVisible();
  expect(screen.getByText(/Lodi Demo Route.*Monday/)).toBeVisible();
});
```

Also test View with only the selected day’s stops, Draw completeness/save, Edit save/cancel preserving membership, route/day switching, and an install-help dialog with Safari instructions.

- [ ] **Step 2: Run app tests to verify failure**

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL because the current app renders the map immediately and assumes one top-level route.

- [ ] **Step 3: Implement selection screens and app state**

Render route selection when no route is selected, day selection when a route is selected but no day is selected, and the workspace otherwise. Use the selected day’s `stops` and `stopOrder` to derive all map props. Initialize View with the saved order; initialize Draw/Edit with the controller rules from Task 5. Save calls `store.replaceDayOrder`, then returns to View. Route/day switch resets any working controller state without changing saved data.

- [ ] **Step 4: Implement iPad presentation controls and install guidance**

Keep controls at least 44 CSS pixels tall, add safe-area padding, ensure the map remains the dominant workspace, and label the active route and day. `InstallHelp` must state that the app must be opened over HTTPS, then explain Safari Share → Add to Home Screen; optionally use `beforeinstallprompt` where supported without hiding the iPad fallback.

- [ ] **Step 5: Run app tests to verify pass**

```bash
npm test -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit the application flow**

```bash
git add src/App.tsx src/App.test.tsx src/components/RouteSelector.tsx src/components/DaySelector.tsx src/components/InstallHelp.tsx src/components/TopBar.tsx src/components/RouteOverview.tsx src/index.css
 git commit -m "feat: add route and route day selection"
```

---

### Task 8: Update PWA checks, documentation, and browser walkthroughs

**Files:**
- Modify: `src/pwa.test.ts`
- Modify: `e2e/route-review.spec.ts`
- Modify: `README.md`
- Modify: `public/manifest.webmanifest` only if app copy or icons need correction
- Modify: `vite.config.ts` only if the existing service-worker output fails the new checks

**Interfaces:**
- Production build continues to emit `dist/index.html`, `dist/manifest.webmanifest`, `dist/sw.js`, and relative asset references.
- E2E suite continues to cover both `chromium-desktop` and `webkit-ipad` projects.
- README documents the route → day → workspace flow and the exact iPad installation path.

- [ ] **Step 1: Extend PWA and E2E tests before implementation changes**

Add checks for:

```ts
expect(manifest).toMatchObject({
  name: 'Route Review',
  display: 'standalone',
  start_url: './',
  scope: './',
});
```

Update the route walkthrough to select `Lodi Demo Route`, select `Monday`, contact fixture stops through a deterministic mock/map interaction, save, enter Edit, create a different complete order, verify Cancel restores the original, then verify Save persists after reload. Keep manifest/service-worker checks and the existing 2D/3D, export/import, camera, and map-error coverage.

- [ ] **Step 2: Run the browser tests to verify the expected failures**

```bash
npm run build
npm run test:e2e
```

Expected: the legacy route walkthrough assertions fail until the new selection and sequencing UI is implemented; PWA asset checks should remain green unless output paths changed.

- [ ] **Step 3: Update the documentation and any PWA metadata**

Document that GitHub Pages must be configured to deploy the existing Pages workflow, the PWA is installed in Safari with Share → Add to Home Screen, local route edits persist per browser, and basemap tiles require network access. Keep the existing OSM/OpenFreeMap attribution and Lodi source snapshot references.

- [ ] **Step 4: Run the complete verification suite**

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Expected: all commands exit 0 for both desktop Chromium and iPad WebKit. The optional live map smoke remains opt-in:

```bash
RUN_LIVE_MAP=1 npm run test:e2e -- --grep "live OpenFreeMap"
```

- [ ] **Step 5: Inspect the final diff and commit release checks**

```bash
git diff HEAD~1 --check
git status --short
git add src/pwa.test.ts e2e/route-review.spec.ts README.md public/manifest.webmanifest vite.config.ts
git commit -m "test: verify route day PWA workflows"
```

Do not claim GitHub Pages publication is complete until the repository has a remote and the workflow has run successfully; local verification only proves the build artifact and workflow configuration.

---

## Plan self-review

- **Spec coverage:** route/day selection (Task 7), selected-day-only map (Tasks 6–7), Draw/Edit behavior and completeness (Tasks 5–7), straight geometry (Task 2), v1 migration and persistence (Tasks 1 and 4), Lodi fixture (Task 3), PWA/install/Pages behavior (Task 8), error handling and existing import/export/map recovery (Tasks 4, 6, 7, and 8), and domain/UI/browser tests (all tasks).
- **Completeness scan:** every task has named files, interfaces, focused commands, and a commit boundary; no implementation step is left unspecified.
- **Type consistency:** Task 1 defines v2 types; Tasks 2, 4, 5, 6, and 7 consume those types and name the store/controller/map interfaces used later. The plan consistently uses `stopOrder` as the source of truth.
- **Repository safety:** the existing uncommitted MapLibre 3D zoom changes are explicitly preserved and tested in Task 6.
