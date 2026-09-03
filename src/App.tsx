import { useState, useEffect, useCallback } from 'react';
import { store } from './store';
import { MapView } from './components/Map';
import { Toolbar } from './components/Toolbar';
import { StopList } from './components/StopList';
import { StatsBar } from './components/StatsBar';

function generateId(): string {
  return 's' + Date.now() + Math.random().toString(36).slice(2, 6);
}

function App() {
  const [state, setState] = useState(store.get());

  useEffect(() => store.subscribe(() => setState(store.get())), []);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (state.mode !== 'draw') return;
    const name = prompt('Stop name:');
    if (!name) return;
    store.addStop({ id: generateId(), name, lat, lng });
  }, [state.mode]);

  // In edit mode: clicking on the route line adds a new stop at that point
  const handleLineClick = useCallback((lat: number, lng: number) => {
    const name = prompt('New stop name:');
    if (!name) return;
    const newStop = { id: generateId(), name, lat, lng };
    store.addStop(newStop);
    // Insert at the end of the route (will be appended)
    // For better UX, we could insert near the clicked position, but that requires
    // finding the nearest segment — for now append to end
  }, []);

  const handleRemoveStop = useCallback((id: string) => {
    store.removeStop(id);
  }, []);

  const handleReset = useCallback(() => {
    if (confirm('Reset to default route?')) store.resetRoute();
  }, []);

  const handleExport = useCallback(() => {
    const data = store.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trash-routes.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback((json: string) => {
    if (store.importData(json)) {
      alert('Route imported successfully!');
    } else {
      alert('Failed to import. Check the file format.');
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100dvh',
      width: '100vw',
      overflow: 'hidden',
      background: '#0f172a',
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '20px',
          fontWeight: 700,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '24px' }}>🗑️</span>
          Trash Route Planner
        </h1>
      </div>

      {/* Toolbar */}
      <Toolbar
        mode={state.mode}
        onModeChange={(m) => store.setMode(m)}
        onReset={handleReset}
        onExport={handleExport}
        onImport={handleImport}
        isCustom={state.isCustom}
      />

      {/* Map */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <MapView
          stops={state.stops}
          routeOrder={state.routeOrder}
          mode={state.mode}
          onMapClick={handleMapClick}
          onLineClick={handleLineClick}
          onRemoveStop={handleRemoveStop}
        />
      </div>

      {/* Stop list (visible in draw/edit modes) */}
      {(state.mode === 'draw' || state.mode === 'edit') && (
        <StopList
          stops={state.stops}
          routeOrder={state.routeOrder}
          mode={state.mode}
          onRemove={state.mode === 'draw' ? handleRemoveStop : undefined}
        />
      )}

      {/* Stats bar */}
      <StatsBar
        stopCount={store.getStopCount()}
        distanceMiles={store.getDistanceMiles()}
      />
    </div>
  );
}

export default App;
