import { useState, type ChangeEvent } from 'react';
import type { StopSequenceSnapshot } from '../domain/StopSequenceController';
import type { RouteMode, TrashStop } from '../domain/routeDocument';
import type { MapError } from '../map/RouteMap';

interface RouteOverviewProps {
  routeName: string;
  dayName: string;
  stopCount: number;
  miles: number;
  firstStop: TrashStop | null;
  lastStop: TrashStop | null;
  mode: RouteMode;
  selectedStop: TrashStop | null;
  selectedSequence: number | null;
  drawing: StopSequenceSnapshot;
  importError: string | null;
  mapError: MapError;
  onStartSequencing(): void;
  onUndo(): void;
  onClear(): void;
  onCancel(): void;
  onSave(): void;
  onImport(file: File): void;
  onExport(): void;
  onReset(): void;
}

export function RouteOverview(props: RouteOverviewProps) {
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const forcedExpanded = props.mode !== 'view' || props.drawing.active || props.selectedStop !== null;
  const expanded = forcedExpanded || manuallyExpanded;

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) props.onImport(file);
    event.target.value = '';
  };

  return (
    <aside className="route-overview" aria-label="Route overview">
      <button
        type="button"
        className="route-overview-toggle"
        aria-expanded={expanded}
        aria-controls="route-overview-content"
        onClick={() => setManuallyExpanded((value) => !value)}
      >
        <span><strong>Route info</strong><small>{props.stopCount} stops · {props.miles.toFixed(1)} mi</small></span>
        <span aria-hidden="true">{expanded ? '⌄' : '⌃'}</span>
      </button>
      <div id="route-overview-content" className="route-overview-content" data-expanded={expanded}>
        {props.drawing.active ? (
          <>
            <p className="eyebrow">{props.mode === 'edit' ? 'Reordering route' : 'Creating route order'}</p>
            <h2>{props.drawing.sequence.length} of {props.stopCount} stops sequenced</h2>
            <p className="muted">Tap stops or drag across them to set the order. Drag empty map space to pan.</p>
            {props.drawing.validationMessage && <p className="validation-message">{props.drawing.validationMessage}</p>}
            <div className="action-grid">
              <button type="button" onClick={props.onUndo} disabled={!props.drawing.canUndo}>Undo stop</button>
              <button type="button" onClick={props.onClear} disabled={!props.drawing.sequence.length}>Clear order</button>
              <button type="button" onClick={props.onCancel}>Cancel</button>
              <button type="button" className="primary" onClick={props.onSave} disabled={!props.drawing.canSave}>Save route</button>
            </div>
          </>
        ) : props.selectedStop ? (
          <>
            <p className="eyebrow">{props.selectedSequence ? `Stop ${props.selectedSequence} of ${props.stopCount}` : 'Unsequenced stop'}</p>
            <h2>{props.selectedStop.name}</h2>
            <p className="coordinates">{props.selectedStop.lat.toFixed(4)}, {props.selectedStop.lng.toFixed(4)}</p>
          </>
        ) : (
          <>
            <p className="eyebrow">{props.routeName}</p>
            <h2>{props.dayName}</h2>
            <p className="route-summary-title">Route at a glance</p>
            <div className="route-summary-stats" aria-label="Route summary">
              <div><strong>{props.stopCount}</strong><span>Stops</span></div>
              <div><strong>{props.miles.toFixed(1)}</strong><span>Miles</span></div>
            </div>
            {props.firstStop && props.lastStop && (
              <div className="route-endpoints">
                <div><span className="endpoint-dot start" aria-hidden="true" /><span><small>Start</small><strong>{props.firstStop.name}</strong></span></div>
                <div><span className="endpoint-dot finish" aria-hidden="true" /><span><small>Finish</small><strong>{props.lastStop.name}</strong></span></div>
              </div>
            )}
            {props.mode !== 'view' && (
              <button type="button" className="primary wide" onClick={props.onStartSequencing}>
                {props.mode === 'edit' ? 'Start new order' : 'Start sequencing'}
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
      </div>
    </aside>
  );
}
