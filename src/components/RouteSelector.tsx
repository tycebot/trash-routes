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
        {routes.map((route) => {
          const firstDayCount = route.days[0]?.stops.length ?? 0;
          const equalDayCounts = route.days.every((day) => day.stops.length === firstDayCount);
          const stopSummary = equalDayCounts
            ? `${firstDayCount} stops per day`
            : `${route.days.reduce((count, day) => count + day.stops.length, 0)} total stops`;
          return (
            <button
              className="selection-card"
              key={route.id}
              type="button"
              onClick={() => onSelectRoute(route.id)}
            >
              <span>
                <strong>{route.name}</strong>
                <small>{route.days.length} route {route.days.length === 1 ? 'day' : 'days'} · {stopSummary}</small>
              </span>
              <span className="selection-arrow" aria-hidden="true">›</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
