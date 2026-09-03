import type { TrashStop, AppState, Mode } from './types';
import { sampleStops, defaultRouteOrder } from './data/sampleStops';

const STORAGE_KEY = 'trash-routes-v1';

function createDefault(): AppState {
  return {
    mode: 'view',
    stops: [...sampleStops],
    routeOrder: [...defaultRouteOrder],
    isCustom: false,
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.stops && parsed.routeOrder) return parsed;
    }
  } catch { /* ignore */ }
  return createDefault();
}

function save(state: AppState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class Store {
  private state: AppState;
  private listeners = new Set<() => void>();

  constructor() { this.state = load(); }

  get(): AppState {
    return {
      ...this.state,
      stops: [...this.state.stops],
      routeOrder: [...this.state.routeOrder],
    };
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private notify() { save(this.state); this.listeners.forEach((fn) => fn()); }

  setMode(mode: Mode) { this.state.mode = mode; this.notify(); }

  addStop(stop: TrashStop) {
    if (this.state.stops.find((s) => s.id === stop.id)) return;
    this.state.stops = [...this.state.stops, stop];
    this.state.routeOrder = [...this.state.routeOrder, stop.id];
    this.state.isCustom = true;
    this.notify();
  }

  removeStop(id: string) {
    this.state.stops = this.state.stops.filter((s) => s.id !== id);
    this.state.routeOrder = this.state.routeOrder.filter((oid) => oid !== id);
    this.state.isCustom = true;
    this.notify();
  }

  updateStopName(id: string, name: string) {
    this.state.stops = this.state.stops.map((s) => s.id === id ? { ...s, name } : s);
    this.notify();
  }

  updateStopPosition(id: string, lat: number, lng: number) {
    this.state.stops = this.state.stops.map((s) => s.id === id ? { ...s, lat, lng } : s);
    this.notify();
  }

  setRouteOrder(order: string[]) {
    this.state.routeOrder = order;
    this.state.isCustom = true;
    this.notify();
  }

  moveRouteStop(id: string, toIndex: number) {
    const order = this.state.routeOrder.filter((oid) => oid !== id);
    const idx = Math.max(0, Math.min(toIndex, order.length));
    order.splice(idx, 0, id);
    this.setRouteOrder(order);
  }

  swapRouteOrder(idA: string, idB: string) {
    const order = [...this.state.routeOrder];
    const iA = order.indexOf(idA);
    const iB = order.indexOf(idB);
    if (iA === -1 || iB === -1) return;
    order[iA] = idB; order[iB] = idA;
    this.setRouteOrder(order);
  }

  resetRoute() {
    this.state = createDefault();
    this.notify();
  }

  getDistanceMiles(): number {
    if (this.state.routeOrder.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < this.state.routeOrder.length - 1; i++) {
      const a = this.state.stops.find((s) => s.id === this.state.routeOrder[i]);
      const b = this.state.stops.find((s) => s.id === this.state.routeOrder[i + 1]);
      if (a && b) total += haversineMiles(a.lat, a.lng, b.lat, b.lng);
    }
    return Math.round(total * 100) / 100;
  }

  getStopCount(): number { return this.state.routeOrder.length; }

  exportData(): string { return JSON.stringify(this.state, null, 2); }

  importData(json: string): boolean {
    try {
      const p = JSON.parse(json) as AppState;
      if (p.stops && p.routeOrder) { this.state = p; this.notify(); return true; }
    } catch { /* ignore */ }
    return false;
  }
}

export const store = new Store();
