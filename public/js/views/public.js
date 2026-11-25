import { html, raw, api, D, icon, toast, tag, qs, empty, fitForm } from '../util.js';
import { ico, categoryArt } from '../art.js';
import { state, go, today, render, refreshMe, can } from '../app.js';
import { venueMap } from './campusmap.js';

const put = (el, tpl) => { el.innerHTML = String(tpl); };
const evHref = e => `#/event/${e.id}${e.occurrence ? '?on=' + encodeURIComponent(e.start) : ''}`;

// Event photo, or the category artwork when no photo has been supplied
export const photo = (e, cls = '') => e.coverImage
  ? html`<img class="${cls}" src="${e.coverImage}" alt="${e.coverAlt || ''}" loading="lazy" decoding="async">`
  : categoryArt(e.category, { label: `${e.category} event` });

export function evRow(e, { showDate = false, thumb = false } = {}) {
  const cancelled = e.status === 'cancelled';
  return html`<a class="ev-row ${cancelled ? 'is-cancelled' : ''} ${thumb ? 'has-thumb' : ''}" data-cat="${e.category}" href="${evHref(e)}">
    ${thumb ? html`<span class="thumb">${photo(e)}</span>` : ''}
    <span class="time">${showDate ? html`${D.short(e.start)}<br>` : ''}${D.time(e.start)}–${D.time(e.end)}</span>
    <span>
      <span class="t">${e.title}</span>
      <span class="meta">${e.venueName} · ${e.departmentShort}${e.recurrence && e.recurrence.freq !== 'none' ? ` · Repeats ${e.recurrence.freq}` : ''}</span>
    </span>
    <span>${cancelled ? html`<span class="pill cancelled">Cancelled</span>` : e.status === 'postponed' ? html`<span class="pill postponed">Postponed</span>` : tag(e.category)}</span>
  </a>`;
}

export function agenda(events, todayYmd) {
  const byDay = new Map();
  events.forEach(e => { const k = e.start.slice(0, 10); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(e); });
  return html`<div class="agenda">${[...byDay].map(([day, list]) => {
    const d = D.parse(day);
    return html`<div class="agenda-day">
      <div class="agenda-date ${day === todayYmd ? 'today' : ''}">
        <div class="wd">${day === todayYmd ? 'Today' : D.relDays(day, todayYmd) === 1 ? 'Tomorrow' : D.DAYS[d.getUTCDay()]}</div>
        <div class="d">${d.getUTCDate()}</div>
        <div class="m">${D.MONTHS[d.getUTCMonth()]}</div>
      </div>
      <div>${list.map(e => evRow(e))}</div>
    </div>`;
  })}</div>`;
}

const ACTION_TEXT = { amended: 'Details updated', rescheduled: 'Rescheduled', postponed: 'Postponed', cancelled: 'Cancelled', reinstated: 'Reinstated', created: 'Created', edited: 'Edited', submitted: 'Submitted for approval', approved: 'Approved and published', returned: 'Returned for revision', rejected: 'Rejected', withdrawn: 'Withdrawn' };

