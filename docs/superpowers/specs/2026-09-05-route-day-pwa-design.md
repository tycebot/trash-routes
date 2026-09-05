# Route-day PWA design

## Status

Approved design for the next implementation cycle. This document describes the evolution of the existing `trash-routes` application; it is not a greenfield rewrite.

## Product goal

Provide an iPad-friendly route presentation tool for a driver or planner:

1. Open the app.
2. Select a route/area.
3. Select a route day within that route.
4. Review, draw, or reorder that one day’s stop sequence on a map.

Only the selected route day is rendered on the workspace map. The initial demonstration uses one Lodi, California route containing several days and 100 public OpenStreetMap points of interest. The data model must support additional routes later.

## Stack decision

The repository is established. Keep its existing React 19, TypeScript, Vite, MapLibre GL, OpenFreeMap, Vitest, Playwright, and `vite-plugin-pwa` stack. The existing stack already provides the map, PWA packaging, GitHub Pages deployment, and test harness needed for this change.

**Stack deviations: none.** Do not add a backend, database, authentication, routing service, or new frontend framework for this proof of concept.

## Scope

### In scope

- Route selection screen followed by route-day selection screen.
- One selected route day in the map workspace at a time.
- View, Draw, and Edit modes.
- Fixed stop points with ordered sequence numbers.
- Tap-or-drag stop sequencing for Draw and Edit.
- Straight line segments between ordered stop coordinates.
- Local browser persistence, JSON import/export, and reset.
- Installable GitHub Pages PWA behavior and iPad install guidance.
- Lodi demo fixture generated from the checked-in OSM/Overpass snapshot.

### Out of scope

- Shared multi-user editing, accounts, permissions, or a server API.
- CSV import in this cycle; keep the schema and fixture boundary ready for it later.
- Road-following route calculation.
- Arbitrary line geometry independent of stops.
- Offline basemap tiles. The installed app shell and route data may be available offline, but OpenFreeMap tiles require network access.
- Windows packaging changes unless required by the existing build.

## Data model

Replace the current single-route document shape with schema version 2:

```text
RouteDocument
  schemaVersion: 2
  routes[]
    id
    name
    days[]
      id
      name
      stops[]
        id
        name
        lat
        lng
      stopOrder: string[]
```

`stopOrder` contains each stop ID at most once. It is the source of truth for numbering and line construction. The highlighted line is derived by mapping the ordered IDs to stop coordinates; no independently editable geometry is stored.

A day may have a null/empty `stopOrder` when it has fixed points but no configured sequence yet. The View screen then shows points and an instruction to use Draw.

The checked-in Lodi fixture will contain one route with several named days and a deterministic distribution of the 100 source POIs. The source attribution, retrieval metadata, query, and snapshot remain checked in.

### Migration

`RouteStore` must accept the existing schema-v1 local-storage document and migrate it once into schema v2 without losing its route name, stops, or existing sequence. The checked-in fixture becomes the reset/default v2 document. Invalid saved data falls back to the checked-in fixture as it does today.

## User experience

### Selection

- Routes screen shows route cards with route name and day count.
- Selecting a route opens its day list.
- Day cards show day name, stop count, and whether a sequence is configured.
- Selecting a day opens the workspace.
- The workspace header identifies both route and day and provides a route/day switcher.

The initial demo intentionally has one route so the hierarchy is demonstrated without pretending to have multiple operational areas.

### View mode

- Show every fixed stop for the selected day.
- Show numbered markers according to `stopOrder` when a sequence exists.
- Show a highlighted polyline made of straight segments between ordered stops.
- Selecting a stop shows its name, number, and coordinates.
- If no sequence exists, do not invent a line.

### Draw mode

- Begin with the day’s fixed stops visible and an empty working `stopOrder`.
- A pointer tap or continuous pointer drag can contact stops.
- Contacting a new stop appends its ID once and immediately updates its number and the straight-segment preview line.
- Already-selected stops are ignored during the gesture.
- Use sufficiently large hit regions for finger and Apple Pencil input.
- Map panning is disabled for the active sequencing gesture and restored afterward.
- Provide Undo, Clear, Cancel, and Save.
- Save is disabled until at least two distinct stops are selected.
- Save replaces only the selected day’s order and persists it locally.

### Edit mode

- Start with the saved sequence and line visible as a faint reference.
- Starting a new order uses the same tap-or-drag stop-sequencing gesture as Draw, limited to the existing stop membership.
- The new bold line and numbers preview the reordered sequence while the original remains unchanged.
- Save replaces the selected day’s saved order.
- Cancel discards the working order and restores the original immediately.
- Edit cannot add or remove stops.

## Persistence and PWA

- Persist the v2 document in the existing local-storage adapter, keyed by route/day data as part of the document.
- Expose saved, unsaved, and storage-error status.
- Keep JSON import/export and reset, validating imported documents before replacement.
- Preserve `base: './'`, manifest, icons, service worker generation, and Pages workflow.
- Add an in-app Install on iPad action explaining HTTPS hosting and Safari Share → Add to Home Screen. If the browser exposes `beforeinstallprompt`, the action may use it; iPad Safari must still have the explanatory fallback.
- Ensure all built asset references work below a GitHub Pages project path.

## Map and rendering

Keep MapLibre and the existing OpenFreeMap style. Add/update map sources and layers so the selected day’s stops, saved sequence, edit reference, and working sequence can be rendered independently. The route line is a GeoJSON LineString derived from stops in `stopOrder`.

Map initialization failures, WebGL absence, style errors, and unavailable tiles must remain non-fatal to local data, import, and export operations. Preserve existing attribution and OSM/OpenFreeMap notices.

## Implementation boundaries

- `src/domain/routeDocument.ts`: schema-v2 types, validation, cloning, and v1 migration.
- `src/domain/DrawingController.ts` or a focused replacement: tap/drag stop sequencing, duplicate suppression, undo, clear, cancel, and snapshots.
- `src/domain/routeGeometry.ts`: derive straight-segment display geometry from ordered stops and retain mileage behavior appropriate to the new geometry.
- `src/store/RouteStore.ts`: v2 persistence, migration, selected-day updates, import/export/reset.
- `src/components/`: route selector, day selector, workspace controls, install guidance, and existing overview updates.
- `src/map/`: selected-day stop and sequence layers plus touch hit-testing/gesture integration.
- `src/data/` and fixture script: one Lodi route with several days from the existing OSM snapshot.
- `src/**/*.test.*` and Playwright tests: domain, UI integration, PWA, and browser workflows.

Keep the existing uncommitted changes in `src/map/RouteMap.tsx` and `src/map/RouteMap.test.tsx`; do not reset or overwrite them.

## Verification criteria

- A fresh build emits an installable PWA with relative paths, manifest, icons, and service worker.
- GitHub Pages deployment succeeds under a project subpath.
- Route selection followed by day selection opens only that day’s points and line.
- Draw supports both taps and drag-through sequencing, ignores duplicates, and persists on Save.
- Edit redraws the order using the same gesture, keeps membership unchanged, and correctly handles Save/Cancel.
- View derives numbering and line geometry from the saved order.
- Local storage, import validation, reset, and map-error behavior retain existing guarantees.
- Existing desktop and iPad-sized browser workflows continue to pass.
- `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` pass.
