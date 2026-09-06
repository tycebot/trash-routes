import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { RouteMapProps } from './RouteMap';

const mocks = vi.hoisted(() => ({ constructor: vi.fn() }));

vi.mock('maplibre-gl', () => ({
  Map: mocks.constructor,
  NavigationControl: class NavigationControl {},
  setWorkerUrl: vi.fn(),
}));

import { RouteMap } from './RouteMap';

function createFakeMap() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const map = {
    addControl: vi.fn(),
    addSource: vi.fn((id: string) => sources.set(id, { setData: vi.fn() })),
    addLayer: vi.fn(),
    getSource: vi.fn((id: string) => sources.get(id)),
    getLayer: vi.fn((id: string) => id === 'building-3d' ? { id } : undefined),
    setPaintProperty: vi.fn(),
    setLayoutProperty: vi.fn(),
    easeTo: vi.fn(),
    getZoom: vi.fn(() => 12),
    fitBounds: vi.fn(),
    queryRenderedFeatures: vi.fn(() => [{
      properties: { id: 'a' },
      geometry: { type: 'Point', coordinates: [-121.27, 38.13] },
    }]),
    project: vi.fn(() => ({ x: 10, y: 20 })),
    dragPan: { disable: vi.fn(), enable: vi.fn() },
    remove: vi.fn(),
    once: vi.fn((_event: string, handler: () => void) => handler()),
    on: vi.fn((event: string, layerOrHandler: unknown, maybeHandler?: (...args: unknown[]) => void) => {
      const handler = (typeof layerOrHandler === 'function' ? layerOrHandler : maybeHandler) as
        ((...args: unknown[]) => void) | undefined;
      if (handler) listeners.set(event, [...(listeners.get(event) ?? []), handler]);
    }),
    emit(event: string, payload: unknown = {}) {
      for (const listener of listeners.get(event) ?? []) listener(payload);
    },
  };
  return map;
}

const originalStops = [
  { id: 'a', name: 'City Hall', lat: 38.13, lng: -121.27 },
  { id: 'b', name: 'Library', lat: 38.14, lng: -121.28 },
];

const props: RouteMapProps = {
  stops: originalStops,
  displayOrder: ['a', 'b'],
  selectedStopId: null,
  savedRoute: { coordinates: [[-121.28, 38.13], [-121.27, 38.14]] },
  referenceRoute: null,
  draftRoute: null,
  mode: 'view',
  presentation: '2d',
  drawingActive: false,
  onSelectStop: vi.fn(),
  onSequenceStart: vi.fn(),
  onStopContact: vi.fn(),
  onSequenceEnd: vi.fn(),
  onMapError: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
});

it('changes pitch/bearing and building visibility for 3D', () => {
  const map = createFakeMap();
  mocks.constructor.mockImplementation(function FakeMapConstructor() { return map; });
  render(<RouteMap {...props} presentation="3d" />);
  act(() => map.emit('load'));
  expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({ pitch: 55, bearing: -12, zoom: 15 }));
  expect(map.setLayoutProperty).toHaveBeenCalledWith('building-3d', 'visibility', 'visible');
});

it('frames every stop when the selected route day loads', () => {
  const map = createFakeMap();
  mocks.constructor.mockImplementation(function FakeMapConstructor() { return map; });
  render(<RouteMap {...props} />);
  act(() => map.emit('load'));
  expect(map.fitBounds).toHaveBeenCalledWith(
    [[-121.28, 38.13], [-121.27, 38.14]],
    expect.objectContaining({ maxZoom: 14, duration: 0 }),
  );
});

it('contacts stops during a tap or drag without moving them', () => {
  const map = createFakeMap();
  mocks.constructor.mockImplementation(function FakeMapConstructor() { return map; });
  const onStopContact = vi.fn();
  const onSequenceStart = vi.fn();
  const onSequenceEnd = vi.fn();
  render(<RouteMap {...props} mode="draw" drawingActive onStopContact={onStopContact} onSequenceStart={onSequenceStart} onSequenceEnd={onSequenceEnd} />);
  act(() => map.emit('load'));
  const element = screen.getByTestId('route-map');
  fireEvent.pointerDown(element, { pointerId: 7, clientX: 10, clientY: 20 });
  fireEvent.pointerMove(element, { pointerId: 7, clientX: 20, clientY: 30 });
  fireEvent.pointerUp(element, { pointerId: 7, clientX: 20, clientY: 30 });
  expect(onSequenceStart).toHaveBeenCalledOnce();
  expect(onStopContact).toHaveBeenCalledWith('a');
  expect(onStopContact).toHaveBeenCalledTimes(3);
  expect(onSequenceEnd).toHaveBeenCalledOnce();
  expect(props.stops).toEqual(originalStops);
  expect(map.dragPan.disable).toHaveBeenCalled();
  expect(map.dragPan.enable).toHaveBeenCalled();
});

it('does not contact a stop when no rendered stop is within the hit radius', () => {
  const map = createFakeMap();
  map.queryRenderedFeatures.mockReturnValue([]);
  mocks.constructor.mockImplementation(function FakeMapConstructor() { return map; });
  const onStopContact = vi.fn();
  render(<RouteMap {...props} mode="draw" drawingActive onStopContact={onStopContact} />);
  act(() => map.emit('load'));
  fireEvent.pointerDown(screen.getByTestId('route-map'), { pointerId: 7, clientX: 10, clientY: 20 });
  expect(onStopContact).not.toHaveBeenCalled();
  expect(map.dragPan.disable).not.toHaveBeenCalled();
  expect(props.onSequenceStart).not.toHaveBeenCalled();
});

it('shows a clear unsupported-browser message', () => {
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
  render(<RouteMap {...props} />);
  expect(screen.getByText(/WebGL is unavailable/)).toBeVisible();
  expect(props.onMapError).toHaveBeenCalledWith('unsupported');
});
