import { LODI_ROUTE } from '../data/lodiRoute';
import {
  cloneRouteDocument,
  migrateRouteDocument,
  parseRouteDocument,
  RouteDocumentError,
  type RouteDocument,
  type RouteDay,
} from '../domain/routeDocument';

const STORAGE_KEY = 'trash-routes-route-document-v2';
const LEGACY_STORAGE_KEY = 'trash-routes-route-document-v1';

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SaveStatus = 'saved' | 'unsaved' | 'storage-error';
export type ImportResult = { ok: true } | { ok: false; error: string };

export interface RouteStoreSnapshot {
  document: RouteDocument;
  saveStatus: SaveStatus;
}

const isObsoleteLodiDemo = (document: RouteDocument): boolean =>
  document.routes.length === 1 &&
  document.routes[0].id === 'lodi-demo' &&
  document.routes[0].days.length === 5 &&
  document.routes[0].days.every((day) => day.stops.length === 20);

const dayFor = (document: RouteDocument, routeId: string, dayId: string): RouteDay => {
  const route = document.routes.find((candidate) => candidate.id === routeId);
  if (!route) throw new RouteDocumentError('routeId', 'must reference a route in this document');
  const day = route.days.find((candidate) => candidate.id === dayId);
  if (!day) throw new RouteDocumentError('dayId', 'must reference a day in this route');
  return day;
};

export class RouteStore {
  private document: RouteDocument;
  private saveStatus: SaveStatus = 'saved';
  private readonly listeners = new Set<() => void>();
  private readonly storage: StorageAdapter;

  constructor(storage: StorageAdapter, fallback: RouteDocument = LODI_ROUTE) {
    this.storage = storage;
    this.document = cloneRouteDocument(fallback);
    try {
      const savedV2 = storage.getItem(STORAGE_KEY);
      const saved = savedV2 ?? storage.getItem(LEGACY_STORAGE_KEY);
      if (saved !== null) {
        const parsed: unknown = JSON.parse(saved);
        const loaded = typeof parsed === 'object' && parsed !== null && 'schemaVersion' in parsed &&
          parsed.schemaVersion === 1
          ? migrateRouteDocument(parsed)
          : parseRouteDocument(parsed);
        const obsoleteDemo = isObsoleteLodiDemo(loaded);
        this.document = obsoleteDemo ? cloneRouteDocument(fallback) : loaded;
        if (savedV2 === null || obsoleteDemo) this.persistAndNotify();
      }
    } catch {
      this.document = cloneRouteDocument(fallback);
      this.saveStatus = 'saved';
    }
  }

  getSnapshot(): RouteStoreSnapshot {
    return { document: cloneRouteDocument(this.document), saveStatus: this.saveStatus };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  replaceDayOrder(routeId: string, dayId: string, stopOrder: string[]): void {
    const next = cloneRouteDocument(this.document);
    const day = dayFor(next, routeId, dayId);
    day.stopOrder = [...stopOrder];
    this.document = parseRouteDocument(next);
    this.persistAndNotify();
  }

  importJson(json: string): ImportResult {
    let imported: RouteDocument;
    try {
      const parsed: unknown = JSON.parse(json);
      imported = typeof parsed === 'object' && parsed !== null && 'schemaVersion' in parsed &&
        parsed.schemaVersion === 1
        ? migrateRouteDocument(parsed)
        : parseRouteDocument(parsed);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'document: invalid JSON' };
    }
    this.document = imported;
    this.persistAndNotify();
    return { ok: true };
  }

  exportJson(): string {
    return JSON.stringify(this.document, null, 2);
  }

  reset(): void {
    this.document = cloneRouteDocument(LODI_ROUTE);
    this.persistAndNotify();
  }

  private persistAndNotify(): void {
    this.saveStatus = 'unsaved';
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.document));
      this.saveStatus = 'saved';
    } catch {
      this.saveStatus = 'storage-error';
    }
    this.listeners.forEach((listener) => listener());
  }
}
