import type { TrashStop } from '../types';

interface StopListProps {
  stops: TrashStop[];
  routeOrder: string[];
  mode: 'view' | 'draw' | 'edit';
  onRemove?: (id: string) => void;
}

export function StopList({ stops, routeOrder, mode, onRemove }: StopListProps) {
  if (mode === 'view') return null;

  return (
    <div style={{
      maxHeight: '100px',
      overflowY: 'auto',
      padding: '8px 12px',
      background: '#0f172a',
      borderTop: '1px solid #1e293b',
    }}>
      {mode === 'draw' ? (
        // Draw mode: show placed stops with remove buttons
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {routeOrder.map((id) => {
            const stop = stops.find((s) => s.id === id);
            if (!stop) return null;
            return (
              <div
                key={id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  fontSize: '13px',
                  color: '#e2e8f0',
                }}
              >
                <span style={{ fontWeight: 700, color: '#3b82f6', minWidth: '18px' }}>
                  {routeOrder.indexOf(id) + 1}
                </span>
                <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {stop.name}
                </span>
                <button
                  onClick={() => onRemove?.(id)}
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#ef4444',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
          {routeOrder.length === 0 && (
            <span style={{ color: '#64748b', fontSize: '13px', fontStyle: 'italic' }}>
              Tap the map to add stops
            </span>
          )}
        </div>
      ) : (
        // Edit mode: show route info and instructions
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#94a3b8', fontSize: '13px' }}>
            {routeOrder.length} stop{routeOrder.length !== 1 ? 's' : ''} in route
          </span>
          <span style={{ color: '#64748b', fontSize: '12px' }}>•</span>
          <span style={{ color: '#64748b', fontSize: '12px' }}>
            Tap line to add stops · Double-click handle to remove
          </span>
        </div>
      )}
    </div>
  );
}
