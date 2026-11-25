import { html, raw, api, D, icon, toast, tag, qs, empty } from '../util.js';
import { ico, categoryArt, campusArt } from '../art.js';
import { state, go, today, render, refreshMe, can } from '../app.js';

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

// ---------------- HOME ----------------
export async function home({ el }) {
  const t = today();
  const now = state.meta.now;
  const st = state.meta.settings || {};
  const { events } = await api('/api/events' + qs({ from: t, to: D.addDays(t, 60) }));
  const upcoming = events.filter(e => e.end > now);
  const todayOnly = upcoming.filter(e => e.start.slice(0, 10) <= t && e.end.slice(0, 10) >= t);
  const showingNext = !todayOnly.length;
  const strip = (showingNext ? upcoming.filter(e => e.status !== 'cancelled') : todayOnly).slice(0, 4);
  const week = upcoming.filter(e => e.start.slice(0, 10) < D.addDays(t, 7));
  const featured = upcoming.find(e => e.category === 'Ceremonial' && e.status === 'published') || upcoming.slice().sort((a, b) => (b.views || 0) - (a.views || 0))[0];
  const deptCounts = state.meta.departments.map(d => ({ ...d, n: upcoming.filter(e => e.departmentId === d.id).length }))
    .filter(d => d.n).sort((a, b) => b.n - a.n);
  const weekCount = week.filter(e => e.status !== 'cancelled').length;

  let countdown = '';
  if (featured) {
    const mins = Math.max(0, Math.round((Date.parse(featured.start + ':00Z') - Date.parse(now + ':00Z')) / 60000));
    const dd = Math.floor(mins / 1440), hh = Math.floor((mins % 1440) / 60), mm = mins % 60;
    countdown = html`<div class="right">
      <div class="count"><b>${dd}</b><span>${dd === 1 ? 'Day' : 'Days'}</span></div>
      <div class="count"><b>${hh}</b><span>Hours</span></div>
      <div class="count"><b>${mm}</b><span>Minutes</span></div>
      <div class="details"><span>When <b>${D.long(featured.start)}, ${D.time(featured.start)}</b></span><span>Where <b>${featured.venueName}</b></span></div>
    </div>`;
  }

  put(el, html`
  <section class="hero"><div class="wrap">
    <div>
      <div class="eyebrow">${D.long(now)}</div>
      <h1>What’s on at the University of Zimbabwe</h1>
      <p class="lede">Lectures, ceremonies, research days, sport and culture: every approved university event, in one place.</p>
      <form class="search" id="search" role="search">
        <label class="sr" for="q">Search events</label>
        <input id="q" name="q" placeholder="Search by event, venue or faculty" autocomplete="off">
        <button class="btn">${icon.search}<span>Search</span></button>
      </form>
      <div class="chips" aria-label="Browse by category">
        ${state.meta.categories.map(c => html`<a class="chip" data-cat="${c}" href="#/calendar?view=list&cat=${encodeURIComponent(c)}">${c}</a>`)}
      </div>
    </div>
    <figure class="hero-figure">
      <div class="frame">${st.heroImage ? html`<img src="${st.heroImage}" alt="${st.heroAlt || 'University of Zimbabwe campus'}" fetchpriority="high">` : campusArt()}</div>
      <div class="stamp"><b>${weekCount}</b><span>Events this week</span></div>
      <figcaption>${st.heroImage ? (st.heroCaption || 'University of Zimbabwe, Mount Pleasant') : 'University of Zimbabwe, Mount Pleasant'}</figcaption>
    </figure>
  </div></section>

  <section class="nextband" aria-labelledby="nextH"><div class="wrap">
    <div class="lbl"><h2 id="nextH">${showingNext ? 'Coming up next' : 'Happening today'}</h2><a href="#/calendar?view=day&date=${t}">Day view →</a></div>
    ${strip.length ? strip.map(e => {
      const live = e.start <= now && e.end > now;
      return html`<a class="nb" href="${evHref(e)}" data-cat="${e.category}">
        <time>${showingNext ? `${D.short(e.start)} · ` : ''}${D.time(e.start)}${live ? html`<span class="now">ON NOW</span>` : ''}</time>
        <b>${e.title}</b><span>${e.venueName}</span></a>`;
    }) : html`<div class="nb muted">Nothing scheduled. <a href="#/calendar">Browse the calendar</a>.</div>`}
  </div></section>

  <section class="section"><div class="wrap">
    <div class="section-head"><h2>The next seven days</h2><a href="#/calendar?view=week">Week view →</a></div>
    ${week.length ? agenda(week, t) : html`<div class="agenda">${empty('cal', 'A quiet week', 'No public events are scheduled in the next seven days.', html`<a class="btn ghost" href="#/calendar">Open the calendar</a>`)}</div>`}
  </div></section>

  ${featured ? html`<section class="section"><div class="wrap">
    <div class="feature">
      <div class="left">
        <div class="eyebrow">Coming up · ${featured.category}</div>
        <h2>${featured.title}</h2>
        <p>${featured.summary || ''}</p>
        <a class="btn orange" href="#/event/${featured.id}">Event details</a>
      </div>
      ${countdown}
    </div>
  </div></section>` : ''}

  ${deptCounts.length ? html`<section class="section"><div class="wrap">
    <div class="section-head"><h2>Browse by faculty and office</h2><a href="#/calendar?view=list">All upcoming →</a></div>
    <div class="dept-grid">
      ${deptCounts.map(d => html`<a href="#/calendar?view=list&dept=${d.id}"><span>${d.name}<small>Next 60 days</small></span><span class="n">${d.n}</span></a>`)}
    </div>
  </div></section>` : ''}`);

  el.querySelector('#search').onsubmit = ev => {
    ev.preventDefault();
    const q = el.querySelector('#q').value.trim();
    go('#/calendar' + qs({ view: 'list', q }));
  };
}

