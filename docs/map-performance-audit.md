# Map performance and aerial detail audit

## Scope
Preserve the current UI, Leaflet Retina 2D, extra zoom levels, bottom sheet, and aerial view without raised buildings. No stack changes or dependencies. Stack deviations: none.

## Confirmed inefficiency repaired
`src/App.tsx` recreated saved geometry, draft geometry, and mileage on unrelated state updates. Leaflet's layer-update effect depends on those geometry identities and clears/recreates all route and stop layers. Memoize geometry and mileage against their actual inputs. `src/App.test.tsx` reproduces the identity churn on map-status changes before the repair and verifies stable geometry afterward. Existing order-edit/save tests cover correctness.

## Pan/zoom investigation — unresolved on physical iPad
WebKit with the iPad Pro 11 profile, five mouse drags and zoom-in/out cycles, Retina enabled, real tile network. RAF timing on this Linux host is diagnostic only, not an iPad benchmark. SVG child mutations during pure gestures: zero; tooltips: 100.

Three trials each, p95 frame interval in milliseconds:

| Variant | Trials |
| --- | --- |
| Existing renderer | 58, 64, 84 |
| Tile fade disabled | 55, 69, 62 |
| Canvas markers | 79, 69, 65 |
| Delay tile updates during zoom | 71, 77, 72 |

No consistent demonstrated improvement; none of these options was shipped. Network/cache and headless scheduling vary. Do not claim the reported physical-iPad stutter is resolved. Next useful evidence: device Safari performance recording of touch pan/pinch, including frame, image decode, and memory activity.

## Additional code audit findings (not repaired in this scope)
- `RouteMap.tsx` imports MapLibre and its worker eagerly even for 2D. A lazy engine boundary could reduce initial JS parsing/load cost; not demonstrated to cause steady-state panning stutter.
- `LeafletRouteMap.tsx` still rebuilds every stop for a real selection/order change. Stable marker instances and separate route/stop updates are candidates for measured editing optimization.
- Each pointer contact projects and sorts all stops; a nearest-distance scan could avoid allocations. This path does not execute during ordinary View panning.
- Endpoints bind a sequence tooltip and then an endpoint tooltip, replacing the first. Consider separate labels only if both are wanted.
- Existing tests use mocked aerial tiles and test canvas visibility, not full 3D rendering readiness. Keep a real-network walkthrough; these tests alone do not establish aerial image quality.

The approved explorer returned no report because its provider usage limit was reached. Findings above are from the parent inspection and measurements, not an independent completed review.

## Higher-detail aerial imagery
At close zoom, add USDA NAIP beneath labels/routes and above the existing USGS cached overview. The original overview remains underneath while images load. 512px image requests reduce request count compared with 256px for equivalent ground coverage; native source cap 17 is equivalent resolution to 256px at 18. The source is for CONUS; no buildings are re-enabled.

Sources inspected:
- California state catalog, 2024 California 60cm NAIP and illustrative-use constraints: https://www.arcgis.com/sharing/rest/content/items/061537e1c20744cb95506c12a028bff4?f=pjson
- USDA service metadata: https://apps.geo.fpac.usda.gov/geo-imagery/rest/services/naip/conus_naip/ImageServer?f=pjson

The catalog requests USDA FPAC-BC GEO credit, included in map attribution. Not for surveying/engineering. Source contains current imagery and dates vary outside California. Direct Lodi export returned JPEG successfully; CORS allowed the GitHub Pages origin. Dynamic image export can be slower than cached overview tiles. No offline imagery downloading or bulk prefetching added.
