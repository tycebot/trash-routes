import type { MapPresentation } from '../map/RouteMap';
import type { RouteMode } from '../domain/routeDocument';

interface TopBarProps {
  routeName: string;
  mode: RouteMode;
  presentation: MapPresentation;
  onModeChange(mode: RouteMode): void;
  onPresentationChange(presentation: MapPresentation): void;
}

export function TopBar({ routeName, mode, presentation, onModeChange, onPresentationChange }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="brand-block">
        <strong>Route Review</strong>
        <span title={routeName}>{routeName}</span>
      </div>
      <div className="top-controls">
        <div className="segmented" aria-label="Route mode">
          {(['view', 'draw', 'edit'] as const).map((value) => (
            <button key={value} type="button" aria-pressed={mode === value} onClick={() => onModeChange(value)}>
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
        <div className="segmented" aria-label="Map presentation">
          {(['2d', '3d'] as const).map((value) => (
            <button key={value} type="button" aria-pressed={presentation === value} onClick={() => onPresentationChange(value)}>
              {value.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
