// Hand-drawn line icons, category artwork, the campus illustration and empty-state drawings.
// All flat: single stroke weight, no gradients or shadows.
import { raw } from './util.js';

// 24×24 line icons (stroke = currentColor)
const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  screen: '<rect x="2" y="4" width="20" height="13" rx="1"/><path d="M8 21h8M12 17v4"/>',
  print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a7 7 0 0 1 4 6.5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/>',
  repeat: '<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  home: '<path d="m3 11 9-7 9 7M5 10v10h5v-6h4v6h5V10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  inbox: '<path d="m3 13 3-8h12l3 8M3 13v6h18v-6M3 13h5l1 3h6l1-3h5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  shield: '<path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  file: '<path d="M14 3H6v18h12V7zM14 3v4h4M9 12h6M9 16h6"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  undo: '<path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  // categories
  academic: '<path d="M2 5.5c2.5-1 6-1 10 1 4-2 7.5-2 10-1v13c-2.5-1-6-1-10 1-4-2-7.5-2-10-1zM12 6.5v13"/>',
  lecture: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
  research: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7 15h10"/>',
  ceremonial: '<path d="m2 9 10-5 10 5-10 5zM6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',
  cultural: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12l3.5 2 3.5-2 3.5 2 3.5-2"/>',
  sports: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 17h6v4H9z"/>',
  admin: '<path d="M2 10 12 4l10 6zM5 10v9M9.5 10v9M14.5 10v9M19 10v9M3 21h18"/>',
};

export const CAT_ICON = {
  'Academic': 'academic', 'Public lecture': 'lecture', 'Research': 'research', 'Ceremonial': 'ceremonial',
  'Cultural': 'cultural', 'Sports': 'sports', 'Administrative': 'admin',
};
export const CAT_COLOR = {
  'Academic': '#2a78d6', 'Public lecture': '#eb6834', 'Research': '#1baf7a', 'Ceremonial': '#eda100',
  'Cultural': '#e87ba4', 'Sports': '#008300', 'Administrative': '#6250d6',
};

export function ico(name, { size, label } = {}) {
  const s = size ? ` width="${size}" height="${size}"` : '';
  const a = label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"';
  return raw(`<svg class="i" viewBox="0 0 24 24"${s} fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"${a}>${P[name] || ''}</svg>`);
}
export const catIcon = (cat, opts) => ico(CAT_ICON[cat] || 'cal', opts);

// Chevron frieze (Great Zimbabwe) as an SVG <pattern> definition
const chevrons = (id, color) => `<pattern id="${id}" width="20" height="8" patternUnits="userSpaceOnUse"><path d="M0 4H20" fill="none" stroke="${color}" stroke-width="1.6"/></pattern>`;
const bricks = (id, color) => `<pattern id="${id}" width="32" height="16" patternUnits="userSpaceOnUse"><path d="M0 .5h32M0 8.5h32M.5 0v8M16.5 0v8M8.5 8v8M24.5 8v8" fill="none" stroke="${color}" stroke-width="1"/></pattern>`;

let uid = 0;
// Fallback cover art for an event without a photo (16:9)
export function categoryArt(cat, { label } = {}) {
  const c = CAT_COLOR[cat] || '#003366';
  const k = ++uid;
  const icon = P[CAT_ICON[cat] || 'cal'];
  return raw(`<svg class="art" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label || cat + ' event'}">
    <defs>${bricks('b' + k, '#d3dbe6')}${chevrons('c' + k, c)}</defs>
    <rect width="320" height="180" fill="#e8edf4"/>
    <rect y="120" width="320" height="60" fill="url(#b${k})"/>
    <rect y="112" width="320" height="8" fill="url(#c${k})"/>
    <rect width="6" height="180" fill="${c}"/>
    <g transform="translate(190 18) scale(4)" fill="none" stroke="#003366" stroke-width=".5" stroke-linecap="round" stroke-linejoin="round">${icon}</g>
    <circle cx="58" cy="54" r="22" fill="${c}" opacity=".9"/>
  </svg>`);
}

// Campus line drawing used until approved UZ photography is supplied
export function campusArt() {
  const k = ++uid;
  return raw(`<svg class="art" viewBox="0 0 640 420" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Line drawing of a university hall">
    <defs>${bricks('cb' + k, '#e4ddcd')}${chevrons('cc' + k, '#f79422')}</defs>
    <rect width="640" height="420" fill="#efeadf"/>
    <circle cx="520" cy="92" r="38" fill="#f79422"/>
    <g fill="none" stroke="#003366" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
      <!-- tower -->
      <path d="M118 330V120h64v210M118 120l32-40 32 40"/>
      <circle cx="150" cy="160" r="16"/><path d="M150 150v10l7 5"/>
      <path d="M134 200h32v40h-32zM134 260h32v40h-32z"/>
      <!-- hall -->
      <path d="M182 330V196h330v134"/>
      <path d="M170 196l177-70 177 70z"/>
      <path d="M300 172a47 18 0 0 1 94 0"/>
      <path d="M214 214v116M256 214v116M298 214v116M396 214v116M438 214v116M480 214v116"/>
      <path d="M320 330v-74a27 27 0 0 1 54 0v74"/>
      <path d="M190 214h314"/>
      <!-- steps -->
      <path d="M150 330h400M140 342h420M130 354h440"/>
      <!-- trees -->
      <path d="M70 354v-60"/><circle cx="70" cy="270" r="30"/>
      <path d="M590 354v-48"/><circle cx="590" cy="286" r="24"/>
    </g>
    <rect y="366" width="640" height="54" fill="url(#cb${k})"/>
    <rect y="358" width="640" height="8" fill="url(#cc${k})"/>
  </svg>`);
}

// Small empty-state drawing: an icon inside a circle sitting on a course of stone
export function emptyArt(name) {
  const k = ++uid;
  return raw(`<svg class="empty-art" viewBox="0 0 160 100" aria-hidden="true">
    <defs>${chevrons('ec' + k, '#f79422')}</defs>
    <circle cx="80" cy="44" r="34" fill="#e8edf4"/>
    <g transform="translate(62 26) scale(1.5)" fill="none" stroke="#003366" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${P[name] || P.cal}</g>
    <rect x="30" y="86" width="100" height="8" fill="url(#ec${k})"/>
  </svg>`);
}