// ---------------- EVENT DETAIL ----------------
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
    <div class="crumbs"><a href="#/">What’s on</a> / <a href="#/calendar?date=${start.slice(0, 10)}">Calendar</a> / ${e.departmentShort}</div>
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
        ${state.me && ['published', 'postponed'].includes(e.status) ? html`<button class="btn ${isSaved ? 'ghost' : 'orange'}" id="save" aria-pressed="${isSaved}">${isSaved ? 'Saved to my events' : 'Save to my events'}</button>` : ''}
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
  const save = el.querySelector('#save');
  if (save) save.onclick = async () => {
    try {
      await api('/api/me/saved', { method: 'POST', body: { eventId: e.id, saved: !isSaved } });
      await refreshMe();
      toast(isSaved ? 'Removed from your saved events.' : 'Saved. Find it under My events.');
      render();
    } catch (x) { toast(x.message, true); }
  };
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
    <div class="crumbs"><a href="#/">What’s on</a> / Archive</div>
    <h1>Events archive</h1>
    <p class="muted" style="margin-top:8px">A permanent record of completed university events, including recurring series.</p>
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
// Where each person lands after signing in: staff with a role go to the workspace,
// students and staff still waiting for a role go to My events.
export const homeFor = me => (me && ['organiser', 'approver', 'admin'].includes(me.role) ? '/work' : '/me');
const STUDENT_DOMAIN = 'students.uz.ac.zw';

function authShell(el, st, left, rightTitle, rightText) {
  put(el, html`<div class="login">
    <div class="pane left">${left}</div>
    <div class="right">
      <div class="ph">${st.loginImage ? html`<img src="${st.loginImage}" alt="${st.loginAlt || 'University of Zimbabwe campus'}">` : campusArt()}</div>
      <div class="txt">
        <div class="eyebrow">UZ Events</div>
        <h2 style="margin:8px 0 8px">${rightTitle}</h2>
        <p class="muted" style="max-width:440px;margin:0">${rightText}</p>
      </div>
    </div>
  </div>`);
}
const whoTabs = (base, as, extra = '') => html`<nav class="tabs" aria-label="Account type">
  <a href="#${base}?as=student${extra}" class="${as === 'student' ? 'on' : ''}" ${as === 'student' ? raw('aria-current="page"') : ''}>Student</a>
  <a href="#${base}?as=staff${extra}" class="${as === 'staff' ? 'on' : ''}" ${as === 'staff' ? raw('aria-current="page"') : ''}>Staff</a>
</nav>`;

