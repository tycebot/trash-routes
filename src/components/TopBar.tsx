import type { MapPresentation } from '../map/RouteMap';
import type { RouteMode } from '../domain/routeDocument';
import { InstallHelp } from './InstallHelp';

interface TopBarProps {
  routeName: string;
  dayName: string;
  mode: RouteMode;
  presentation: MapPresentation;
  onModeChange(mode: RouteMode): void;
  onPresentationChange(presentation: MapPresentation): void;
  onChangeSelection(): void;
}

export function TopBar({ routeName, dayName, mode, presentation, onModeChange, onPresentationChange, onChangeSelection }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="brand-block">
        <strong>Route Review</strong>
        <span title={`${routeName} · ${dayName}`}>{routeName} · {dayName}</span>
      </div>
      <div className="top-controls">
        <button type="button" onClick={onChangeSelection}>Change route/day</button>
        <InstallHelp />
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