export async function eventDetail({ el, params, query }) {
  const { event: e } = await api(`/api/events/${encodeURIComponent(params.id)}?view=1`);
  let start = e.start, end = e.end;
  if (query.on && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(query.on)) {
    const dur = Date.parse(e.end + ':00Z') - Date.parse(e.start + ':00Z');
    start = query.on; end = new Date(Date.parse(start + ':00Z') + dur).toISOString().slice(0, 16);
  }
  const d = D.parse(start);
  const staff = can('organiser');
  const isSaved = !!state.me && (state.me.saved || []).includes(e.id);
  const isPast = end < state.meta.now;
  const notes = e.history.filter(h => ['amended', 'rescheduled', 'postponed', 'cancelled', 'reinstated'].includes(h.action));
  const lastCancel = [...e.history].reverse().find(h => h.action === 'cancelled' || h.action === 'postponed');
  document.title = `${e.title} · UZ Events`;
  const dt = (i, label) => html`<dt>${ico(i)}${label}</dt>`;

  put(el, html`
  <div class="page-head"><div class="wrap">
    <div class="crumbs"><a href="#/calendar?date=${start.slice(0, 10)}">Calendar</a> / ${e.departmentShort}</div>
    <div class="eyebrow">${e.category} · ${e.departmentName}</div>
    <h1 style="margin-top:8px;max-width:26ch">${e.title}</h1>
  </div></div>
  <div class="wrap detail">
    <article>
      ${e.status === 'cancelled' ? html`<div class="banner cancelled"><b>This event has been cancelled.</b>${lastCancel && lastCancel.note ? html`<p>${lastCancel.note}</p>` : ''}</div>` : ''}
      ${e.status === 'postponed' ? html`<div class="banner postponed"><b>This event has been postponed. A new date will be announced.</b>${lastCancel && lastCancel.note ? html`<p>${lastCancel.note}</p>` : ''}</div>` : ''}
      ${!['published', 'postponed', 'cancelled'].includes(e.status) ? html`<div class="banner info"><b>Preview: not public.</b><p>This event is “${e.status}”. Only staff with access can see this page.</p></div>` : ''}
      ${!e.isPublic ? html`<div class="banner info"><b>Internal event</b><p>Visible to signed-in university staff only.</p></div>` : ''}
      ${isPast && e.status !== 'cancelled' ? html`<div class="banner info"><b>This event has ended.</b><p>It is kept in the <a href="#/archive">events archive</a> for the university record.</p></div>` : ''}
      <figure class="cover">${photo(e)}</figure>
      ${e.summary ? html`<p class="lede">${e.summary}</p>` : ''}
      <div class="body">${(e.description || '').split(/\n{2,}/).map(p => html`<p>${p}</p>`)}</div>
      <section class="getting-there"><h2>Getting there</h2><div class="map-box" id="map"></div></section>
      ${notes.length ? html`<hr class="rule"><h2 style="margin-bottom:16px;font-size:var(--fs-h3)">Updates</h2>
        <ul class="timeline">${notes.slice().reverse().map(h => html`<li><span class="when">${D.stamp(h.at)}</span><br><b>${ACTION_TEXT[h.action] || h.action}</b>${h.note ? html`: ${h.note}` : ''}</li>`)}</ul>` : ''}
      ${staff && e.createdByName ? html`<hr class="rule"><h2 style="margin-bottom:6px;font-size:var(--fs-h3)">Record</h2>
        <p class="small muted">Submitted by ${e.createdByName} · ${e.views || 0} public views · Last updated ${D.stamp(e.updatedAt)}</p>
        <ul class="timeline">${e.history.slice().reverse().map(h => html`<li><span class="when">${D.stamp(h.at)} · ${h.by}</span><br><b>${ACTION_TEXT[h.action] || h.action}</b>${h.note ? html`: ${h.note}` : ''}${h.changes && h.changes.length ? html` <span class="muted small">(${h.changes.join(', ')})</span>` : ''}</li>`)}</ul>` : ''}
    </article>
    <aside class="factbox" aria-label="Event details">
      <div class="datebig">
        <div class="sq"><span>${D.MONTHS[d.getUTCMonth()].slice(0, 3).toUpperCase()}</span><b>${d.getUTCDate()}</b></div>
        <div><b>${D.DAYS[d.getUTCDay()]}</b><br><span class="muted">${D.time(start)} – ${D.time(end)}${start.slice(0, 10) !== end.slice(0, 10) ? ` (${D.short(end)})` : ''}</span></div>
      </div>
      <dl>
        ${e.recurrence && e.recurrence.freq !== 'none' ? html`${dt('repeat', 'Repeats')}<dd>Every ${e.recurrence.freq === 'weekly' ? 'week' : 'month'} until ${D.long(e.recurrence.until)}</dd>` : ''}
        ${dt('pin', 'Venue')}<dd>${e.venueName}<br><span class="small muted">${e.venueLocation}</span></dd>
        ${dt('admin', 'Organiser')}<dd>${e.departmentName}</dd>
        ${dt('users', 'Audience')}<dd>${e.audience}</dd>
        ${dt('mail', 'Contact')}<dd>${e.contactName}<br><a href="mailto:${e.contactEmail}">${e.contactEmail}</a></dd>
        ${dt('info', 'Status')}<dd>${{ published: 'Confirmed', postponed: 'Postponed', cancelled: 'Cancelled' }[e.status] || e.status}</dd>
      </dl>
      <div class="actions">
        ${['published', 'postponed'].includes(e.status) ? html`<a class="btn" href="/api/events/${e.id}/ics">${icon.cal} Add to my calendar</a>` : ''}
        ${state.me && ['published', 'postponed'].includes(e.status) ? html`<button class="btn ${isSaved ? 'ghost' : 'orange'}" id="save" aria-pressed="${isSaved}">${isSaved ? 'Saved to Events' : 'Save to Events'}</button>` : ''}
        <button class="btn ghost" id="copy">${icon.link} Copy link</button>
        <button class="btn ghost" id="print">${icon.print} Print</button>
        ${e.canEdit ? html`<a class="btn orange" href="#/work/events/${e.id}/edit">Edit event</a>` : ''}
      </div>
    </aside>
  </div>`);
  el.querySelector('#copy').onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); toast('Link copied to your clipboard.'); } catch { toast('Copy failed. Use the address bar instead.', true); }
  };
  el.querySelector('#print').onclick = () => window.print();
  venueMap(el.querySelector('#map'), { placeId: e.venuePlace, venueName: e.venueName, venueLocation: e.venueLocation }).catch(() => {});
  const save = el.querySelector('#save');
  if (save) save.onclick = async () => {
    try {
      await api('/api/me/saved', { method: 'POST', body: { eventId: e.id, saved: !isSaved } });
      await refreshMe();
      toast(isSaved ? 'Removed from your saved events.' : 'Saved. Find it under Events.');
      render();
    } catch (x) { toast(x.message, true); }
  };
}

