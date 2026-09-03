import { describe, expect, it, vi } from 'vitest';
import { LODI_ROUTE } from '../data/lodiRoute';
import { RouteStore } from './RouteStore';

const memoryStorage = (initial?: string) => {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
    removeItem: () => { value = null; },
  };
};

describe('RouteStore', () => {
  it('loads validated local data and falls back to the demo on invalid data', () => {
    expect(new RouteStore(memoryStorage('{"bad":true}'), LODI_ROUTE).getSnapshot().document)
      .toEqual(LODI_ROUTE);
  });

  it('does not overwrite valid state after invalid import', () => {
    const store = new RouteStore(memoryStorage(), LODI_ROUTE);
    const before = store.getSnapshot().document;
    const result = store.importJson('{"schemaVersion":2}');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('invalid import unexpectedly succeeded');
    expect(result.error).toContain('schemaVersion');
    expect(store.getSnapshot().document).toEqual(before);
  });

  it('replaces only route geometry and persists it', () => {
    const store = new RouteStore(memoryStorage(), LODI_ROUTE);
    const originalStops = store.getSnapshot().document.stops;
    store.replaceRoute({ coordinates: [[-121.28, 38.13], [-121.27, 38.14]] });
    expect(store.getSnapshot().document.stops).toEqual(originalStops);
    expect(store.getSnapshot().saveStatus).toBe('saved');
  });

  it('keeps in-memory changes when storage throws', () => {
    const failing = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
    const store = new RouteStore(failing, LODI_ROUTE);
    store.replaceRoute({ coordinates: [[-121.28, 38.13], [-121.27, 38.14]] });
    expect(store.getSnapshot().document.route).not.toBeNull();
    expect(store.getSnapshot().saveStatus).toBe('storage-error');
  });

  it('notifies subscribers and exports only a schema document', () => {
    const store = new RouteStore(memoryStorage(), LODI_ROUTE);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.reset();
    expect(listener).toHaveBeenCalledOnce();
    expect(JSON.parse(store.exportJson())).toMatchObject({ schemaVersion: 1, routeId: 'lodi-demo' });
    unsubscribe();
  });
});
