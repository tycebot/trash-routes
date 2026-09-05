import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { RouteMapProps } from './map/RouteMap';
import type { RouteDocument } from './domain/routeDocument';
import { RouteStore } from './store/RouteStore';

const mapMock = vi.hoisted(() => ({ props: null as RouteMapProps | null }));
vi.mock('./map/RouteMap', () => ({
  RouteMap: (props: RouteMapProps) => {
    mapMock.props = props;
    return <div data-testid="route-map" />;
  },
}));

import { RouteReviewApp } from './App';

const smallDocument: RouteDocument = {
  schemaVersion: 2,
  routes: [{
    id: 'demo-route',
    name: 'Demo Route',
    days: [{
      id: 'monday',
      name: 'Monday',
      stops: [
        { id: 'a', name: 'City Hall', lat: 38.13, lng: -121.27 },
        { id: 'b', name: 'Library', lat: 38.14, lng: -121.28 },
      ],
      stopOrder: ['a', 'b'],
    }],
  }],
};

const memoryStorage = () => {
  let value: string | null = null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next; },
    removeItem: () => { value = null; },
  };
};
const createStore = () => new RouteStore(memoryStorage(), smallDocument);

async function openWorkspace(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Demo Route/ }));
  await user.click(screen.getByRole('button', { name: /Monday/ }));
}

beforeEach(() => {
  mapMock.props = null;
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

it('selects a route then a day before showing its workspace', async () => {
  const user = userEvent.setup();
  render(<RouteReviewApp store={createStore()} />);
  expect(screen.getByRole('heading', { name: 'Routes' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: /Demo Route/ }));
  expect(screen.getByRole('heading', { name: 'Route days' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: /Monday/ }));
  expect(screen.getByTestId('route-map')).toBeVisible();
  expect(screen.getByText(/Demo Route · Monday/)).toBeVisible();
});

it('draws a complete order from contacted stops and saves only the selected day', async () => {
  const store = createStore();
  const user = userEvent.setup();
  render(<RouteReviewApp store={store} />);
  await openWorkspace(user);
  await user.click(screen.getByRole('button', { name: 'Draw' }));
  await user.click(screen.getByRole('button', { name: 'Start sequencing' }));
  act(() => {
    mapMock.props!.onSequenceStart();
    mapMock.props!.onStopContact('b');
    mapMock.props!.onStopContact('a');
    mapMock.props!.onSequenceEnd();
  });
  expect(screen.getByRole('button', { name: 'Save route' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Save route' }));
  expect(store.getSnapshot().document.routes[0].days[0].stopOrder).toEqual(['b', 'a']);
  expect(screen.getByRole('button', { name: 'View' })).toHaveAttribute('aria-pressed', 'true');
});

it('keeps the saved edit order until save and restores it on cancel', async () => {
  const store = createStore();
  const user = userEvent.setup();
  render(<RouteReviewApp store={store} />);
  await openWorkspace(user);
  await user.click(screen.getByRole('button', { name: 'Edit' }));
  await user.click(screen.getByRole('button', { name: 'Start new order' }));
  act(() => {
    mapMock.props!.onSequenceStart();
    mapMock.props!.onStopContact('b');
    mapMock.props!.onStopContact('a');
    mapMock.props!.onSequenceEnd();
  });
  expect(store.getSnapshot().document.routes[0].days[0].stopOrder).toEqual(['a', 'b']);
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(store.getSnapshot().document.routes[0].days[0].stopOrder).toEqual(['a', 'b']);
  expect(screen.getByRole('button', { name: 'Start new order' })).toBeVisible();
});

it('selects a stop and exposes its sequence and coordinates', async () => {
  const user = userEvent.setup();
  render(<RouteReviewApp store={createStore()} />);
  await openWorkspace(user);
  act(() => mapMock.props!.onSelectStop('a'));
  expect(screen.getByText('Stop 1 of 2')).toBeVisible();
  expect(screen.getByText('City Hall')).toBeVisible();
  expect(screen.getByText(/38\.1300, -121\.2700/)).toBeVisible();
});

it('supports route/day navigation, 2D/3D state, and non-destructive invalid imports', async () => {
  const store = createStore();
  const user = userEvent.setup();
  render(<RouteReviewApp store={store} />);
  await openWorkspace(user);
  await user.click(screen.getByRole('button', { name: '3D' }));
  expect(screen.getByRole('button', { name: '3D' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: 'Change route/day' }));
  expect(screen.getByRole('heading', { name: 'Route days' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: '‹ Routes' }));
  expect(screen.getByRole('heading', { name: 'Routes' })).toBeVisible();
  await user.click(screen.getByText('Demo Route'));
  await user.click(screen.getByText('Monday'));
  await user.click(screen.getByText('Actions'));
  const file = new File(['{"schemaVersion":2}'], 'bad.json', { type: 'application/json' });
  await user.upload(screen.getByLabelText('Import'), file);
  expect(await screen.findByRole('alert')).toHaveTextContent('routes');
  expect(store.getSnapshot().document).toEqual(smallDocument);
});
