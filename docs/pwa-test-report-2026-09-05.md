# Route Review PWA test report

**Date:** 2026-09-05
**Target:** GitHub Pages installable PWA

## Live Pages result

A live GitHub Pages URL could not be tested because this checkout has no Git remote or published repository. GitHub API lookup for `tycebot/trash-routes` returned 404. The likely Pages URLs also returned 404:

- `https://tycebot.github.io/trash-routes/`
- `https://tycebot.github.io/route-review/`
- `https://tycebot.github.io/`

Therefore, no claim is made that the app was installed from GitHub Pages. Publishing still requires creating/selecting the GitHub repository, pushing the commits, and enabling the existing GitHub Actions Pages workflow.

## Production-artifact test

The production build was served with Vite preview at `http://127.0.0.1:4173/` and exercised in a Playwright iPad-sized touch context (1194×834).

Passed checks:

- Route selection screen opened.
- Lodi Demo Route opened its five route days.
- Monday opened the single-day workspace with 20 stops.
- Live OpenFreeMap tiles loaded successfully.
- View, Draw, and Edit controls rendered.
- Draw correctly disabled Save until all 20 stops were sequenced.
- Route/day navigation worked.
- Install on iPad guidance displayed Safari Share → Add to Home Screen steps.
- Manifest loaded with `display: standalone`, `start_url: ./`, and `scope: ./`.
- Service worker registered in the local secure browser context.

The automated browser suite also passed for Chromium desktop and WebKit iPad: **6 tests passed**.

## Screenshots

- [Route selector](pwa-test-screenshots/route-selector.png)
- [Route-day selector](pwa-test-screenshots/route-day-selector.png)
- [Workspace with live map tiles](pwa-test-screenshots/workspace-live-map.png)
- [iPad installation guidance](pwa-test-screenshots/install-help.png)

## Remaining live test

After Pages is published, open its HTTPS URL in iPad Safari, use **Share → Add to Home Screen**, launch the Home Screen app, and verify the route/day flow and local edit persistence. Basemap tiles require an internet connection; the service worker does not provide offline map tiles.
