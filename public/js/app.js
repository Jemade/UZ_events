import { html, raw, api, D, icon, initials, toast, skeleton, empty, passwordEyes } from './util.js';
import * as pub from './views/public.js';
import * as cal from './views/calendar.js';
import * as work from './views/workspace.js';
import * as display from './views/display.js';

export const state = { me: null, meta: null };

const ROUTES = [
  ['/', pub.home],
  ['/calendar', cal.calendar],
  ['/event/:id', pub.eventDetail],
  ['/archive', pub.archive],
  ['/display/:id', display.display, { bare: true }],
  ['/staff', pub.login],
  ['/work', work.overview, { role: 'organiser' }],
  ['/work/events', work.myEvents, { role: 'organiser' }],
  ['/work/events/new', work.eventForm, { role: 'organiser' }],
  ['/work/events/:id/edit', work.eventForm, { role: 'organiser' }],
  ['/work/review', work.review, { role: 'approver' }],
  ['/work/manage', work.manage, { role: 'approver' }],
  ['/work/messages', work.messages, { role: 'organiser' }],
  ['/work/messages/new', work.messageForm, { role: 'organiser' }],
  ['/work/messages/:id/edit', work.messageForm, { role: 'organiser' }],
  ['/work/users', work.users, { role: 'admin' }],
  ['/work/venues', work.venues, { role: 'admin' }],
  ['/work/site', work.sitePhotos, { role: 'admin' }],
  ['/work/screens', work.lobbyScreens, { role: 'organiser' }],
  ['/work/audit', work.audit, { role: 'admin' }],
  ['/work/backups', work.backups, { role: 'admin' }],
].map(([pattern, view, opts = {}]) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  return { pattern, re, keys, view, ...opts };
});

const RANK = { organiser: 1, approver: 2, admin: 3 };
export const can = role => !!state.me && RANK[state.me.role] >= RANK[role];

export const go = (hash) => { location.hash = hash; };
export const today = () => state.meta.now.slice(0, 10);

function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = h.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(query)) };
}

function chrome(path) {
  const me = state.me;
  const on = p => (p === '/' ? path === '/' : path.startsWith(p)) ? 'on' : '';
  // Staff pages (sign-in and workspace) get their own header: no public menu, just who you are and the way out.
  if (path.startsWith('/work') || path === '/staff') {
    return html`<header class="masthead staffhead"><div class="wrap">
      <a class="brand" href="${me ? '#/work' : '#/staff'}" aria-label="UZ Events staff workspace">
        <img src="/assets/uz-crest.png" alt="University of Zimbabwe crest" width="53" height="54">
        <div><b>UZ Events</b><span>Staff workspace</span></div>
      </a>
      <div class="who">
        ${me ? html`
          <span class="avatar" aria-hidden="true">${initials(me.name)}</span>
          <span class="name small"><b>${me.name}</b><br><span class="role">${me.role}</span></span>
          <button class="btn ghost sm" id="logoutBtn">Sign out</button>` : ''}
      </div>
    </div></header>`;
  }
  return html`
  <header class="masthead"><div class="wrap">
    <a class="brand" href="#/" aria-label="UZ Events home">
      <img src="/assets/uz-crest.png" alt="University of Zimbabwe crest" width="53" height="54">
      <div><b>UZ Events</b><span>University of Zimbabwe</span></div>
    </a>
    <button class="btn plain menu-btn" id="menuBtn" aria-label="Menu" aria-expanded="false">${icon.menu}</button>
    <nav class="nav" id="nav" aria-label="Main">
      <a href="#/" class="${on('/')}">What’s on</a>
      <a href="#/calendar" class="${on('/calendar')}">Calendar</a>
      <a href="#/archive" class="${on('/archive')}">Archive</a>
    </nav>
    <div class="who">
      ${me ? html`<a class="btn sm" href="#/work">Go to workspace</a>` : ''}
    </div>
  </div></header>`;
}

