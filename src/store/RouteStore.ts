import { LODI_ROUTE } from '../data/lodiRoute';
import {
  cloneRouteDocument,
  parseRouteDocument,
  type RouteDocument,
  type RouteGeometry,
} from '../domain/routeDocument';

const STORAGE_KEY = 'trash-routes-route-document-v1';

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

export class RouteStore {
  private document: RouteDocument;
  private saveStatus: SaveStatus = 'saved';
  private readonly listeners = new Set<() => void>();
  private readonly storage: StorageAdapter;

  constructor(storage: StorageAdapter, fallback: RouteDocument = LODI_ROUTE) {
    this.storage = storage;
    this.document = cloneRouteDocument(fallback);
    try {
      const saved = storage.getItem(STORAGE_KEY);
      if (saved !== null) this.document = parseRouteDocument(JSON.parse(saved));
    } catch {
      this.document = cloneRouteDocument(fallback);
    }
  }

  getSnapshot(): RouteStoreSnapshot {
    return { document: cloneRouteDocument(this.document), saveStatus: this.saveStatus };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  replaceRoute(route: RouteGeometry): void {
    this.document = parseRouteDocument({
      ...cloneRouteDocument(this.document),
      route: { coordinates: route.coordinates.map(([lng, lat]) => [lng, lat]) },
    });
    this.persistAndNotify();
  }

  importJson(json: string): ImportResult {
    let imported: RouteDocument;
    try {
      imported = parseRouteDocument(JSON.parse(json));
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