export async function login({ el, query, path }) {
  if (state.me) { go('#' + homeFor(state.me)); return; }
  const as = query.as === 'staff' || (path === '/staff' && query.as !== 'student') ? 'staff' : 'student';
  const st = state.meta.settings || {};
  const student = as === 'student';
  authShell(el, st, html`
      <img src="/assets/uz-crest.png" alt="University of Zimbabwe crest" width="82" height="84">
      <h1>Sign in</h1>
      <p class="muted" style="margin-bottom:18px">${student ? 'Students sign in with their registration number.' : 'Staff sign in with the email address they registered with.'}</p>
      ${whoTabs('/login', as)}
      ${query.created ? html`<div class="banner info" role="status"><b>Account created.</b><p>${student ? 'Sign in with your registration number and password.' : 'Sign in with your email and password. An administrator will give you a role.'}</p></div>` : ''}
      <form id="lf" novalidate>
        <div id="err"></div>
        ${student
          ? html`<label class="field"><span>Registration number</span><input class="input" name="login" autocomplete="username" autocapitalize="characters" spellcheck="false" placeholder="For example R2420211" value="${query.reg || ''}" required></label>`
          : html`<label class="field"><span>Email</span><input class="input" type="email" name="login" autocomplete="username" value="${query.email || ''}" required></label>`}
        <label class="field"><span>Password</span><input class="input" type="password" name="password" autocomplete="current-password" required></label>
        <button class="btn" style="width:100%;height:48px">Sign in</button>
      </form>
      <p class="small" style="margin-top:18px">No account yet? <a href="#/signup?as=${as}">Create ${student ? 'a student' : 'a staff'} account</a></p>`,
    student ? 'Your events, in one place' : 'Staff access',
    student ? 'Save the events you want to attend and see what your faculty has coming up.'
      : 'Organisers submit events, approvers review them, and administrators manage the system. New staff accounts wait for an administrator to give them a role.');
  const form = el.querySelector('#lf');
  form.login.focus();
  form.onsubmit = async ev => {
    ev.preventDefault();
    const err = el.querySelector('#err');
    const value = form.login.value.trim();
    if (!value || !form.password.value) { err.innerHTML = String(html`<div class="error" role="alert">Enter your ${student ? 'registration number' : 'email'} and password.</div>`); return; }
    try {
      await api('/api/login', { method: 'POST', body: { login: value, password: form.password.value } });
      await refreshMe();
      toast(`Welcome, ${state.me.name}.`);
      const dest = homeFor(state.me);
      const next = query.next && query.next.startsWith('/') && (dest === '/work' || !query.next.startsWith('/work')) ? query.next : dest;
      if (location.hash === '#' + next) render(); else go('#' + next);
    } catch (x) {
      err.innerHTML = String(html`<div class="error" role="alert">${x.message}</div>`);
    }
  };
}

