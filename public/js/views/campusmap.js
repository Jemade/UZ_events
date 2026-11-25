// Directions to an event's venue: a map-pin icon that opens Google Maps.
// Venues are pinned to a named campus building (public/assets/campus-places.json, positions from OpenStreetMap).
// The link gives no starting point, so Google Maps starts from wherever the person is.
import { html, raw } from '../util.js';

let places = null;
export async function loadMap() {
  if (!places) places = await (await fetch('/assets/campus-places.json')).json();
  return places;
}

const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
const search = name => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, University of Zimbabwe, Harare`)}`;

// The icon starts as a search for the venue's name, and becomes exact directions once the building is known.
export const mapIcon = e => html`<a class="map-icon" data-place="${e.venuePlace || ''}" href="${search(e.venueName)}" target="_blank" rel="noopener"
  aria-label="Directions to ${e.venueName} in Google Maps" title="Directions in Google Maps">${raw(PIN)}</a>`;

export async function wireMapIcons(root) {
  const links = [...root.querySelectorAll('.map-icon[data-place]')].filter(a => a.dataset.place);
  if (!links.length) return;
  const m = await loadMap();
  for (const a of links) {
    const p = m.places.find(x => x.id === a.dataset.place);
    if (p) a.href = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=walking`;
  }
}
