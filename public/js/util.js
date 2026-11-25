import { ico, emptyArt, catIcon } from './art.js';
// Shared helpers: escaped templating, dates, API, dialogs, toasts.

// ---- safe HTML templating: every interpolation is escaped unless wrapped in raw() ----
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = s => new Raw(String(s));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESC[c]);
function part(v) {
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  if (v === false || v === null || v === undefined) return '';
  return esc(v);
}
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += part(v) + strings[i + 1]; });
  return raw(out);
}

// ---- dates (all strings are Harare wall-clock "YYYY-MM-DDTHH:MM") ----
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const D = {
  MONTHS, DAYS,
  parse(s) { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); },
  ymd(dt) { return dt.toISOString().slice(0, 10); },
  addDays(ymd, n) { const d = D.parse(ymd); d.setUTCDate(d.getUTCDate() + n); return D.ymd(d); },
  addMonths(ymd, n) { const d = D.parse(ymd); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); return D.ymd(d); },
  dow(ymd) { return D.parse(ymd).getUTCDay(); },
  startOfWeek(ymd) { const w = (D.dow(ymd) + 6) % 7; return D.addDays(ymd, -w); }, // Monday
  monthStart(ymd) { return ymd.slice(0, 8) + '01'; },
  daysInMonth(ymd) { const d = D.parse(ymd); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); },
  time(s) { return s.slice(11, 16); },
  long(s) { const d = D.parse(s); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; },
  medium(s) { const d = D.parse(s); return `${DAYS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`; },
  short(s) { const d = D.parse(s); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`; },
  monthYear(s) { const d = D.parse(s); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; },
  stamp(s) { return s ? `${D.short(s)} ${D.parse(s).getUTCFullYear()}, ${D.time(s)}` : '—'; },
  range(start, end) {
    if (start.slice(0, 10) === end.slice(0, 10)) return `${D.long(start)} · ${D.time(start)}–${D.time(end)}`;
    return `${D.medium(start)} ${D.time(start)} – ${D.medium(end)} ${D.time(end)}`;
  },
  minutes(s) { return Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16)); },
  relDays(ymd, today) { return Math.round((D.parse(ymd) - D.parse(today)) / 864e5); },
};

// ---- API ----
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), 'X-UZ-Request': '1' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---- UI bits ----
export function toast(msg, isErr = false) {
  const opts = typeof isErr === 'object' ? isErr : { error: isErr };
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast' + (opts.error ? ' err' : '');
  t.setAttribute('role', opts.error ? 'alert' : 'status');
  const span = document.createElement('span');
  span.textContent = msg;
  t.appendChild(span);
  if (opts.undo) {
    const b = document.createElement('button');
    b.className = 'toast-undo';
    b.innerHTML = String(ico('undo')) + '<span>Undo</span>';
    b.onclick = async () => { b.disabled = true; try { await opts.undo(); t.remove(); } catch (e) { span.textContent = e.message; } };
    t.appendChild(b);
  }
  document.body.appendChild(t);
  setTimeout(() => t.remove(), opts.undo ? 8000 : 4200);
}

// Promise-based dialog. fields: [{name,label,type,required,value,placeholder}]
export function ask({ title, text = '', fields = [], confirm = 'Confirm', danger = false }) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.setAttribute('aria-label', title);
    dlg.innerHTML = String(html`<form method="dialog">
      <h2>${title}</h2>
      ${text ? html`<p class="muted">${text}</p>` : ''}
      ${fields.map(f => f.type === 'textarea'
        ? html`<label class="field"><span>${f.label}</span><textarea class="input" name="${f.name}" ${f.required ? raw('required') : ''} placeholder="${f.placeholder || ''}">${f.value || ''}</textarea></label>`
        : html`<label class="field"><span>${f.label}</span><input class="input" type="${f.type || 'text'}" name="${f.name}" value="${f.value || ''}" ${f.required ? raw('required') : ''}></label>`)}
      <div class="form-actions">
        <button class="btn ghost" value="cancel" formnovalidate>Cancel</button>
        <button class="btn ${danger ? 'danger' : ''}" value="ok">${confirm}</button>
      </div></form>`);
    document.body.appendChild(dlg);
    const form = dlg.querySelector('form');
    dlg.addEventListener('close', () => {
      const ok = dlg.returnValue === 'ok';
      const out = {};
      new FormData(form).forEach((v, k) => { out[k] = v; });
      dlg.remove();
      resolve(ok ? out : null);
    });
    dlg.showModal();
    const first = dlg.querySelector('input,textarea');
    if (first) first.focus();
  });
}

export const initials = name => name.split(/\s+/).filter(w => /^[A-Z]/.test(w) && !/^(Dr|Prof|Mr|Mrs|Ms)$/.test(w)).slice(0, 2).map(w => w[0]).join('') || '?';

export const STATUS_LABEL = {
  draft: 'Draft', submitted: 'Awaiting approval', returned: 'Returned', rejected: 'Rejected', published: 'Published',
  postponed: 'Postponed', cancelled: 'Cancelled', approved: 'Approved', withdrawn: 'Withdrawn', live: 'On screen', scheduled: 'Scheduled', expired: 'Expired',
};
export const pill = s => html`<span class="pill ${s}">${STATUS_LABEL[s] || s}</span>`;
export const tag = cat => html`<span class="tag" data-cat="${cat}">${catIcon(cat)}${cat}</span>`;

// Line icons live in art.js; `icon.name` keeps older call sites working.
export const icon = new Proxy({}, { get: (_, name) => ico(String(name)) });

// Friendly empty state with a small drawing and an optional next step
export const empty = (art, title, text = '', action = '', level = 2) => html`<div class="empty-state">${emptyArt(art)}${raw(`<h${level}>`)}${title}${raw(`</h${level}>`)}${text ? html`<p>${text}</p>` : ''}${action}</div>`;

// Grey placeholder shapes shown while a page loads
export function skeleton(kind = 'page') {
  const line = (w, h = 14) => `<span class="sk" style="width:${w};height:${h}px"></span>`;
  if (kind === 'work') return `<div class="skel work-skel"><div class="sk-side">${[70, 55, 60, 65, 50].map(w => line(w + '%')).join('')}</div><div class="sk-main">${line('38%', 30)}${line('22%')}<div class="sk-tiles">${'<span class="sk sk-tile"></span>'.repeat(4)}</div>${line('100%', 160)}</div></div>`;
  if (kind === 'display') return '<div class="display"></div>';
  return `<div class="skel"><div class="wrap">${line('18%', 12)}${line('46%', 40)}${line('30%')}<div class="sk-rows">${[1, 2, 3, 4].map(() => `<div class="sk-row">${line('70px', 52)}<div>${line('60%', 18)}${line('35%')}</div></div>`).join('')}</div></div></div>`;
}

// Shrink an uploaded photo in the browser (longest side 1600px, JPEG) before sending it.
// Decodes the file directly (no blob: URL, which the Content-Security-Policy blocks)
// and honours the phone camera's rotation flag.
export async function compressImage(file, max = 1600) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPEG, PNG or WebP photo.');
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('That photo could not be read.'); }
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); // transparent PNGs get a white, not black, background
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.82);
}

export function qs(obj) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const s = p.toString();
  return s ? '?' + s : '';
}