export async function signup({ el, query }) {
  if (state.me) { go('#' + homeFor(state.me)); return; }
  const as = query.as === 'staff' ? 'staff' : 'student';
  const student = as === 'student';
  const st = state.meta.settings || {};
  const depts = state.meta.departments.filter(d => student ? !['reg', 'vc'].includes(d.id) : true);
  authShell(el, st, html`
      <img src="/assets/uz-crest.png" alt="University of Zimbabwe crest" width="82" height="84">
      <h1>Create an account</h1>
      <p class="muted" style="margin-bottom:18px">${student ? 'Use your registration number and your student email.' : 'Use your own email address for now. An administrator gives staff their role.'}</p>
      ${whoTabs('/signup', as)}
      <form id="sf" novalidate>
        <div id="err"></div>
        <label class="field"><span>Full name</span><input class="input" name="name" autocomplete="name" required></label>
        ${student ? html`
          <label class="field"><span>Registration number</span><input class="input" name="regNumber" autocapitalize="characters" spellcheck="false" placeholder="For example R2420211" required></label>
          <label class="field"><span>Student email</span><input class="input" type="email" name="email" autocomplete="email" placeholder="r2420211@${STUDENT_DOMAIN}" required><small id="emailHint">Your registration number followed by @${STUDENT_DOMAIN}</small></label>`
        : html`<label class="field"><span>Email</span><input class="input" type="email" name="email" autocomplete="email" required></label>`}
        <label class="field"><span>${student ? 'Faculty' : 'Department'}</span><select class="input" name="department" required><option value="">Choose…</option>${depts.map(d => html`<option value="${d.id}">${d.name}</option>`)}</select></label>
        <label class="field"><span>Password</span><input class="input" type="password" name="password" minlength="10" autocomplete="new-password" required><small>At least 10 characters.</small></label>
        <label class="field"><span>Confirm password</span><input class="input" type="password" name="confirm" minlength="10" autocomplete="new-password" required></label>
        <button class="btn" style="width:100%;height:48px">Create account</button>
      </form>
      <p class="small" style="margin-top:18px">Already have an account? <a href="#/login?as=${as}">Sign in</a></p>`,
    student ? 'For UZ students' : 'For UZ staff',
    student ? `We check that your student email matches your registration number, for example R2420211 and r2420211@${STUDENT_DOMAIN}.`
      : 'After you create your account, the administrator gives you a role: organiser, approver or administrator. Until then you can save events.');
  const form = el.querySelector('#sf');
  const err = el.querySelector('#err');
  const fail = msg => { err.innerHTML = String(html`<div class="error" role="alert">${msg}</div>`); err.scrollIntoView({ block: 'nearest' }); };
  if (student) {
    // Fill in the student email from the registration number, as long as the student has not typed their own.
    let typed = false;
    form.email.oninput = () => { typed = true; };
    form.regNumber.oninput = () => { if (!typed) form.email.value = form.regNumber.value.trim() ? form.regNumber.value.trim().toLowerCase() + '@' + STUDENT_DOMAIN : ''; };
  }
  form.onsubmit = async ev => {
    ev.preventDefault();
    const body = { kind: as, ...Object.fromEntries(new FormData(form)) };
    if (body.name.trim().length < 2) return fail('Enter your full name.');
    if (student) {
      const reg = body.regNumber.trim().toLowerCase();
      if (!/^r\d{6,8}[a-z]?$/.test(reg)) return fail('Registration number is not valid. It starts with R followed by digits, for example R2420211.');
      if (body.email.trim().toLowerCase() !== `${reg}@${STUDENT_DOMAIN}`) return fail(`Your student email must be ${reg}@${STUDENT_DOMAIN}.`);
    }
    if (!body.department) return fail(`Choose your ${student ? 'faculty' : 'department'}.`);
    if (body.password.length < 10) return fail('Password must be at least 10 characters.');
    if (body.password !== body.confirm) return fail('The two passwords do not match.');
    try {
      const r = await api('/api/signup', { method: 'POST', body });
      toast('Account created. Please sign in.');
      go('#/login' + qs(student ? { as, created: 1, reg: r.user.regNumber } : { as, created: 1, email: r.user.email }));
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
  document.title = 'My events · UZ Events';
  put(el, html`
  <div class="page-head"><div class="wrap">
    <div class="eyebrow">${waiting ? 'Staff' : 'Student'}${me.regNumber ? ` · ${me.regNumber}` : ''}</div>
    <h1 style="margin-top:8px">Welcome, ${me.name.split(' ')[0]}</h1>
    <p class="muted" style="margin:6px 0 0">${dept ? dept.name : ''}</p>
  </div></div>
  <div class="wrap" style="padding-top:28px;padding-bottom:56px">
    ${waiting ? html`<div class="banner info" role="status"><b>Your account is waiting for a role.</b><p>An administrator will make you an organiser, approver or administrator. Once they have, reload this page and your workspace opens. Until then you can browse and save events.</p></div>` : ''}
    <section style="margin-bottom:40px">
      <h2 style="margin-bottom:14px">Saved events</h2>
      ${savedOnce.length ? html`<div>${savedOnce.map(e => html`<div class="saved-row">${evRow(e, { showDate: true, thumb: true })}<button class="btn ghost sm" data-unsave="${e.id}" aria-label="Remove ${e.title} from saved events">Remove</button></div>`)}</div>`
        : empty('cal', 'No saved events yet', 'Open any event and choose “Save to my events”. It will appear here.', html`<a class="btn" href="#/">Browse what’s on</a>`, 3)}
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
