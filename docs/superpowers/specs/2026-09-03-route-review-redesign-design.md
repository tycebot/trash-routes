# Route Review Redesign

Date: 2026-09-03
Status: Approved visual and interaction design

## Purpose

Route Review is a static, iPad-friendly web application for reviewing and manually tracing trash collection routes. A route normally contains about 100 stops and may contain up to 200. Each stop comes from an internal system and has a stable ID, name, latitude, longitude, and sequence position.

The application must make the full route understandable at overview scale while supporting street-level inspection and finger-based route drawing. It must be downloadable as a static build and runnable from any ordinary HTTP server without a backend.

## Stack decision

This is an established React and Vite web repository. Keep React 19, TypeScript, Vite, Tailwind CSS, npm, and browser-local persistence.

Replace Leaflet with MapLibre GL JS because the approved design requires vector-map styling, pitch, and 3D building extrusion. Leaflet cannot provide the required 3D presentation.

- **Approved option considered:** Existing Leaflet map.
- **Why insufficient:** Leaflet supports the current 2D raster map but not a genuine pitched map with vector building extrusion.
- **Proposed deviation:** MapLibre GL JS with OpenFreeMap vector tiles.
- **Justification:** This supplies key-free vector rendering, adaptive labels, map pitch, and 3D buildings while preserving a static, backend-free deployment.

The web application introduces no backend, database, container, or hosted service. A thin Tauri 2 desktop wrapper is added only for the requested Windows executable.

- **Approved option considered:** Distribute only the static web/PWA build.
- **Why insufficient:** A static web build cannot satisfy the explicit requirement for a downloadable Windows `.exe`.
- **Proposed deviation:** Tauri 2 and its Rust build toolchain, built on GitHub Actions Windows runners.
- **Justification:** Tauri reuses the same frontend and the operating system WebView, producing a substantially smaller desktop package than bundling a second browser runtime with Electron. End users do not need Rust installed.

## Visual direction

Use the approved Option C treatment:

- Light, restrained interface with warm-white surfaces, charcoal text, and cool-gray secondary text.
- Natural-color map with slightly reduced saturation so geographic context remains recognizable without overpowering operational data.
- Indigo route line with a white outer casing to remain visible over every road and land-use color.
- Stop markers use white centers, indigo outlines, and a subtle outer halo.
- Amber is reserved for selected stops and active drawing state; it is not used for every stop.
- No emoji, novelty icons, pixel art, or decorative game effects.
- Controls use text labels: View, Draw, Edit, 2D, and 3D.

The layout is map-first. A compact top bar contains the app name, route name, mode control, and 2D/3D control. A small route-overview card overlays the upper-left map area. A slim footer contains stop count, route mileage, and save status. There is no bottom list of stops.

## Map and stop presentation

The default demo is centered on Lodi, California and contains approximately 100 real public points of interest sourced from OpenStreetMap. Prefer named businesses, civic facilities, banks, restaurants, schools, public waste facilities, and other public-facing locations in and immediately around Lodi. Do not use private homes or personal residential data. Store the selected fixture in the repository with source attribution and retrieval date so the demo does not depend on a live search service.

All stops remain visible at every useful zoom level. Labels adapt by zoom:

- At overview zoom, render compact high-contrast stop points without numbers.
- At neighborhood zoom, reveal non-overlapping sequence numbers.
- At street zoom, retain sequence numbers and allow selected-stop details.
- Selecting a stop persistently highlights it and opens a compact detail card containing its name, coordinates, and sequence position.

Stop geometry is fixed in Draw and Edit modes. Drawing a route must never add, remove, move, or reorder stops.

The map supports pointer drag, iPad touch pan, wheel/pinch zoom, and standard zoom controls.

## 2D and 3D modes

2D is the default. The 3D control animates to approximately 55 degrees of pitch with a slight bearing change and enables building extrusion from the vector style. Returning to 2D restores zero pitch and north-up bearing.

Stops, route geometry, adaptive labels, selection, and drawing remain usable in both modes. If WebGL is unavailable, show a clear unsupported-browser message rather than an indefinitely loading map.

## Route model

Stops and route geometry are independent:

```ts
interface TrashStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  sequence: number;
}

interface RouteGeometry {
  coordinates: Array<[longitude: number, latitude: number]>;
}

interface RouteDocument {
  schemaVersion: 1;
  routeId: string;
  routeName: string;
  stops: TrashStop[];
  route: RouteGeometry | null;
}
```

Mileage is calculated from the saved route geometry using great-circle segment distance. It is not calculated by connecting stop coordinates.

## Modes and interaction

### View

Display the saved route, fixed stops, adaptive labels, and statistics. Map navigation and stop selection are enabled. Route modification is disabled.

### Draw

Display all fixed stops and hide the saved route. The user presses **Start drawing**, then traces one continuous route using a finger, Pencil, mouse, or trackpad.

While drawing:

- Disable map panning for the active pointer.
- Capture geographic points at a throttled rate.
- Render the in-progress line immediately.
- Provide Clear, Undo, Cancel, and Save actions.
- Undo restores the previous complete stroke; it does not remove an arbitrary individual coordinate.

Saving replaces the currently saved route after confirmation when one already exists.

### Edit

Display the saved route faintly as a reference. The user presses **Redraw**, traces a complete replacement route, and chooses Save or Cancel. Edit does not expose hundreds of draggable vertices and does not reorder stops.

