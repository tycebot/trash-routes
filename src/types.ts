export interface TrashStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export type Mode = 'view' | 'draw' | 'edit';

export interface AppState {
  mode: Mode;
  stops: TrashStop[];
  /** Ordered list of stop IDs defining the route */
  routeOrder: string[];
  isCustom: boolean;
}
