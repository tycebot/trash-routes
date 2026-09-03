import { useEffect, useState } from 'react';
import { RouteOverview } from './components/RouteOverview';
import { StatusBar } from './components/StatusBar';
import { TopBar } from './components/TopBar';
import { LODI_ROUTE } from './data/lodiRoute';
import { DrawingController, type DrawingSnapshot } from './domain/DrawingController';
import type { RouteMode } from './domain/routeDocument';
import { routeMiles, type ScreenGeoPoint } from './domain/routeGeometry';
import { RouteMap, type MapError, type MapPresentation } from './map/RouteMap';
import { RouteStore, type StorageAdapter } from './store/RouteStore';

const browserStorage: StorageAdapter = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};
const browserRouteStore = new RouteStore(browserStorage, LODI_ROUTE);

export interface RouteReviewAppProps {
  store?: RouteStore;
}

export function RouteReviewApp({ store = browserRouteStore }: RouteReviewAppProps) {
  const [snapshot, setSnapshot] = useState(() => store.getSnapshot());
  const [mode, setMode] = useState<RouteMode>('view');
  const [presentation, setPresentation] = useState<MapPresentation>('2d');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<MapError>(null);
  const [controller] = useState(() => new DrawingController());
  const [drawing, setDrawing] = useState<DrawingSnapshot>(() => controller.snapshot());

  useEffect(() => store.subscribe(() => setSnapshot(store.getSnapshot())), [store]);

  const updateDrawing = (next: DrawingSnapshot) => setDrawing(next);
  const changeMode = (nextMode: RouteMode) => {
    updateDrawing(controller.cancel());
    setSelectedStopId(null);
    setMode(nextMode);
  };
  const startDrawing = () => {
    setSelectedStopId(null);
    updateDrawing(controller.start());
  };
  const strokeStart = (point: ScreenGeoPoint) => updateDrawing(controller.beginStroke(point));
  const strokePoint = (point: ScreenGeoPoint) => updateDrawing(controller.appendPoint(point));
  const strokeEnd = (point: ScreenGeoPoint) => updateDrawing(controller.endStroke(point));
  const saveDrawing = () => {
    if (!drawing.geometry) return;
    if (snapshot.document.route && !window.confirm('Replace the saved route?')) return;
    store.replaceRoute(drawing.geometry);
    updateDrawing(controller.cancel());
    setMode('view');
  };
  const importFile = async (file: File) => {
    const result = store.importJson(await file.text());
    setImportError(result.ok ? null : result.error);
    if (result.ok) {
      updateDrawing(controller.cancel());
      setSelectedStopId(null);
      setMode('view');
    }
  };
  const exportRoute = () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `route-review-${snapshot.document.routeId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const reset = () => {
    if (!window.confirm('Reset to the Lodi demonstration route?')) return;
    store.reset();
    updateDrawing(controller.cancel());
    setSelectedStopId(null);
    setImportError(null);
    setMode('view');
  };

  const { document, saveStatus } = snapshot;
  const selectedStop = document.stops.find((stop) => stop.id === selectedStopId) ?? null;
  const savedRoute = mode === 'draw' ? null : document.route;
  const referenceRoute = mode === 'edit' && drawing.active ? document.route : null;
  const draftRoute = drawing.active ? drawing.geometry : null;

  return (
    <div className="app-shell">
      <TopBar
        routeName={document.routeName}
        mode={mode}
        presentation={presentation}
        onModeChange={changeMode}
        onPresentationChange={setPresentation}
      />
      <main className="map-stage">
        <RouteMap
          stops={document.stops}
          selectedStopId={selectedStopId}
          savedRoute={savedRoute}
          referenceRoute={referenceRoute}
          draftRoute={draftRoute}
          mode={mode}
          presentation={presentation}
          drawingActive={drawing.active}
          onSelectStop={setSelectedStopId}
          onStrokeStart={strokeStart}
          onStrokePoint={strokePoint}
          onStrokeEnd={strokeEnd}
          onMapError={setMapError}
        />
        <RouteOverview
          routeName={document.routeName}
          stopCount={document.stops.length}
          mode={mode}
          selectedStop={selectedStop}
          drawing={drawing}
          importError={importError}
          mapError={mapError}
          onStartDrawing={startDrawing}
          onUndo={() => updateDrawing(controller.undo())}
          onClear={() => updateDrawing(controller.clear())}
          onCancel={() => updateDrawing(controller.cancel())}
          onSave={saveDrawing}
          onImport={importFile}
          onExport={exportRoute}
          onReset={reset}
        />
      </main>
      <StatusBar stopCount={document.stops.length} miles={routeMiles(document.route)} saveStatus={saveStatus} />
    </div>
  );
}

export default RouteReviewApp;