The original route remains unchanged until Save. Cancel restores it immediately. Clear removes only the in-progress replacement.

## Drawing quality

Raw pointer input must not be saved directly. The drawing pipeline:

1. Throttles captured points to avoid excessive density.
2. Removes points below a minimum screen-space distance.
3. Applies modest smoothing suitable for finger input.
4. Simplifies the result while retaining meaningful turns.
5. Preserves the original first and last coordinates.

The preview uses the processed geometry so the saved route matches what the user reviewed. Processing parameters must be conservative; smoothing must not visibly move a route onto a different street.

## Persistence and sharing

Persist the current `RouteDocument` in localStorage. Include a schema version and validate loaded/imported data before use.

Export downloads one JSON file. Import accepts the same schema, reports validation errors clearly, and never overwrites valid local data when parsing fails. Reset restores the 100-stop Lodi demonstration route.

## Distribution

Produce two distributions from the same frontend:

1. **Installable web app for iPad:** a static PWA deployed through GitHub Pages with a web app manifest, service worker, standalone display mode, theme metadata, safe-area support, and iPad-sized app icons. The installation flow is Safari → Share → Add to Home Screen. The repository README must state that iPadOS cannot run Windows `.exe` files.
2. **Windows desktop download:** a Tauri 2 package built on a `windows-latest` GitHub Actions runner and attached to a GitHub Release as a user-launchable `.exe` installer or executable artifact.

Add GitHub Actions workflows for Pages deployment, verified production builds, and tagged Windows releases. Workflows must not require paid map API keys or repository secrets beyond GitHub's standard release/page permissions.

The repository currently has no GitHub remote. Implementation may prepare and verify workflows locally, but publishing requires an engineer-selected GitHub repository and visibility setting.

## Components and boundaries

- `RouteReviewApp`: application layout and top-level mode transitions.
- `RouteMap`: owns MapLibre initialization and exposes map interaction events.
- `StopLayer`: converts stops into GeoJSON and defines adaptive point/label styling.
- `RouteLayer`: displays saved, reference, and in-progress route geometries.
- `DrawingController`: owns pointer capture, throttling, smoothing, simplification, undo, save, and cancel behavior.
- `RouteStore`: validates, persists, imports, exports, and resets the route document.
- `routeGeometry`: pure geometry processing and mileage calculations.
- `sampleRoute`: deterministic 100-stop Lodi fixture.

Map rendering must not mutate domain state directly. It emits typed actions to the drawing controller or application store.

## Error handling

- Map initialization failure: replace the map with a concise browser/WebGL support message and retain import/export access.
- Tile/style failure: show an inline map error and a Retry action.
- Invalid imported JSON: identify the invalid field and leave current data unchanged.
- Empty or too-short drawing: disable Save and explain that a route requires at least two distinct coordinates.
- Storage failure: keep the in-memory route usable and show that changes could not be saved locally.

## Accessibility and iPad behavior

- Interactive controls have at least 44-by-44 CSS-pixel targets.
- Controls have visible focus states and accessible names.
- Mode and selection are communicated with text and shape, not color alone.
- Respect safe-area insets and dynamic viewport height.
- Prevent page scrolling while allowing map gestures.
- Support Apple Pencil as ordinary pointer input without requiring Pencil-specific APIs.

## Verification

### Domain tests

- Route mileage for known coordinate fixtures.
- Point filtering, smoothing, simplification, and endpoint preservation.
- Import validation and non-destructive failure behavior.
- Reset produces exactly 100 uniquely identified, sequenced Lodi stops.

### UI integration tests

- Mode transitions expose the correct actions.
- Draw and Edit preserve stop data and sequence.
- Cancel restores the saved route.
- Save updates mileage and persistence.
- Adaptive labels change with zoom.
- 2D/3D controls update pitch and building visibility.

### Browser walkthrough

Test desktop Chromium and iPad-sized WebKit viewports:

- Load the 100-stop demo and inspect route-wide readability.
- Pan, wheel/pinch zoom, select stops, and reveal adaptive labels.
- Draw from scratch with mouse and touch-style pointer input.
- Redraw and cancel, then redraw and save.
- Toggle 2D/3D while retaining overlays.
- Export, reset, and re-import the route.
- Confirm the static production build runs from a basic HTTP server.
- Validate the web app manifest and service worker at an iPad-sized WebKit viewport.
- Validate GitHub Pages base-path asset loading.
- Validate the Tauri configuration and Windows release workflow structure; the actual `.exe` is produced by a Windows GitHub Actions runner after publication.

## Acceptance criteria

1. The production UI matches Option C rather than the earlier dark prototype.
2. The Lodi demo contains exactly 100 visible stops.
3. Stop order is readable through adaptive labels without a stop list.
4. Draw traces a new route independently of stops.
5. Edit redraws the entire saved route while preserving the original until Save.
6. Mileage reflects route geometry.
7. 2D and genuine pitched 3D map modes work on a modern iPad browser.
8. The app builds into a portable static `dist/` directory.
9. The project includes a GitHub Pages PWA deployment workflow and clear iPad installation instructions.
10. The project includes a Tauri Windows release workflow that produces a downloadable `.exe` from a version tag.
11. The embedded demo uses roughly 100 attributed public OpenStreetMap POIs around Lodi and no private residential dataset.
