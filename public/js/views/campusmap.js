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

// ---- A real, draggable, zoomable street map (OpenStreetMap tiles) ----
const TS = 256, MINZ = 14, MAXZ = 19;
const TILE = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
const world = (lat, lon, z) => {
  const n = TS * 2 ** z, r = lat * Math.PI / 180;
  return [(lon + 180) / 360 * n, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n];
};

function slippyMap(box, { overlay, bounds, label }) {
  // overlay(project) returns SVG markup; project([lat, lon]) -> [x, y] in container pixels.
  box.innerHTML = `<div class="tm-tiles"></div><svg class="tm-over" aria-hidden="true"></svg>
    <div class="tm-ctrl"><button type="button" class="btn ghost sm" data-z="1" aria-label="Zoom in">+</button><button type="button" class="btn ghost sm" data-z="-1" aria-label="Zoom out">−</button><button type="button" class="btn ghost sm" data-fit aria-label="Show the whole route">Fit</button></div>`;
  box.tabIndex = 0;
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', label + '. Drag or use the arrow keys to move, plus and minus to zoom.');
  const tiles = box.querySelector('.tm-tiles'), svg = box.querySelector('.tm-over');
  const imgs = new Map();
  let z = 16, cx = 0, cy = 0, tileFailed = false;
  const size = () => [box.clientWidth, box.clientHeight];
  const project = ([lat, lon]) => { const [W, H] = size(); const [x, y] = world(lat, lon, z); return [x - cx + W / 2, y - cy + H / 2]; };
  const draw = () => {
    const [W, H] = size();
    const left = cx - W / 2, top = cy - H / 2, n = 2 ** z, want = new Set();
    for (let tx = Math.floor(left / TS); tx <= Math.floor((left + W) / TS); tx++) {
      for (let ty = Math.max(0, Math.floor(top / TS)); ty <= Math.min(n - 1, Math.floor((top + H) / TS)); ty++) {
        const key = `${z}/${tx}/${ty}`; want.add(key);
        let img = imgs.get(key);
        if (!img) {
          img = new Image(TS, TS); img.alt = ''; img.decoding = 'async'; img.draggable = false;
          img.onerror = () => { img.style.visibility = 'hidden'; if (!tileFailed) { tileFailed = true; box.classList.add('tm-offline'); } };
          img.src = TILE(z, ((tx % n) + n) % n, ty);
          imgs.set(key, img); tiles.appendChild(img);
        }
        img.style.transform = `translate(${Math.round(tx * TS - left)}px, ${Math.round(ty * TS - top)}px)`;
      }
    }
    for (const [key, img] of imgs) if (!want.has(key)) { img.remove(); imgs.delete(key); }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = overlay(project, { offline: tileFailed });
  };
  let frame = 0;
  const redraw = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
  const zoomTo = (nz, ax, ay) => {
    nz = Math.max(MINZ, Math.min(MAXZ, nz));
    if (nz === z) return;
    const [W, H] = size(); ax ??= W / 2; ay ??= H / 2;
    const f = 2 ** (nz - z), wx = cx - W / 2 + ax, wy = cy - H / 2 + ay;
    cx = wx * f - ax + W / 2; cy = wy * f - ay + H / 2; z = nz; redraw();
  };
  const fit = () => {
    const [W, H] = size();
    for (z = MAXZ; z > MINZ; z--) {
      const a = world(bounds[0][0], bounds[0][1], z), b = world(bounds[1][0], bounds[1][1], z);
      if (Math.abs(b[0] - a[0]) < W - 70 && Math.abs(b[1] - a[1]) < H - 90) break;
    }
    const a = world(bounds[0][0], bounds[0][1], z), b = world(bounds[1][0], bounds[1][1], z);
    cx = (a[0] + b[0]) / 2; cy = (a[1] + b[1]) / 2 - 12; redraw();
  };
  // drag (mouse, pen, one finger) and pinch (two fingers)
  const pts = new Map(); let pinch = 0;
  box.addEventListener('pointerdown', ev => { if (ev.target.closest('.tm-ctrl')) return; box.setPointerCapture(ev.pointerId); pts.set(ev.pointerId, [ev.clientX, ev.clientY]); box.classList.add('tm-drag'); });
  box.addEventListener('pointermove', ev => {
    if (!pts.has(ev.pointerId)) return;
    const [px, py] = pts.get(ev.pointerId); pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pts.size === 2) {
      const [p1, p2] = [...pts.values()], d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
      if (!pinch) pinch = d;
      else if (d / pinch > 1.5 || d / pinch < 0.66) { const r = box.getBoundingClientRect(); zoomTo(z + (d > pinch ? 1 : -1), (p1[0] + p2[0]) / 2 - r.left, (p1[1] + p2[1]) / 2 - r.top); pinch = d; }
      return;
    }
    cx -= ev.clientX - px; cy -= ev.clientY - py; redraw();
  });
  const up = ev => { pts.delete(ev.pointerId); if (pts.size < 2) pinch = 0; if (!pts.size) box.classList.remove('tm-drag'); };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  let wheelAt = 0;
  box.addEventListener('wheel', ev => { ev.preventDefault(); if (Date.now() - wheelAt < 220) return; wheelAt = Date.now(); const r = box.getBoundingClientRect(); zoomTo(z + (ev.deltaY < 0 ? 1 : -1), ev.clientX - r.left, ev.clientY - r.top); }, { passive: false });
  box.addEventListener('dblclick', ev => { const r = box.getBoundingClientRect(); zoomTo(z + 1, ev.clientX - r.left, ev.clientY - r.top); });
  box.addEventListener('keydown', ev => {
    const k = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] }[ev.key];
    if (k) { ev.preventDefault(); cx += k[0]; cy += k[1]; redraw(); }
    else if (ev.key === '+' || ev.key === '=') zoomTo(z + 1);
    else if (ev.key === '-') zoomTo(z - 1);
  });
  box.querySelector('.tm-ctrl').onclick = ev => { const b = ev.target.closest('button'); if (!b) return; if (b.dataset.fit !== undefined) fit(); else zoomTo(z + Number(b.dataset.z)); };
  const ro = new ResizeObserver(() => redraw()); ro.observe(box);
  fit();
}

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
  const ll = ([x, y]) => toLatLon(m, x, y).map(Number);

  const draw = startId => {
    const start = m.starts.find(s => s.id === startId) || m.starts[0];
    const r = route(m, start.node, nearestNode(m, place.x, place.y));
    const pts = r ? [...r.pts, [place.x, place.y]] : [m.graph.nodes[start.node], [place.x, place.y]];
    const lastLeg = Math.hypot(pts[pts.length - 2][0] - place.x, pts[pts.length - 2][1] - place.y);
    const metres = Math.round(((r ? r.metres : 0) + lastLeg) / 10) * 10;
    const mins = Math.max(1, Math.round(metres / WALK_M_PER_MIN));
    const line = pts.map(ll), goal = ll([place.x, place.y]), from = ll(m.graph.nodes[start.node]);
    const lats = line.map(p => p[0]), lons = line.map(p => p[1]);
    const bounds = [[Math.max(...lats), Math.min(...lons)], [Math.min(...lats), Math.max(...lons)]];
    const outline = building ? building.p.map(ll) : null;

    el.innerHTML = String(html`
      <div class="map-head">
        <label class="small">Walking from
          <select class="input" id="mapStart">${m.starts.map(st => html`<option value="${st.id}" ${st.id === start.id ? raw('selected') : ''}>${st.name}</option>`)}</select>
        </label>
        <p class="map-sum"><b>${metres >= 1000 ? (metres / 1000).toFixed(1) + ' km' : metres + ' m'}</b> · about ${mins} minute${mins === 1 ? '' : 's'} on foot to <b>${place.name}</b></p>
      </div>
      <div class="tilemap"></div>
      <div class="map-foot">
        <span class="map-key"><i class="k-start"></i> Start <i class="k-route"></i> Walking route <i class="k-target"></i> Venue</span>
        <a class="btn sm" href="https://www.google.com/maps/dir/?api=1&origin=${from[0]},${from[1]}&destination=${goal[0]},${goal[1]}&travelmode=walking" target="_blank" rel="noopener">Open directions in Google Maps</a>
      </div>
      <p class="map-credit">Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors</p>`);
    const path = project => line.map(p => project(p).map(v => v.toFixed(1)).join(',')).join(' ');
    slippyMap(el.querySelector('.tilemap'), {
      bounds,
      label: `Map of the walking route from ${start.name} to ${place.name}, about ${metres} metres`,
      overlay: (project, { offline }) => {
        // If the street map cannot load (no internet), draw the campus from our own data underneath the route.
        const base = offline ? m.buildings.map(b => `<polygon class="m-bld" points="${b.p.map(q => project(ll(q)).join(',')).join(' ')}"/>`).join('') +
          m.roads.map(rd => `<polyline class="m-road" stroke-width="5" points="${rd.p.map(q => project(ll(q)).join(',')).join(' ')}"/>`).join('') : '';
        const [gx, gy] = project(goal), [sx, sy] = project(from);
        return base +
          (outline ? `<polygon class="tm-target" points="${outline.map(p => project(p).join(',')).join(' ')}"/>` : '') +
          `<polyline class="m-route-casing" stroke-width="9" points="${path(project)}"/><polyline class="m-route" stroke-width="5" points="${path(project)}"/>` +
          `<circle class="m-start" cx="${sx}" cy="${sy}" r="8" stroke-width="3"/>` +
          `<g transform="translate(${gx} ${gy})"><path class="m-pin" d="M0 0c-3-9-12-14-12-24a12 12 0 0 1 24 0c0 10-9 15-12 24z"/><circle cx="0" cy="-24" r="4.5" fill="#fff"/></g>` +
          `<text class="m-target-label" x="${gx}" y="${gy - 42}" font-size="14" text-anchor="middle" stroke-width="4">${esc(place.name)}</text>`;
      },
    });
    el.querySelector('#mapStart').onchange = ev => { sessionStorage.setItem('uz.mapStart', ev.target.value); draw(ev.target.value); };
  };
  draw(sessionStorage.getItem('uz.mapStart') || 'gate');
}
