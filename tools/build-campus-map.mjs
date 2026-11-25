// Builds public/assets/campus-map.json from an OpenStreetMap export of the UZ campus.
// Map data © OpenStreetMap contributors, available under the Open Database Licence (ODbL).
//
// 1. Download (Overpass API, any mirror), save as campus.json:
//    [out:json];(way["building"](-17.7935,31.0440,-17.7770,31.0620);way["highway"](-17.7935,31.0440,-17.7770,31.0620);
//    way["leisure"](-17.7935,31.0440,-17.7770,31.0620);node["name"](-17.7935,31.0440,-17.7770,31.0620););out geom;
// 2. node tools/build-campus-map.mjs campus.json
//
// Output: coordinates in metres east (x) and south (y) of the map's top-left corner,
// buildings, roads and footpaths to draw, named places to pick venues from, and a walking graph for routes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const BOX = { n: -17.7778, s: -17.7915, w: 31.0455, e: 31.0605 };
const lat0 = BOX.n, lon0 = BOX.w, k = Math.cos(((BOX.n + BOX.s) / 2) * Math.PI / 180);
const X = lon => Math.round((lon - lon0) * 111320 * k * 2) / 2;
const Y = lat => Math.round((lat0 - lat) * 110574 * 2) / 2;
const inBox = p => p.lat <= BOX.n && p.lat >= BOX.s && p.lon >= BOX.w && p.lon <= BOX.e;
const W = X(BOX.e), H = Y(BOX.s);

const WALK = new Set(['footway', 'path', 'pedestrian', 'service', 'residential', 'unclassified', 'living_street', 'tertiary', 'secondary', 'secondary_link', 'track', 'cycleway', 'steps']);
const DRAW_ROAD = new Set(['trunk', 'trunk_link', 'secondary', 'secondary_link', 'tertiary', 'residential', 'unclassified', 'living_street', 'service']);
const DRAW_PATH = new Set(['footway', 'path', 'pedestrian', 'cycleway', 'steps', 'track']);
const tidy = n => n.replace(/\bAdministratio\b/, 'Administration').replace(/\bDinning\b/g, 'Dining').replace(/\bDinnig\b/g, 'Dining').replace(/\bHstle\b/, 'Hostel')
  .replace(/\bThearter\b/, 'Theatre').replace(/\bReservour\b/, 'Reservoir').replace(/\bWidlife\b/, 'Wildlife').replace(/\bEnvirnmental\b/, 'Environmental').replace(/\bPavillion\b/, 'Pavilion').replace(/\bNLT 500\b/, 'New Lecture Theatre (NLT 500)');

const buildings = [], roads = [], paths = [], pitches = [], places = [];
const nodes = new Map(); // osm node id -> [x, y]
const edges = new Map(); // node -> Map(node -> metres)
const link = (a, b) => {
  const [ax, ay] = nodes.get(a), [bx, by] = nodes.get(b);
  const d = Math.hypot(ax - bx, ay - by);
  if (!edges.has(a)) edges.set(a, new Map());
  if (!edges.has(b)) edges.set(b, new Map());
  edges.get(a).set(b, d); edges.get(b).set(a, d);
};
const centroid = g => [X(g.reduce((s, p) => s + p.lon, 0) / g.length), Y(g.reduce((s, p) => s + p.lat, 0) / g.length)];
const pts = g => g.map(p => [X(p.lon), Y(p.lat)]);

