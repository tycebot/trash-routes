import { useEffect, useState } from 'react';
import { DaySelector } from './components/DaySelector';
import { RouteOverview } from './components/RouteOverview';
import { RouteSelector } from './components/RouteSelector';
import { StatusBar } from './components/StatusBar';
import { TopBar } from './components/TopBar';
import { LODI_ROUTE } from './data/lodiRoute';
import { StopSequenceController, type StopSequenceSnapshot } from './domain/StopSequenceController';
import type { RouteMode } from './domain/routeDocument';
import { routeMiles, stopOrderToGeometry } from './domain/routeGeometry';
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
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [mode, setMode] = useState<RouteMode>('view');
  const [presentation, setPresentation] = useState<MapPresentation>('2d');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<MapError>(null);
  const [controller] = useState(() => new StopSequenceController());
  const [drawing, setDrawing] = useState<StopSequenceSnapshot>(() => controller.snapshot());

  useEffect(() => store.subscribe(() => setSnapshot(store.getSnapshot())), [store]);

  const route = snapshot.document.routes.find((candidate) => candidate.id === selectedRouteId) ?? null;
  const day = route?.days.find((candidate) => candidate.id === selectedDayId) ?? null;

  const changeMode = (nextMode: RouteMode) => {
    setDrawing(controller.cancel());
    setSelectedStopId(null);
    setMode(nextMode);
  };
  const selectRoute = (routeId: string) => {
    setDrawing(controller.cancel());
    setSelectedRouteId(routeId);
    setSelectedDayId(null);
    setSelectedStopId(null);
    setMode('view');
  };
  const selectDay = (dayId: string) => {
    setDrawing(controller.cancel());
    setSelectedDayId(dayId);
    setSelectedStopId(null);
    setMode('view');
  };
  const returnToRoutes = () => {
    setDrawing(controller.cancel());
    setSelectedRouteId(null);
    setSelectedDayId(null);
    setSelectedStopId(null);
    setMode('view');
  };
  const returnToDays = () => {
    setDrawing(controller.cancel());
    setSelectedDayId(null);
    setSelectedStopId(null);
    setMode('view');
  };
  const startSequencing = () => {
    if (!day) return;
    setSelectedStopId(null);
    setDrawing(controller.start(mode === 'edit' ? 'edit' : 'draw', day.stops.map((stop) => stop.id)));
  };
  const sequenceStart = () => setDrawing(controller.beginPointer());
  const stopContact = (stopId: string) => setDrawing(controller.contactStop(stopId));
  const sequenceEnd = () => setDrawing(controller.endPointer());
  const saveSequence = () => {
    if (!route || !day || !drawing.canSave) return;
    if (day.stopOrder.length > 0 && !window.confirm('Replace the saved route order?')) return;
    store.replaceDayOrder(route.id, day.id, drawing.sequence);
    setDrawing(controller.cancel());
    setSelectedStopId(null);
    setMode('view');
  };
  const importFile = async (file: File) => {
    const result = store.importJson(await file.text());
    setImportError(result.ok ? null : result.error);
    if (result.ok) {
      setDrawing(controller.cancel());
      setSelectedRouteId(null);
      setSelectedDayId(null);
      setSelectedStopId(null);
      setMode('view');
    }
  };
  const exportRoute = () => {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = 'route-review.json';
    link.click();
    URL.revokeObjectURL(url);
  };
  const reset = () => {
    if (!window.confirm('Reset to the Lodi demonstration routes?')) return;
    store.reset();
    setDrawing(controller.cancel());
    setSelectedRouteId(null);
    setSelectedDayId(null);
    setSelectedStopId(null);
    setImportError(null);
    setMode('view');
  };

  if (!route) {
    return <div className="selection-shell"><RouteSelector routes={snapshot.document.routes} onSelectRoute={selectRoute} /></div>;
  }
  if (!day) {
    return <div className="selection-shell"><DaySelector route={route} onSelectDay={selectDay} onBack={returnToRoutes} /></div>;
  }

  const displayOrder = drawing.active ? drawing.sequence : day.stopOrder;
  const savedRoute = mode === 'edit' && drawing.active ? null : stopOrderToGeometry(day.stops, day.stopOrder);
  const referenceRoute = mode === 'edit' && drawing.active ? stopOrderToGeometry(day.stops, day.stopOrder) : null;
  const draftRoute = drawing.active ? stopOrderToGeometry(day.stops, drawing.sequence) : null;
  const selectedStop = day.stops.find((stop) => stop.id === selectedStopId) ?? null;
  const selectedSequence = selectedStop ? displayOrder.indexOf(selectedStop.id) + 1 || null : null;

  return (
    <div className="app-shell">
      <TopBar
        routeName={route.name}
        dayName={day.name}
        mode={mode}
        presentation={presentation}
        onModeChange={changeMode}
        onPresentationChange={setPresentation}
        onChangeSelection={returnToDays}
      />
      <main className="map-stage">
        <RouteMap
          stops={day.stops}
          displayOrder={displayOrder}
          selectedStopId={selectedStopId}
          savedRoute={savedRoute}
          referenceRoute={referenceRoute}
          draftRoute={draftRoute}
          mode={mode}
          presentation={presentation}
          drawingActive={drawing.active}
          onSelectStop={setSelectedStopId}
          onSequenceStart={sequenceStart}
          onStopContact={stopContact}
          onSequenceEnd={sequenceEnd}
          onMapError={setMapError}
        />
        <RouteOverview
          routeName={route.name}
          dayName={day.name}
          stopCount={day.stops.length}
          mode={mode}
          selectedStop={selectedStop}
          selectedSequence={selectedSequence}
          drawing={drawing}
          importError={importError}
          mapError={mapError}
          onStartSequencing={startSequencing}
          onUndo={() => setDrawing(controller.undo())}
          onClear={() => setDrawing(controller.clear())}
          onCancel={() => setDrawing(controller.cancel())}
          onSave={saveSequence}
          onImport={importFile}
          onExport={exportRoute}
          onReset={reset}
        />
      </main>
      <StatusBar stopCount={day.stops.length} miles={routeMiles(savedRoute)} saveStatus={snapshot.saveStatus} />
    </div>
  );
}

export default RouteReviewApp;
