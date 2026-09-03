import { expect, it } from 'vitest';
import { routeLayerDefinitions } from './RouteLayer';

it.each(['saved', 'reference', 'draft'] as const)('creates white casing and colored line for %s', (kind) => {
  const layers = routeLayerDefinitions(kind);
  expect(layers.map((layer) => layer.id)).toEqual([`${kind}-route-casing`, `${kind}-route-line`]);
});
