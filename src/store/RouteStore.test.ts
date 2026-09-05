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

const legacyDocument = JSON.stringify({
  schemaVersion: 1,
  routeId: 'legacy-route',
  routeName: 'Legacy route',
  stops: [
    { id: 'a', name: 'A', lat: 38.13, lng: -121.28, sequence: 1 },
    { id: 'b', name: 'B', lat: 38.14, lng: -121.27, sequence: 2 },
  ],
  route: { coordinates: [[-121.28, 38.13], [-121.27, 38.14]] },
});

describe('RouteStore', () => {
  it('loads validated local data and falls back to the demo on invalid data', () => {
    expect(new RouteStore(memoryStorage('{"bad":true}'), LODI_ROUTE).getSnapshot().document)
      .toEqual(LODI_ROUTE);
  });

  it('migrates a saved v1 document and exposes route days', () => {
    const store = new RouteStore(memoryStorage(legacyDocument), LODI_ROUTE);
    expect(store.getSnapshot().document.schemaVersion).toBe(2);
    expect(store.getSnapshot().document.routes[0].days).toHaveLength(1);
    expect(store.getSnapshot().document.routes[0].days[0].stopOrder).toEqual(['a', 'b']);
  });

  it('does not overwrite valid state after invalid import', () => {
    const store = new RouteStore(memoryStorage(), LODI_ROUTE);
    const before = store.getSnapshot().document;
    const result = store.importJson('{"schemaVersion":2}');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('invalid import unexpectedly succeeded');
    expect(result.error).toContain('routes');
    expect(store.getSnapshot().document).toEqual(before);
  });

  it('replaces only the selected day order and persists it', () => {
    const storage = memoryStorage();
    const store = new RouteStore(storage, LODI_ROUTE);
    const route = LODI_ROUTE.routes[0];
    const day = route.days[0];
    const reversed = [...day.stopOrder].reverse();
    store.replaceDayOrder(route.id, day.id, reversed);
    expect(store.getSnapshot().document.routes[0].days[0].stopOrder).toEqual(reversed);
    expect(new RouteStore(storage, LODI_ROUTE).getSnapshot().document.routes[0].days[0].stopOrder)
      .toEqual(reversed);
    expect(store.getSnapshot().saveStatus).toBe('saved');
  });

  it('rejects unknown or incomplete day orders without changing state', () => {
    const store = new RouteStore(memoryStorage(), LODI_ROUTE);
    const before = store.getSnapshot().document;
    expect(() => store.replaceDayOrder('missing', 'missing', ['a', 'b'])).toThrow('routeId');
    expect(() => store.replaceDayOrder(LODI_ROUTE.routes[0].id, LODI_ROUTE.routes[0].days[0].id, ['missing']))
      .toThrow('stopOrder');
    expect(store.getSnapshot().document).toEqual(before);
  });

  it('keeps in-memory changes when storage throws', () => {
    const failing = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
    const store = new RouteStore(failing, LODI_ROUTE);
    const day = LODI_ROUTE.routes[0].days[0];
    store.replaceDayOrder(LODI_ROUTE.routes[0].id, day.id, [...day.stopOrder].reverse());
    expect(store.getSnapshot().document.routes[0].days[0].stopOrder).toEqual([...day.stopOrder].reverse());
    expect(store.getSnapshot().saveStatus).toBe('storage-error');
  });

  it('notifies subscribers and exports only a schema-v2 document', () => {
    const store = new RouteStore(memoryStorage(), LODI_ROUTE);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.reset();
    expect(listener).toHaveBeenCalledOnce();
    expect(JSON.parse(store.exportJson())).toMatchObject({ schemaVersion: 2, routes: [{ id: 'lodi-demo' }] });
    unsubscribe();
  });
});
