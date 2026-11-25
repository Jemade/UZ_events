// Getting there: Google Maps directions to an event's venue.
// Venues are pinned to a named campus building (public/assets/campus-places.json, positions from OpenStreetMap).
// The link gives no starting point, so Google Maps starts from wherever the person is.
import { html } from '../util.js';

let places = null;
export async function loadMap() {
  if (!places) places = await (await fetch('/assets/campus-places.json')).json();
  return places;
}

// "Great Hall" and "The Great Hall" are the same place; "Senate Chamber" in "Main Administration" is not.
const bare = n => n.toLowerCase().replace(/^(the|uz)\s+/, '').trim();
const sameName = (a, b) => bare(a).includes(bare(b)) || bare(b).includes(bare(a));

export async function venueMap(el, { placeId, venueName, venueLocation }) {
  const m = await loadMap();
  const place = placeId && m.places.find(p => p.id === placeId);
  const href = place
    ? `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}&travelmode=walking`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venueName}, University of Zimbabwe, Harare`)}`;
  el.innerHTML = String(html`<div class="directions">
    <p><b>${venueName}</b>${place && !sameName(place.name, venueName) ? html` in ${place.name}` : ''}${venueLocation ? html`<br><span class="muted small">${venueLocation}, University of Zimbabwe</span>` : ''}</p>
    <a class="btn" href="${href}" target="_blank" rel="noopener">Open directions in Google Maps</a>
    <p class="small muted">${place ? 'Google Maps starts from where you are and shows the way.' : 'This venue is not pinned to a building yet, so Google Maps searches for it by name.'}</p>
  </div>`);
}