// ---------------- EVENT POP-UP (from the calendar) ----------------
// Clicking an event on the calendar opens its details here, with the walking route to the venue.
export async function eventDialog(id, on) {
  const { event: e } = await api(`/api/events/${encodeURIComponent(id)}`);
  let start = e.start, end = e.end;
  if (on && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(on)) {
    const dur = Date.parse(e.end + ':00Z') - Date.parse(e.start + ':00Z');
    start = on; end = new Date(Date.parse(start + ':00Z') + dur).toISOString().slice(0, 16);
  }
  const live = ['published', 'postponed'].includes(e.status);
  const isSaved = (state.me.saved || []).includes(e.id);
  const lastNote = [...e.history].reverse().find(h => h.action === 'cancelled' || h.action === 'postponed');
  const dlg = document.createElement('dialog');
  dlg.className = 'ev-dialog';
  dlg.setAttribute('aria-labelledby', 'evdTitle');
  dlg.innerHTML = String(html`<div class="evd">
    <header class="evd-head">
      <div>
        <div class="eyebrow">${e.category} · ${e.departmentShort}</div>
        <h2 id="evdTitle">${e.title}</h2>
      </div>
      <button class="btn plain evd-close" aria-label="Close">${icon.x || '×'}</button>
    </header>
    ${e.status === 'cancelled' ? html`<div class="banner cancelled"><b>This event has been cancelled.</b>${lastNote && lastNote.note ? html`<p>${lastNote.note}</p>` : ''}</div>` : ''}
    ${e.status === 'postponed' ? html`<div class="banner postponed"><b>Postponed. A new date will be announced.</b>${lastNote && lastNote.note ? html`<p>${lastNote.note}</p>` : ''}</div>` : ''}
    <div class="evd-grid">
      <div>
        <dl class="evd-facts">
          <dt>When</dt><dd><b>${D.long(start.slice(0, 10))}</b><br>${D.time(start)} – ${D.time(end)}${start.slice(0, 10) !== end.slice(0, 10) ? ` (${D.short(end)})` : ''}</dd>
          <dt>Where</dt><dd><b>${e.venueName}</b>${e.venueLocation ? html`<br><span class="muted small">${e.venueLocation}</span>` : ''}</dd>
          <dt>Who</dt><dd>${e.audience}</dd>
          <dt>Contact</dt><dd>${e.contactName}<br><a href="mailto:${e.contactEmail}">${e.contactEmail}</a></dd>
        </dl>
        ${e.summary ? html`<p class="lede small">${e.summary}</p>` : ''}
        <div class="evd-body">${(e.description || '').split(/\n{2,}/).map(p => html`<p>${p}</p>`)}</div>
        <div class="acts">
          ${live ? html`<button class="btn ${isSaved ? 'ghost' : 'orange'} sm" id="evdSave" aria-pressed="${isSaved}">${isSaved ? 'Saved to Events' : 'Save to Events'}</button>
            <a class="btn ghost sm" href="/api/events/${e.id}/ics">${icon.cal} Add to my calendar</a>` : ''}
          <a class="btn plain sm" href="#/event/${e.id}${on ? '?on=' + encodeURIComponent(on) : ''}">Full page</a>
          ${e.canEdit ? html`<a class="btn plain sm" href="#/work/events/${e.id}/edit">Edit event</a>` : ''}
        </div>
      </div>
      <section aria-label="Getting there"><h3 class="evd-sub">Getting there</h3><div class="map-box" id="evdMap"><p class="muted small">Loading the campus map…</p></div></section>
    </div>
  </div>`);
  document.body.appendChild(dlg);
  const close = () => dlg.close();
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', ev => { if (ev.target === dlg) close(); }); // click on the backdrop
  dlg.querySelector('.evd-close').onclick = close;
  dlg.querySelectorAll('a[href^="#/"]').forEach(a => a.addEventListener('click', close));
  const save = dlg.querySelector('#evdSave');
  if (save) save.onclick = async () => {
    const now = save.getAttribute('aria-pressed') !== 'true';
    try {
      await api('/api/me/saved', { method: 'POST', body: { eventId: e.id, saved: now } });
      await refreshMe();
      save.setAttribute('aria-pressed', String(now));
      save.textContent = now ? 'Saved to Events' : 'Save to Events';
      save.className = `btn ${now ? 'ghost' : 'orange'} sm`;
      toast(now ? 'Saved. Find it under Events.' : 'Removed from your saved events.');
    } catch (x) { toast(x.message, true); }
  };
  dlg.showModal();
  dlg.querySelector('.evd-close').focus();
  venueMap(dlg.querySelector('#evdMap'), { placeId: e.venuePlace, venueName: e.venueName, venueLocation: e.venueLocation })
    .catch(() => { dlg.querySelector('#evdMap').innerHTML = '<p class="muted small">The campus map could not be loaded.</p>'; });
}

