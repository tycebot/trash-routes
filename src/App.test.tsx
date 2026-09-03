import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { LODI_ROUTE } from './data/lodiRoute';
import type { RouteMapProps } from './map/RouteMap';
import { RouteStore } from './store/RouteStore';

const mapMock = vi.hoisted(() => ({ props: null as RouteMapProps | null }));
vi.mock('./map/RouteMap', () => ({
  RouteMap: (props: RouteMapProps) => {
    mapMock.props = props;
    return <div data-testid="route-map" />;
  },
}));

import { RouteReviewApp } from './App';

const memoryStorage = () => {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
    removeItem: () => { value = null; },
  };
};
const createMemoryRouteStore = () => new RouteStore(memoryStorage(), LODI_ROUTE);
const sampleA = { x: 0, y: 0, lng: -121.28, lat: 38.13, time: 0 };
const sampleB = { x: 20, y: 10, lng: -121.27, lat: 38.14, time: 20 };
const sampleC = { x: 40, y: 20, lng: -121.26, lat: 38.15, time: 40 };

function emitStroke(points = [sampleA, sampleB, sampleC]) {
  act(() => {
    mapMock.props!.onStrokeStart(points[0]);
    for (const point of points.slice(1, -1)) mapMock.props!.onStrokePoint(point);
    mapMock.props!.onStrokeEnd(points.at(-1)!);
  });
}

beforeEach(() => {
  mapMock.props = null;
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

it('draws independently of stops and saves processed geometry', async () => {
  const store = createMemoryRouteStore();
  const originalStops = store.getSnapshot().document.stops;
  const user = userEvent.setup();
  render(<RouteReviewApp store={store} />);
  await user.click(screen.getByRole('button', { name: 'Draw' }));
  expect(screen.queryByText(LODI_ROUTE.stops[0].name)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Start drawing' }));
  emitStroke();
  await user.click(screen.getByRole('button', { name: 'Save route' }));
  expect(store.getSnapshot().document.stops).toEqual(originalStops);
  expect(store.getSnapshot().document.route?.coordinates.length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText('Saved locally')).toBeVisible();
});

it('keeps the original edit route until save and restores it on cancel', async () => {
  const store = createMemoryRouteStore();
  const original = structuredClone(store.getSnapshot().document.route);
  const user = userEvent.setup();
  render(<RouteReviewApp store={store} />);
  await user.click(screen.getByRole('button', { name: 'Edit' }));
  await user.click(screen.getByRole('button', { name: 'Redraw' }));
  emitStroke([sampleA, sampleB]);
  expect(store.getSnapshot().document.route).toEqual(original);
  await user.click(screen.getByRole('button', { name: 'Cancel drawing' }));
  expect(store.getSnapshot().document.route).toEqual(original);
  expect(screen.getByRole('button', { name: 'Redraw' })).toBeVisible();
});

it('selects a stop and exposes name, sequence, and coordinates', () => {
  render(<RouteReviewApp store={createMemoryRouteStore()} />);
  act(() => mapMock.props!.onSelectStop(LODI_ROUTE.stops[0].id));
  expect(screen.getByText('Stop 1 of 100')).toBeVisible();
  expect(screen.getByText(LODI_ROUTE.stops[0].name)).toBeVisible();
  expect(screen.getByText(/38\.\d{4}, -121\.\d{4}/)).toBeVisible();
});

it('supports whole-stroke undo, clear, and 2D/3D text state', async () => {
  const user = userEvent.setup();
  render(<RouteReviewApp store={createMemoryRouteStore()} />);
  await user.click(screen.getByRole('button', { name: 'Draw' }));
  await user.click(screen.getByRole('button', { name: 'Start drawing' }));
  emitStroke();
  expect(screen.getByRole('button', { name: 'Save route' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Undo stroke' }));
  expect(screen.getByRole('button', { name: 'Save route' })).toBeDisabled();
  emitStroke();
  await user.click(screen.getByRole('button', { name: 'Clear drawing' }));
  expect(screen.getByRole('button', { name: 'Save route' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '3D' }));
  expect(screen.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true');
});

it('reports invalid imports non-destructively and keeps actions available on map failure', async () => {
  const store = createMemoryRouteStore();
  const before = store.getSnapshot().document;
  const user = userEvent.setup();
  render(<RouteReviewApp store={store} />);
  act(() => mapMock.props!.onMapError('style'));
  expect(screen.getByText(/Route files remain accessible/)).toBeVisible();
  await user.click(screen.getByText('Actions'));
  const file = new File(['{"schemaVersion":2}'], 'bad.json', { type: 'application/json' });
  await user.upload(screen.getByLabelText('Import'), file);
  expect(await screen.findByRole('alert')).toHaveTextContent('schemaVersion');
  expect(store.getSnapshot().document).toEqual(before);
  expect(screen.getByRole('button', { name: 'Export' })).toBeVisible();
});
