import type { ChangeEvent } from 'react';
import type { DrawingSnapshot } from '../domain/DrawingController';
import type { RouteMode, TrashStop } from '../domain/routeDocument';
import type { MapError } from '../map/RouteMap';

interface RouteOverviewProps {
  routeName: string;
  stopCount: number;
  mode: RouteMode;
  selectedStop: TrashStop | null;
  drawing: DrawingSnapshot;
  importError: string | null;
  mapError: MapError;
  onStartDrawing(): void;
  onUndo(): void;
  onClear(): void;
  onCancel(): void;
  onSave(): void;
  onImport(file: File): void;
  onExport(): void;
  onReset(): void;
}

export function RouteOverview(props: RouteOverviewProps) {
  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) props.onImport(file);
    event.target.value = '';
  };

  return (
    <aside className="route-overview" aria-label="Route overview">
      {props.drawing.active ? (
        <>
          <p className="eyebrow">{props.mode === 'edit' ? 'Redrawing route' : 'Drawing route'}</p>
          <h2>Trace one continuous route</h2>
          <p className="muted">Stops stay fixed. Use a finger, Pencil, mouse, or trackpad.</p>
          {props.drawing.validationMessage && <p className="validation-message">{props.drawing.validationMessage}</p>}
          <div className="action-grid">
            <button type="button" onClick={props.onUndo} disabled={!props.drawing.canUndo}>Undo stroke</button>
            <button type="button" onClick={props.onClear}>Clear drawing</button>
            <button type="button" onClick={props.onCancel}>Cancel drawing</button>
            <button type="button" className="primary" onClick={props.onSave} disabled={!props.drawing.canSave}>Save route</button>
          </div>
        </>
      ) : props.selectedStop ? (
        <>
          <p className="eyebrow">Stop {props.selectedStop.sequence} of {props.stopCount}</p>
          <h2>{props.selectedStop.name}</h2>
          <p className="coordinates">{props.selectedStop.lat.toFixed(4)}, {props.selectedStop.lng.toFixed(4)}</p>
        </>
      ) : (
        <>
          <p className="eyebrow">Route overview</p>
          <h2>{props.routeName}</h2>
          <p className="muted">{props.stopCount} fixed public stops</p>
          {props.mode !== 'view' && (
            <button type="button" className="primary wide" onClick={props.onStartDrawing}>
              {props.mode === 'edit' ? 'Redraw' : 'Start drawing'}
            </button>
          )}
        </>
      )}

      {props.mapError && <p className="inline-error">Map unavailable. Route files remain accessible.</p>}
      {props.importError && <p className="inline-error" role="alert">{props.importError}</p>}

      <details className="file-actions">
        <summary>Actions</summary>
        <div className="action-grid">
          <label className="button-label">
            Import
            <input type="file" accept="application/json,.json" onChange={handleImport} />
          </label>
          <button type="button" onClick={props.onExport}>Export</button>
          <button type="button" onClick={props.onReset}>Reset demo</button>
        </div>
      </details>
    </aside>
  );
}