function footer() {
  return html`<footer class="footer">
    <div class="wrap">
      <div>
        <img class="crest" src="/assets/uz-crest.png" alt="" width="64" height="66">
        <p class="motto">Integrity · Knowledge · Diligence · Innovativeness · Professionalism</p>
        <p class="small">The official source for events at the University of Zimbabwe, Mount Pleasant, Harare.</p>
      </div>
      <div><h2>Find events</h2><a href="#/">What’s on</a><a href="#/calendar">Calendar</a><a href="#/archive">Archive</a><a href="/api/calendar.ics">Calendar feed (.ics)</a></div>
      ${state.me ? html`<div><h2>Your workspace</h2><a href="#/work">Workspace</a><a href="#/work/events/new">Submit an event</a><a href="#/work/messages/new">Request a welcome message</a></div>` : html`<div><h2>University</h2><a href="https://www.uz.ac.zw/" rel="noopener">University website</a><a href="https://www.uz.ac.zw/index.php/news-events" rel="noopener">University news</a></div>`}
      <div><h2>Contact</h2><p class="small">Events Office, Registrar’s Department<br>630 Churchill Avenue, Mount Pleasant, Harare</p><a href="https://www.uz.ac.zw/" rel="noopener">www.uz.ac.zw</a></div>
    </div>
    <div class="base"><div class="wrap"><span>© ${state.meta.now.slice(0, 4)} University of Zimbabwe</span><span>Events Office · Registrar’s Department</span></div></div>
  </footer>`;
}

async function render() {
  const { path, query } = parseHash();
  let route = null, params = {};
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (m) { route = r; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); break; }
  }
  const top = document.getElementById('top');
  const foot = document.getElementById('foot');
  const el = document.getElementById('app');
  // Staff and admin areas are invisible to anyone without the right role:
  // they get the same "Page not found" as a URL that does not exist.
  if (!route || (route.role && !can(route.role))) {
    if (window.__cleanup) { window.__cleanup(); window.__cleanup = null; }
    document.body.classList.remove('bare');
    top.innerHTML = String(chrome(path)); foot.innerHTML = String(footer());
    el.innerHTML = String(html`<div class="wrap">${empty('search', 'Page not found', 'The page you were looking for doesn’t exist or has moved.', html`<a class="btn" href="#/">Back to What’s on</a>`, 1)}</div>`);
    wireChrome();
    return;
  }
  document.body.classList.toggle('bare', !!route.bare);
  top.innerHTML = route.bare ? '' : String(chrome(path));
  foot.innerHTML = route.bare || path.startsWith('/work') ? '' : String(footer());
  if (window.__cleanup) { window.__cleanup(); window.__cleanup = null; }
  el.innerHTML = skeleton(path.startsWith('/work') ? 'work' : route.bare ? 'display' : 'page');
  try {
    await route.view({ el, params, query, path, state, onCleanup: fn => { window.__cleanup = fn; } });
  } catch (err) {
    console.error(err);
    el.innerHTML = String(html`<div class="wrap empty-state"><h1>Could not load this page</h1><p>${err.message}</p></div>`);
  }
  if (!query.keepScroll) window.scrollTo(0, 0);
  passwordEyes(el);
  wireChrome();
  highlightRecent(path);
}

// Gently highlight the event you just came back from.
function highlightRecent(path) {
  const m = path.match(/^\/event\/([^/]+)$/);
  if (m) { sessionStorage.setItem('uz.lastEvent', m[1]); return; }
  const id = sessionStorage.getItem('uz.lastEvent');
  if (!id) return;
  sessionStorage.removeItem('uz.lastEvent');
  const hit = document.querySelector(`#app a[href^="#/event/${CSS.escape(id)}"]`);
  if (hit) { hit.classList.add('recent'); hit.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
}

function wireChrome() {
  const btn = document.getElementById('menuBtn');
  if (btn) btn.onclick = () => {
    const nav = document.getElementById('nav');
    nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', nav.classList.contains('open'));
  };
  const lo = document.getElementById('logoutBtn');
  if (lo) lo.onclick = async () => {
    await api('/api/logout', { method: 'POST', body: {} });
    state.me = null;
    toast('You have been signed out.');
    go('#/');
    render();
  };
}

export async function refreshMe() {
  state.me = (await api('/api/me')).user;
}

export async function refreshMeta() {
  state.meta = await api('/api/meta');
}

export { render };

(async function start() {
  await Promise.all([refreshMe(), refreshMeta()]);
  setInterval(() => refreshMeta().catch(() => { /* offline: keep the last settings */ }), 60000);
  window.addEventListener('hashchange', render);
  render();
})();
