import type { TrashRoute } from '../domain/routeDocument';

interface DaySelectorProps {
  route: TrashRoute;
  onSelectDay(dayId: string): void;
  onBack(): void;
}

export function DaySelector({ route, onSelectDay, onBack }: DaySelectorProps) {
  return (
    <main className="selection-screen">
      <button className="back-button" type="button" onClick={onBack}>‹ Routes</button>
      <div className="selection-header">
        <p className="eyebrow">{route.name}</p>
        <h1>Route days</h1>
        <p className="muted">Choose one day to open its route map.</p>
      </div>
      <div className="selection-cards">
        {route.days.map((day) => (
          <button className="selection-card" key={day.id} type="button" onClick={() => onSelectDay(day.id)}>
            <span>
              <strong>{day.name}</strong>
              <small>{day.stops.length} stops · {day.stopOrder.length === day.stops.length ? 'Sequence configured' : 'Needs sequencing'}</small>
            </span>
            <span className="selection-arrow" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </main>
  );
}
