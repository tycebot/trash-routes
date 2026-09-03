import type { SaveStatus } from '../store/RouteStore';

interface StatusBarProps {
  stopCount: number;
  miles: number;
  saveStatus: SaveStatus;
}

const statusText: Record<SaveStatus, string> = {
  saved: 'Saved locally',
  unsaved: 'Unsaved',
  'storage-error': 'Could not save locally',
};

export function StatusBar({ stopCount, miles, saveStatus }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <span>{stopCount} stops</span>
      <span>{miles.toFixed(1)} mi</span>
      <span className={saveStatus === 'storage-error' ? 'status-error' : undefined}>{statusText[saveStatus]}</span>
    </footer>
  );
}
