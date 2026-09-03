# Trash Route Planner

A web app for planning and visualizing trash collection routes. Built with React + Vite + Leaflet + Tailwind CSS.

## Quick Start

```bash
npm install
npm run dev          # Development server
npm run build        # Production build → dist/
```

## Running the production build

The `dist/` folder is a self-contained static site. Serve it from anywhere:

```bash
# Quick local test
npx serve dist

# Or any HTTP server
python -m http.server -d dist
```

## iPad Setup

Open the URL in Safari on iPad. For a native app feel:
1. Tap the Share button
2. Tap "Add to Home Screen"
3. Opens full-screen with no browser chrome

The viewport meta tags are configured for iPad touch interaction.

## Customizing Data

Replace the sample stops in `src/data/sampleStops.ts`:

```typescript
export const sampleStops: TrashStop[] = [
  { id: 's1', name: 'Your Stop Name', lat: 30.2672, lng: -97.7431 },
  // ... more stops
];
```

The `id` must be unique. `name` is displayed in the UI. `lat`/`lng` place the marker on the map.

## Features

- **View Mode** — See preconfigured stops as numbered markers with the route highlighted in amber
- **Draw Mode** — Tap the map to add new stops; stops appear in blue with route lines. Tap × to remove.
- **Edit Mode** — Drag markers to reposition stops. Right-click a marker to move it to the front of the route.
- **Export/Import** — Share routes as JSON files
- **Reset** — Restore the default route (only available after making changes)
- **Stats Bar** — Shows total stops and route distance in miles at the bottom

## Tech Stack

- React 19 + TypeScript
- Vite 8
- Leaflet + React Leaflet (OpenStreetMap tiles)
- Tailwind CSS v4
- localStorage for persistence
- No backend required
