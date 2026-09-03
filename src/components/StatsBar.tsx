interface StatsBarProps {
  stopCount: number;
  distanceMiles: number;
}

export function StatsBar({ stopCount, distanceMiles }: StatsBarProps) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '24px',
      padding: '8px 16px',
      background: '#0f172a',
      borderTop: '1px solid #1e293b',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          background: '#3b82f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 700,
          fontSize: '14px',
        }}>
          {stopCount}
        </span>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Stops</span>
      </div>
      <div style={{ width: '1px', height: '28px', background: '#334155' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          background: '#f59e0b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#1e293b',
          fontWeight: 700,
          fontSize: '14px',
        }}>
          {distanceMiles.toFixed(1)}
        </span>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Miles</span>
      </div>
    </div>
  );
}