for (const e of src.elements) {
  const t = e.tags || {};
  if (e.type === 'node') {
    if (t.name && inBox(e) && (t.amenity || t.office || t.building)) places.push({ id: 'n' + e.id, name: tidy(t.name), x: X(e.lon), y: Y(e.lat) });
    continue;
  }
  const g = e.geometry;
  if (!g || !g.some(inBox)) continue;
  if (t.building) {
    const b = { id: 'w' + e.id, p: pts(g) };
    if (t.name) { b.name = tidy(t.name); const [x, y] = centroid(g); places.push({ id: b.id, name: b.name, x, y }); }
    buildings.push(b);
  } else if (t.leisure === 'pitch' || t.leisure === 'track' || t.leisure === 'swimming_pool') {
    pitches.push({ p: pts(g) });
  } else if (t.highway) {
    const line = { p: pts(g) };
    if (t.name) line.name = t.name;
    if (DRAW_ROAD.has(t.highway)) roads.push({ ...line, major: ['trunk', 'trunk_link', 'secondary', 'secondary_link'].includes(t.highway) });
    else if (DRAW_PATH.has(t.highway)) paths.push(line);
    if (WALK.has(t.highway) && e.nodes) {
      e.nodes.forEach((id, i) => nodes.set(id, [X(g[i].lon), Y(g[i].lat)]));
      for (let i = 1; i < e.nodes.length; i++) link(e.nodes[i - 1], e.nodes[i]);
    }
  }
}

// Keep only the largest connected walking network, so every route can be drawn.
const seen = new Map(); let best = null;
for (const start of edges.keys()) {
  if (seen.has(start)) continue;
  const comp = [start]; seen.set(start, true);
  for (let i = 0; i < comp.length; i++) for (const n of edges.get(comp[i]).keys()) if (!seen.has(n)) { seen.set(n, true); comp.push(n); }
  if (!best || comp.length > best.length) best = comp;
}
const keep = new Set(best);
const ids = new Map(); const gn = [];
for (const id of best) { ids.set(id, gn.length); gn.push(nodes.get(id)); }
const ge = [];
for (const id of best) for (const [n, d] of edges.get(id)) if (keep.has(n) && ids.get(id) < ids.get(n)) ge.push([ids.get(id), ids.get(n), Math.round(d * 10) / 10]);

// Where routes can start. The University Road entrance is where University Road leaves Churchill Avenue.
const nearestNode = (x, y) => { let bi = 0, bd = Infinity; gn.forEach(([nx, ny], i) => { const d = Math.hypot(nx - x, ny - y); if (d < bd) { bd = d; bi = i; } }); return bi; };
const uniRoad = src.elements.filter(e => e.tags?.name === 'University Road' && e.geometry).flatMap(e => e.geometry);
const gate = uniRoad.reduce((a, p) => (p.lat < a.lat ? p : a)); // southernmost point of University Road, at Churchill Avenue
const bus = src.elements.find(e => e.tags?.name === 'UZ bus terminal');
const starts = [
  { id: 'gate', name: 'Main entrance, Churchill Avenue', node: nearestNode(X(gate.lon), Y(gate.lat)) },
  { id: 'bus', name: 'UZ bus terminal', node: nearestNode(X(bus.lon), Y(bus.lat)) },
];
const lib = places.find(p => p.name === 'UZ Main Library');
if (lib) starts.push({ id: 'library', name: 'UZ Main Library', node: nearestNode(lib.x, lib.y) });

// Places a venue can be pinned to: university buildings only (no private doctors' rooms or unnamed placeholders).
const SKIP = /^(Dr |Health First|mapped building$)/;
for (let i = places.length - 1; i >= 0; i--) if (SKIP.test(places[i].name)) places.splice(i, 1);
places.sort((a, b) => a.name.localeCompare(b.name));
const out = {
  attribution: 'Map data © OpenStreetMap contributors (ODbL)',
  origin: { lat: lat0, lon: lon0, k, mPerDegLat: 110574, mPerDegLon: 111320 },
  size: [W, H], buildings, roads, paths, pitches, places, starts,
  graph: { nodes: gn, edges: ge },
};
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'campus-map.json');
fs.writeFileSync(file, JSON.stringify(out));
console.log(`${buildings.length} buildings, ${roads.length} roads, ${paths.length} paths, ${places.length} places, graph ${gn.length} nodes / ${ge.length} edges, ${W}x${H} m, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
console.log('starts:', starts.map(s => s.name + ' @' + gn[s.node]).join(' | '));