// ---------------- ARCHIVE ----------------
export async function archive({ el, query }) {
  const t = today();
  const year = query.year || '';
  const from = year ? `${year}-01-01` : D.addDays(t, -730);
  const to = year && `${year}-12-31` < t ? `${year}-12-31` : D.addDays(t, -1);
  const { events } = await api('/api/events' + qs({ from, to, q: query.q, dept: query.dept, cat: query.cat, order: 'desc' }));
  const past = events.filter(e => e.end < state.meta.now);
  const byMonth = new Map();
  past.forEach(e => { const k = e.start.slice(0, 7); if (!byMonth.has(k)) byMonth.set(k, []); byMonth.get(k).push(e); });
  const thisYear = Number(t.slice(0, 4));
  put(el, html`
  <div class="page-head"><div class="wrap">
    <div>
      <div class="crumbs"><a href="#/">Calendar</a> / Archive</div>
      <h1>Events archive</h1>
      <p class="muted" style="margin-top:8px">A permanent record of completed university events, including recurring series.</p>
    </div>
  </div></div>
  <div class="wrap" style="padding-top:22px">
    <form class="cal-filters" id="f">
      <input class="input" name="q" aria-label="Search past events" placeholder="Search past events" value="${query.q || ''}">
      <select class="input" name="dept" aria-label="Faculty or office"><option value="">All faculties and offices</option>${state.meta.departments.map(d => html`<option value="${d.id}" ${query.dept === d.id ? raw('selected') : ''}>${d.name}</option>`)}</select>
      <select class="input" name="cat" aria-label="Category"><option value="">All categories</option>${state.meta.categories.map(c => html`<option ${query.cat === c ? raw('selected') : ''}>${c}</option>`)}</select>
      <select class="input" name="year" aria-label="Year"><option value="">Last two years</option>${[thisYear, thisYear - 1, thisYear - 2].map(y => html`<option ${year === String(y) ? raw('selected') : ''}>${y}</option>`)}</select>
      <button class="btn">Filter</button>
    </form>
    <p class="small muted">${past.length} past event${past.length === 1 ? '' : 's'}</p>
    ${past.length ? [...byMonth].map(([k, list]) => html`<section class="archive-month"><h2>${D.monthYear(k + '-01')}</h2><div class="agenda">${list.map(e => evRow(e, { showDate: true, thumb: true }))}</div></section>`)
      : html`<div class="agenda">${empty('file', 'No past events match', 'Try a different search, or clear the filters.', html`<a class="btn ghost" href="#/archive">Clear filters</a>`)}</div>`}
  </div>`);
  el.querySelector('#f').onsubmit = ev => {
    ev.preventDefault();
    go('#/archive' + qs(Object.fromEntries(new FormData(ev.target))));
  };
}

