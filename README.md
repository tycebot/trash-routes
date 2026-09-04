# Route Review

Route Review is a light, map-first application for reviewing fixed trash-collection stops and tracing replacement route geometry. It runs entirely in the browser, persists data locally, and requires no application backend or paid map key.

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

## Review modes

- **View** displays the saved route and lets you select any fixed stop for its name, sequence, and coordinates.
- **Draw** hides the saved route while you trace a complete replacement with a finger, Apple Pencil, mouse, or trackpad. It never changes stops or their sequence.
- **Edit** keeps the saved route faintly visible while you redraw it. The original remains unchanged until you choose Save; Cancel restores it immediately.

Draw and Edit offer whole-stroke Undo, Clear, Cancel, and Save. Route mileage is calculated from saved route geometry, not by connecting stop coordinates.

## Local data, import, and export

The current schema-v1 `RouteDocument` is validated before it is loaded or imported and is stored in browser `localStorage`. Actions → Export downloads the document as JSON. Actions → Import accepts that same schema. An invalid import identifies the failing field and leaves the current valid document untouched. Reset restores the checked-in Lodi demonstration.

## Lodi demonstration data

The demo contains exactly 100 named public points of interest in and around Lodi, California. Private homes were excluded.

- Source: OpenStreetMap contributors
- Copyright and license: <https://www.openstreetmap.org/copyright>
- Retrieval date: **2026-09-03**
- Reproducible query: [`data/lodi-overpass-query.txt`](data/lodi-overpass-query.txt)
- Checked-in source snapshot: [`data/lodi-osm-source.json`](data/lodi-osm-source.json)
- Deterministic transform: [`scripts/build-lodi-fixture.mjs`](scripts/build-lodi-fixture.mjs)

The base map uses key-free [OpenFreeMap](https://openfreemap.org/) vector tiles and OpenStreetMap data. No paid map API key is required.

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

Automated tests cover schema validation, deterministic fixture invariants, drawing geometry processing, mileage, persistence/import behavior, map layer contracts, mode transitions, 2D/3D state, and Chromium/iPad-WebKit walkthroughs. The live OpenFreeMap smoke is opt-in:

```bash
RUN_LIVE_MAP=1 npm run test:e2e -- --grep "live OpenFreeMap"
```

Map availability still depends on network access to OpenFreeMap. Import and export remain available when WebGL or map tiles are unavailable.
