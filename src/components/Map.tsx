import type { TrashStop, Mode } from '../types';

interface MapProps {
  stops: TrashStop[];
  routeOrder: string[];
  mode: Mode;
  onMapClick: (lat: number, lng: number) => void;
  onLineClick: (lat: number, lng: number) => void;
  onRemoveStop: (id: string) => void;
}

export function MapView(_props: MapProps) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-900 text-slate-300">
      Map unavailable during MapLibre migration.
    </div>
  );
}
