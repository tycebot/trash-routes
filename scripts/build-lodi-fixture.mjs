import { readFile } from 'node:fs/promises';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('usage: node scripts/build-lodi-fixture.mjs <overpass.json>');

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const PUBLIC_TAGS = ['amenity', 'shop', 'office', 'tourism', 'leisure'];
const EXCLUDED_OSM_IDS = new Set([
  // Public business, but its name contains "house" and trips the fixture's residential-name guard.
  'node-14136305050', // Brickhouse Liquors
  'node-5370762797', // Lodi Boat House
]);

const keyFor = (element) => `${element.type}-${element.id}`;
const normalizeName = (name) => name.trim().replace(/\s+/g, ' ');
const coordinateOf = (element) => element.type === 'node'
  ? { lat: element.lat, lng: element.lon }
  : { lat: element.center?.lat, lng: element.center?.lon };

const candidates = [];
const seen = new Set();
for (const element of source.elements ?? []) {
  const tags = element.tags ?? {};
  const name = typeof tags.name === 'string' ? normalizeName(tags.name) : '';
  const { lat, lng } = coordinateOf(element);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  if (!PUBLIC_TAGS.some((tag) => typeof tags[tag] === 'string' && tags[tag].trim() !== '')) continue;
  if (tags.access === 'private' || tags.access === 'no' || tags.amenity === 'parking_entrance') continue;
  if (tags.place === 'residential' || tags.building === 'house' || tags.building === 'apartments') continue;
  if (EXCLUDED_OSM_IDS.has(keyFor(element))) continue;
  const duplicateKey = `${name.toLocaleLowerCase('en-US')}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
  if (seen.has(duplicateKey)) continue;
  seen.add(duplicateKey);
  candidates.push({ element, name, lat, lng });
}

const proximity = (a, b) => {
  const latitudeScale = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return ((a.lng - b.lng) * latitudeScale) ** 2 + (a.lat - b.lat) ** 2;
};
const lodiCenter = { lat: 38.1342, lng: -121.2722 };
candidates.sort((a, b) =>
  proximity(lodiCenter, a) - proximity(lodiCenter, b) ||
  keyFor(a.element).localeCompare(keyFor(b.element)),
);

const selected = candidates.slice(0, 100);
if (selected.length !== 100) {
  throw new Error(`expected 100 public POIs, found ${selected.length}`);
}

const remaining = selected.slice(1);
const ordered = [selected[0]];
while (remaining.length > 0) {
  const previous = ordered.at(-1);
  remaining.sort((a, b) => proximity(previous, a) - proximity(previous, b) || keyFor(a.element).localeCompare(keyFor(b.element)));
  ordered.push(remaining.shift());
}

const stops = ordered.map(({ element, name, lat, lng }) => ({
  id: keyFor(element),
  name,
  lat,
  lng,
}));
const rotate = (items, offset) => [...items.slice(offset), ...items.slice(0, offset)];
const dailyOrders = [
  stops,
  [...stops].reverse(),
  rotate(stops, 20),
  [...rotate(stops, 40)].reverse(),
  rotate(stops, 60),
];
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const days = dayNames.map((name, dayIndex) => ({
  id: `lodi-demo-${name.toLocaleLowerCase('en-US')}`,
  name,
  stops,
  stopOrder: dailyOrders[dayIndex].map((stop) => stop.id),
}));

const routeDocument = {
  schemaVersion: 2,
  routes: [{
    id: 'lodi-demo',
    name: 'Lodi Demo Route',
    days,
  }],
};

process.stdout.write(`${JSON.stringify(routeDocument, null, 2)}\n`);
