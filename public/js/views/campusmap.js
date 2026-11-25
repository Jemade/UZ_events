// Campus map with walking directions to an event's venue.
// Drawn from public/assets/campus-map.json (OpenStreetMap data, built by tools/build-campus-map.mjs).
import { html, raw, esc } from '../util.js';

let mapData = null;
export async function loadMap() {
  if (!mapData) mapData = await (await fetch('/assets/campus-map.json')).json();
  return mapData;
}

const WALK_M_PER_MIN = 80; // about 4.8 km/h
const poly = p => p.map(([x, y]) => `${x},${y}`).join(' ');

// Shortest walk on the path network (Dijkstra with a small binary heap).
function route(m, from, to) {
  const n = m.graph.nodes.length;
  if (!m._adj) {
    m._adj = Array.from({ length: n }, () => []);
    for (const [a, b, d] of m.graph.edges) { m._adj[a].push([b, d]); m._adj[b].push([a, d]); }
  }
  const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
  const heap = [[0, from]]; dist[from] = 0;
  const push = item => { heap.push(item); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return top; };
  while (heap.length) {
    const [d, u] = pop();
    if (u === to) break;
    if (d > dist[u]) continue;
    for (const [v, w] of m._adj[u]) if (d + w < dist[v]) { dist[v] = d + w; prev[v] = u; push([dist[v], v]); }
  }
  if (!isFinite(dist[to])) return null;
  const pts = []; for (let u = to; u !== -1; u = prev[u]) pts.unshift(m.graph.nodes[u]);
  return { pts, metres: dist[to] };
}

function nearestNode(m, x, y) {
  let bi = 0, bd = Infinity;
  m.graph.nodes.forEach(([nx, ny], i) => { const d = (nx - x) ** 2 + (ny - y) ** 2; if (d < bd) { bd = d; bi = i; } });
  return bi;
}

const toLatLon = (m, x, y) => {
  const o = m.origin;
  return [(o.lat - y / o.mPerDegLat).toFixed(6), (o.lon + x / (o.mPerDegLon * o.k)).toFixed(6)];
};