// ---------------- SIGN IN AND CREATE ACCOUNT ----------------
// One form for everyone, like eMhare: the server works out from the username whether this is a
// student (registration number or student email) or staff (email), checks the password and role,
// and the page then sends each person to their own place.
// Students (and staff waiting for a role) land on the calendar; staff with a role land in the workspace.
export const homeFor = me => (me && ['organiser', 'approver', 'admin'].includes(me.role) ? '/work' : '/');
const STUDENT_DOMAIN = 'students.uz.ac.zw';
const REG = /^r\d{6,8}[a-z]?$/;

function authShell(el, left) {
  put(el, html`<div class="login solo"><div class="pane">${left}</div></div>`);
}
// Hidden from people (and screen readers); bots that fill every field give themselves away.
const trap = html`<div class="hp" aria-hidden="true"><label>Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label></div>`;

export async function login({ el, query }) {
  if (state.me) { go('#' + homeFor(state.me)); return; }
  authShell(el, html`
      <div class="auth-title"><img src="/assets/uz-crest.png" alt="University of Zimbabwe crest" width="52" height="54"><div><h1>Welcome to UZ Events</h1><p class="muted">Sign in to see university events.</p></div></div>
      ${query.created ? html`<div class="banner info" role="status"><b>Account created.</b> Sign in with your email and password.</div>` : ''}
      <form id="lf" novalidate>
        <div id="err"></div>
        <label class="field"><span>Email</span><input class="input" type="text" inputmode="email" name="login" autocomplete="username" spellcheck="false" autocapitalize="none" placeholder="Enter your email" value="${query.email || ''}" required></label>
        <label class="field"><span>Password</span><input class="input" type="password" name="password" autocomplete="current-password" placeholder="Enter your password" required></label>
        ${trap}
        <button class="btn" style="width:100%;height:48px">Sign in</button>
      </form>
      <div class="auth-links small">
        <span>No account yet? <a href="#/signup">Create an account</a></span>
        <a href="#" id="forgot">Forgot your password?</a>
      </div>
      <p class="small muted" id="forgotMsg" hidden>Ask the Events Office (Registrar’s Department) to reset your password.</p>`);
  const form = el.querySelector('#lf');
  if (query.created) form.password.focus(); else form.login.focus();
  el.querySelector('#forgot').onclick = ev => { ev.preventDefault(); el.querySelector('#forgotMsg').hidden = false; };
  form.onsubmit = async ev => {
    ev.preventDefault();
    const err = el.querySelector('#err');
    const value = form.login.value.trim();
    if (!value || !form.password.value) { err.innerHTML = String(html`<div class="error" role="alert">Enter your email and password.</div>`); return; }
    const btn = form.querySelector('button.btn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      await api('/api/login', { method: 'POST', body: { login: value, password: form.password.value, website: form.website.value } });
      await refreshMe();
      toast(`Welcome, ${state.me.name}.`);
      const dest = homeFor(state.me);
      const next = query.next && query.next.startsWith('/') && (dest === '/work' || !query.next.startsWith('/work')) ? query.next : dest;
      if (location.hash === '#' + next) render(); else go('#' + next);
    } catch (x) {
      btn.disabled = false; btn.textContent = 'Sign in';
      err.innerHTML = String(html`<div class="error" role="alert">${x.message}</div>`);
    }
  };
}

