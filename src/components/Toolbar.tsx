import type { Mode } from '../types';

interface ToolbarProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onReset: () => void;
  onExport: () => void;
  onImport: (json: string) => void;
  isCustom: boolean;
}

export function Toolbar({ mode, onModeChange, onReset, onExport, onImport, isCustom }: ToolbarProps) {
  const modes: { key: Mode; label: string; icon: string; desc: string }[] = [
    { key: 'view', label: 'View', icon: '👁', desc: 'See route' },
    { key: 'draw', label: 'Draw', icon: '✏️', desc: 'Add stops' },
    { key: 'edit', label: 'Edit', icon: '✂️', desc: 'Reorder' },
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 12px',
      background: '#1e293b',
      borderBottom: '1px solid #334155',
      flexWrap: 'wrap',
    }}>
      {/* Mode buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => onModeChange(m.key)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '8px 16px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: mode === m.key ? 700 : 500,
              background: mode === m.key ? '#3b82f6' : '#334155',
              color: mode === m.key ? 'white' : '#94a3b8',
              transition: 'all 0.15s',
              minWidth: '70px',
            }}
          >
            <span style={{ fontSize: '18px', marginBottom: '2px' }}>{m.icon}</span>
            <span>{m.label}</span>
            <span style={{ fontSize: '10px', opacity: 0.7 }}>{m.desc}</span>
          </button>
        ))}
      </div>

      <div style={{ width: '1px', height: '40px', background: '#334155', margin: '0 4px' }} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
        {isCustom && (
          <button
            onClick={onReset}
            style={{
              padding: '8px 14px',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              background: 'transparent',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Reset
          </button>
        )}
        <button
          onClick={onExport}
          style={{
            padding: '8px 14px',
            border: '1px solid #22c55e',
            borderRadius: '8px',
            background: 'transparent',
            color: '#22c55e',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          Export
        </button>
        <label style={{
          padding: '8px 14px',
          border: '1px solid #3b82f6',
          borderRadius: '8px',
          background: 'transparent',
          color: '#3b82f6',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          display: 'inline-block',
        }}>
          Import
          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  onImport(ev.target?.result as string);
                };
                reader.readAsText(file);
              }
              e.target.value = '';
            }}
            style={{ display: 'none' }}
          />
        </label>
      </div>
    </div>
  );
}