// Renders the map into `el` for a venue. `placeId` is the venue's building on the map (or null).
export async function venueMap(el, { placeId, venueName, venueLocation }) {
  const m = await loadMap();
  const place = placeId && m.places.find(p => p.id === placeId);
  if (!place) {
    const q = encodeURIComponent(`${venueName}, University of Zimbabwe, Harare`);
    el.innerHTML = String(html`<div class="map-missing">
      <p><b>${venueName}</b> is not on the campus map yet.${venueLocation ? ` It is at ${venueLocation}.` : ''}</p>
      <a class="btn ghost sm" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">Search for it in Google Maps</a>
    </div>`);
    return;
  }
  const building = m.buildings.find(b => b.id === place.id);
  const startSel = sessionStorage.getItem('uz.mapStart') || 'gate';

  const draw = startId => {
    const start = m.starts.find(s => s.id === startId) || m.starts[0];
    const end = nearestNode(m, place.x, place.y);
    const r = route(m, start.node, end);
    const pts = r ? [...r.pts, [place.x, place.y]] : [m.graph.nodes[start.node], [place.x, place.y]];
    const lastLeg = Math.hypot(pts[pts.length - 2][0] - place.x, pts[pts.length - 2][1] - place.y);
    const metres = Math.round(((r ? r.metres : 0) + lastLeg) / 10) * 10;
    const mins = Math.max(1, Math.round(metres / WALK_M_PER_MIN));
    // Frame the route with some campus around it.
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const pad = 90;
    let x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad - 50, w = Math.max(...xs) - x0 + pad, h = Math.max(...ys) - y0 + pad; // extra room above for the venue's name
    const aspect = 16 / 10;
    if (w / h < aspect) { const nw = h * aspect; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / aspect; y0 -= (nh - h) / 2; h = nh; }
    const s = w / 800; // stroke scale so lines look the same at any zoom
    const [s0x, s0y] = m.graph.nodes[start.node];
    const [lat, lon] = toLatLon(m, place.x, place.y);
    const [slat, slon] = toLatLon(m, s0x, s0y);
    // A few landmark names, never overlapping each other or the venue's own label.
    const fs = 11 * s, taken = [[place.x - 70 * s, place.y - 64 * s, place.x + 70 * s, place.y - 34 * s]];
    const seenNames = new Set();
    const labels = m.places
      .filter(p => p.id !== place.id && p.x > x0 + 40 * s && p.x < x0 + w - 40 * s && p.y > y0 + 20 * s && p.y < y0 + h - 20 * s && /Hall$|Library|^Faculty of|Pavilion|^Main Administration|Chapel|Union Building|Lecture Theatre/.test(p.name))
      .filter(p => {
        const key = p.name.toLowerCase();
        if (seenNames.has(key)) return false;
        const half = p.name.length * fs * 0.29, box = [p.x - half, p.y - fs, p.x + half, p.y + fs * 0.4];
        if (taken.some(t => box[0] < t[2] && t[0] < box[2] && box[1] < t[3] && t[1] < box[3])) return false;
        taken.push(box); seenNames.add(key); return true;
      })
      .slice(0, 14);

    el.innerHTML = String(html`
      <div class="map-head">
        <label class="small">Walking from
          <select class="input" id="mapStart">${m.starts.map(st => html`<option value="${st.id}" ${st.id === start.id ? raw('selected') : ''}>${st.name}</option>`)}</select>
        </label>
        <p class="map-sum"><b>${metres >= 1000 ? (metres / 1000).toFixed(1) + ' km' : metres + ' m'}</b> · about ${mins} minute${mins === 1 ? '' : 's'} on foot to <b>${place.name}</b></p>
      </div>
      <svg class="campus-map" viewBox="${x0} ${y0} ${w} ${h}" role="img" aria-label="Campus map: walking route from ${start.name} to ${place.name}, about ${metres} metres">
        <rect x="${x0}" y="${y0}" width="${w}" height="${h}" class="m-ground"/>
        ${raw(m.pitches.map(p => `<polygon class="m-pitch" points="${poly(p.p)}"/>`).join(''))}
        ${raw(m.roads.map(r => `<polyline class="m-road${r.major ? ' major' : ''}" stroke-width="${(r.major ? 11 : 7) * s}" points="${poly(r.p)}"/>`).join(''))}
        ${raw(m.paths.map(r => `<polyline class="m-path" stroke-width="${2 * s}" stroke-dasharray="${5 * s} ${4 * s}" points="${poly(r.p)}"/>`).join(''))}
        ${raw(m.buildings.map(b => `<polygon class="m-bld${b.id === place.id ? ' target' : ''}" stroke-width="${1 * s}" points="${poly(b.p)}"/>`).join(''))}
        ${raw(`<polyline class="m-route-casing" stroke-width="${9 * s}" points="${poly(pts)}"/><polyline class="m-route" stroke-width="${5 * s}" points="${poly(pts)}"/>`)}
        ${raw(labels.map(p => `<text class="m-label" x="${p.x}" y="${p.y}" font-size="${fs}" text-anchor="middle">${esc(p.name)}</text>`).join(''))}
        ${raw(`<circle class="m-start" cx="${s0x}" cy="${s0y}" r="${8 * s}" stroke-width="${3 * s}"/>`)}
        ${raw(`<g transform="translate(${place.x} ${place.y}) scale(${s})"><path class="m-pin" d="M0 0c-3-9-12-14-12-24a12 12 0 0 1 24 0c0 10-9 15-12 24z"/><circle cx="0" cy="-24" r="4.5" fill="#fff"/></g>`)}
        ${raw(`<text class="m-target-label" x="${place.x}" y="${place.y - 44 * s}" font-size="${15 * s}" text-anchor="middle" stroke-width="${4 * s}">${esc(place.name)}</text>`)}
      </svg>
      <div class="map-foot">
        <span class="map-key"><i class="k-start"></i> Start <i class="k-route"></i> Walking route <i class="k-target"></i> Venue</span>
        <a class="btn sm" href="https://www.google.com/maps/dir/?api=1&origin=${slat},${slon}&destination=${lat},${lon}&travelmode=walking" target="_blank" rel="noopener">Open directions in Google Maps</a>
      </div>
      <p class="map-credit">${m.attribution}</p>`);
    el.querySelector('#mapStart').onchange = ev => { sessionStorage.setItem('uz.mapStart', ev.target.value); draw(ev.target.value); };
  };
  draw(startSel);
}