export async function signup({ el, onCleanup }) {
  if (state.me) { go('#' + homeFor(state.me)); return; }
  authShell(el, html`
      <div class="auth-title"><img src="/assets/uz-crest.png" alt="University of Zimbabwe crest" width="52" height="54"><div><h1>Create an account</h1><p class="muted">Students use their student email. Staff use their own email.</p></div></div>
      <form id="sf" novalidate>
        <div id="err"></div>
        <fieldset><legend>About you</legend>
          <label class="field"><span>Full name</span><input class="input" name="name" autocomplete="name" minlength="2" required></label>
          <label class="field"><span>Email</span><input class="input" type="email" name="email" autocomplete="email" spellcheck="false" placeholder="Enter your email" required aria-describedby="kindHint"><small id="kindHint" aria-live="polite">Your account type is worked out from your email.</small></label>
          <label class="field"><span>Faculty or department</span><select class="input" name="department" required><option value="">Choose…</option>${state.meta.departments.map(d => html`<option value="${d.id}">${d.name}</option>`)}</select></label>
        </fieldset>
        <fieldset><legend>Password</legend>
          <div class="row">
            <label class="field"><span>Password</span><input class="input" type="password" name="password" minlength="10" autocomplete="new-password" required><small>At least 10 characters.</small></label>
            <label class="field"><span>Confirm password</span><input class="input" type="password" name="confirm" minlength="10" autocomplete="new-password" required></label>
          </div>
        </fieldset>
        ${trap}
        <div class="form-actions"><button class="btn" style="width:100%;height:48px">Create account</button></div>
      </form>
      <div class="auth-links small"><span>Already have an account? <a href="#/login">Sign in</a></span></div>`);
  const form = el.querySelector('#sf');
  const err = el.querySelector('#err');
  const hint = el.querySelector('#kindHint');
  onCleanup(fitForm(form));
  const fail = msg => { err.innerHTML = String(html`<div class="error" role="alert">${msg}</div>`); err.scrollIntoView({ block: 'nearest' }); };
  // Tell people, as they type, what kind of account their email will make.
  const kindOf = email => {
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
    if (!e.endsWith('@' + STUDENT_DOMAIN)) return { kind: 'staff' };
    const reg = e.split('@')[0];
    return REG.test(reg) ? { kind: 'student', reg: reg.toUpperCase() } : { kind: 'bad' };
  };
  form.email.oninput = () => {
    const k = kindOf(form.email.value);
    hint.textContent = !k ? 'Your account type is worked out from your email.'
      : k.kind === 'student' ? `Student account. You will sign in with registration number ${k.reg}.`
      : k.kind === 'staff' ? 'Staff account. An administrator will give you a role after you sign up.'
      : `A student email starts with your registration number, e.g. r2420211@${STUDENT_DOMAIN}.`;
  };
  form.onsubmit = async ev => {
    ev.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    const k = kindOf(body.email);
    if (body.name.trim().length < 2) return fail('Enter your full name.');
    if (!k) return fail('Enter a valid email address.');
    if (k.kind === 'bad') return fail(`A student email starts with your registration number, e.g. r2420211@${STUDENT_DOMAIN}.`);
    if (!body.department) return fail('Choose your faculty or department.');
    if (body.password.length < 10) return fail('Password must be at least 10 characters.');
    if (body.password !== body.confirm) return fail('The two passwords do not match.');
    try {
      const r = await api('/api/signup', { method: 'POST', body });
      toast('Account created. Please sign in.');
      go('#/login' + qs({ created: 1, email: r.user.email }));
    } catch (x) { fail(x.message); }
  };
}

