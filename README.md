# Route Review

Route Review is an iPad-first PWA for presenting fixed trash-collection stops one route day at a time. Select a route, select its day, then review or sequence stops on a map. It runs entirely in the browser, persists data locally, and requires no application backend or paid map key.

## Local development

```bash
npm ci
npm run dev
```

Quality and production commands:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

The production build is the portable `dist/` directory. Serve it from any ordinary HTTP server:

```bash
python3 -m http.server -d dist
```

Then open <http://localhost:8000>.

## Route workflow and modes

1. Select a route/area.
2. Select one route day within it.
3. Work with only that day’s stops and line.

- **View** displays the saved stop order and highlighted straight-segment line. Select a stop to see its name, sequence, and coordinates.
- **Draw** starts an empty order. Tap stops or drag across them with a finger, Apple Pencil, mouse, or trackpad; each new stop is added once and the line snaps between stops.
- **Edit** keeps the saved line faintly visible while you redraw the order using the same stop gesture. It preserves stop membership; Save replaces the order and Cancel restores it.

A complete sequence must include every fixed stop before Save is enabled. Draw and Edit offer Undo, Clear, Cancel, and Save. Route mileage is calculated from the saved straight-segment stop order.

## Local data, import, and export

The schema-v2 `RouteDocument` contains routes, route days, fixed stops, and ordered stop IDs. It is validated before loading or importing and is stored in browser `localStorage`; existing schema-v1 local data is migrated on first load. Actions → Export downloads the document as JSON. Actions → Import accepts the validated schema. An invalid import identifies the failing field and leaves the current valid document untouched. Reset restores the checked-in Lodi demonstration.

## Lodi demonstration data

The demo contains one Lodi route with five route days. Every day uses 100 named public points of interest near central Lodi, California, with a distinct compact demonstration order. Private homes were excluded.

- Source: OpenStreetMap contributors
- Copyright and license: <https://www.openstreetmap.org/copyright>
- Retrieval date: **2026-09-03**
- Reproducible query: [`data/lodi-overpass-query.txt`](data/lodi-overpass-query.txt)
- Checked-in source snapshot: [`data/lodi-osm-source.json`](data/lodi-osm-source.json)
- Deterministic transform: [`scripts/build-lodi-fixture.mjs`](scripts/build-lodi-fixture.mjs)

The default 2D map uses Leaflet with detailed OpenStreetMap raster tiles. The optional 3D view uses MapLibre, USGS aerial imagery, and OpenFreeMap/OpenStreetMap labels. Raised buildings are hidden to keep routes unobstructed. If WebGL or GPU acceleration is unavailable, the app stays in 2D and explains why. No paid map API key is required.

## Install on iPad

1. Publish or serve the HTTPS production build.
2. Open Route Review in Safari.
3. Tap **Share**.
4. Tap **Add to Home Screen**.

The PWA uses standalone display metadata, a service worker, safe-area layout, and iPad-sized icons. **iPadOS cannot run Windows `.exe` files.** Use the PWA on iPad.

## GitHub Pages publication

The repository includes [`.github/workflows/pages.yml`](.github/workflows/pages.yml), which builds and deploys `dist/` through GitHub Pages using relative, project-path-safe assets.

This checkout currently has no GitHub remote. An engineer must first choose the GitHub repository and its visibility, push these commits, and configure Pages to use **GitHub Actions**. Publishing is intentionally not performed by local verification.

## Windows download

The same frontend is wrapped by a thin Tauri 2 configuration. [`.github/workflows/windows-release.yml`](.github/workflows/windows-release.yml) runs on `windows-latest` for tags matching `v*` and attaches the generated NSIS `.exe` installer to a draft GitHub Release.

After publishing the repository:

1. Push a version tag such as `v0.1.0`.
2. Let the Windows Release workflow complete.
3. Review/publish the draft GitHub Release.
4. Download its NSIS `.exe` installer.

End users do not need Rust. Rust and Windows packaging tools run only on the GitHub Actions Windows runner. A Windows executable is not produced by local Linux verification.

## Verification scope

Automated tests cover schema validation and migration, deterministic 100-stop-per-day fixture invariants, compact stop-order geometry, tap/drag sequencing, mileage, persistence/import behavior, map layer contracts, responsive desktop layout, route/day selection, detailed 2D/aerial 3D transitions, no-WebGL behavior, PWA metadata, and Chromium/iPad-WebKit walkthroughs. The live OpenFreeMap smoke is opt-in:

```bash
RUN_LIVE_MAP=1 npm run test:e2e -- --grep "live OpenFreeMap"
```

Map availability still depends on network access to OpenFreeMap. Import and export remain available when WebGL or map tiles are unavailable.
