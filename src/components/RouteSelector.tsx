import type { TrashRoute } from '../domain/routeDocument';

interface RouteSelectorProps {
  routes: TrashRoute[];
  onSelectRoute(routeId: string): void;
}

export function RouteSelector({ routes, onSelectRoute }: RouteSelectorProps) {
  return (
    <main className="selection-screen">
      <div className="selection-header">
        <p className="eyebrow">Route Review</p>
        <h1>Routes</h1>
        <p className="muted">Select an area to view its collection days.</p>
      </div>
      <div className="selection-cards">
        {routes.map((route) => (
          <button
            className="selection-card"
            key={route.id}
            type="button"
            onClick={() => onSelectRoute(route.id)}
          >
            <span>
              <strong>{route.name}</strong>
              <small>{route.days.length} route days · {route.days.reduce((count, day) => count + day.stops.length, 0)} stops</small>
            </span>
            <span className="selection-arrow" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </main>
  );
}