// ---------------- MY EVENTS (students, and staff waiting for a role) ----------------
export async function myEvents({ el }) {
  const me = state.me;
  const t = today();
  const to = new Date(Date.parse(t + 'T00:00:00Z') + 180 * 86400000).toISOString().slice(0, 10);
  const { events } = await api('/api/events' + qs({ from: t, to, hideCancelled: 1 }));
  const upcoming = events.filter(e => e.end >= state.meta.now);
  const savedIds = new Set(me.saved || []);
  const saved = upcoming.filter(e => savedIds.has(e.id));
  const seen = new Set();
  const savedOnce = saved.filter(e => !seen.has(e.id) && seen.add(e.id));
  const mine = upcoming.filter(e => e.departmentId === me.department).slice(0, 12);
  const dept = state.meta.departments.find(d => d.id === me.department);
  const waiting = me.role === 'staff';
  document.title = 'Events · UZ Events';
  put(el, html`
  <div class="page-head"><div class="wrap">
    <div>
      <div class="eyebrow">${waiting ? 'Staff' : 'Student'}${me.regNumber ? ` · ${me.regNumber}` : ''}</div>
      <h1 style="margin-top:8px">Welcome, ${me.name.split(' ')[0]}</h1>
      <p class="muted" style="margin:6px 0 0">${dept ? dept.name : ''}</p>
    </div>
  </div></div>
  <div class="wrap" style="padding-top:28px;padding-bottom:56px">
    ${waiting ? html`<div class="banner info" role="status"><b>Your account is waiting for a role.</b><p>An administrator will make you an organiser, approver or administrator. Once they have, reload this page and your workspace opens. Until then you can browse and save events.</p></div>` : ''}
    <section style="margin-bottom:40px">
      <h2 style="margin-bottom:14px">Saved events</h2>
      ${savedOnce.length ? html`<div>${savedOnce.map(e => html`<div class="saved-row">${evRow(e, { showDate: true, thumb: true })}<button class="btn ghost sm" data-unsave="${e.id}" aria-label="Remove ${e.title} from saved events">Remove</button></div>`)}</div>`
        : empty('cal', 'No saved events yet', 'Open any event and choose “Save to Events”. It will appear here.', html`<a class="btn" href="#/">Open the calendar</a>`, 3)}
    </section>
    <section>
      <h2 style="margin-bottom:14px">Coming up in ${dept ? dept.short : 'your faculty'}</h2>
      ${mine.length ? agenda(mine, t) : html`<p class="muted">Nothing scheduled yet. See <a href="#/calendar">the full calendar</a>.</p>`}
    </section>
  </div>`);
  el.onclick = async ev => {
    const b = ev.target.closest('[data-unsave]');
    if (!b) return;
    try { await api('/api/me/saved', { method: 'POST', body: { eventId: b.dataset.unsave, saved: false } }); await refreshMe(); toast('Removed from your saved events.'); render(); }
    catch (x) { toast(x.message, true); }
  };
}
