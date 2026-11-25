import { html, raw, api, D, icon, qs, tag, empty } from '../util.js';
import { state, go, today } from '../app.js';
import { agenda, evRow } from './public.js';

const VIEWS = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['list', 'List']];
const H0 = 7, H1 = 22;

export async function calendar({ el, query, onCleanup }) {
  const t = today();
  let view = VIEWS.some(v => v[0] === query.view) ? query.view : 'month';
  if (view === 'week' && window.innerWidth < 700) view = 'list';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.date || '') ? query.date : t;
  const filters = { q: query.q || '', dept: query.dept || '', cat: query.cat || '', venue: query.venue || '' };

  let from, to, title, prev, next;
  if (view === 'month') {
    const ms = D.monthStart(date);
    from = D.startOfWeek(ms); to = D.addDays(from, 41);
    title = D.monthYear(ms); prev = D.addMonths(ms, -1); next = D.addMonths(ms, 1);
  } else if (view === 'week') {
    from = D.startOfWeek(date); to = D.addDays(from, 6);
    title = `${D.short(from)} – ${D.short(to)} ${to.slice(0, 4)}`; prev = D.addDays(from, -7); next = D.addDays(from, 7);
  } else if (view === 'day') {
    from = to = date; title = D.long(date); prev = D.addDays(date, -1); next = D.addDays(date, 1);
  } else if (view === 'year') {
    from = date.slice(0, 4) + '-01-01'; to = date.slice(0, 4) + '-12-31'; title = date.slice(0, 4);
    prev = `${Number(date.slice(0, 4)) - 1}-01-01`; next = `${Number(date.slice(0, 4)) + 1}-01-01`;
  } else {
    from = date; to = D.addDays(date, 120); title = date === t ? 'Upcoming events' : `From ${D.long(date)}`;
    prev = D.addDays(date, -30); next = D.addDays(date, 30);
  }
  const stripFrom = D.addDays(date, -3);
  const [{ events }, stripData] = await Promise.all([
    api('/api/events' + qs({ from, to, ...filters })),
    api('/api/events' + qs({ from: stripFrom, to: D.addDays(stripFrom, 20), ...filters })),
  ]);
  const stripCounts = new Map();
  stripData.events.forEach(e => { const k = e.start.slice(0, 10); stripCounts.set(k, (stripCounts.get(k) || 0) + 1); });
  const noEvents = (txt) => empty('search', 'No events match', txt, html`<a class="btn ghost" href="#/calendar${qs({ view, date })}">Clear filters</a>`);
  const link = (o) => '#/calendar' + qs({ view, date, ...filters, ...o });

  let body;
  if (view === 'month') body = month(events, from, date, t);
  else if (view === 'week') body = week(events, from, 7, t);
  else if (view === 'day') body = html`<div class="day-layout">${week(events, from, 1, t)}<div>${events.length ? html`<div class="agenda">${events.map(e => evRow(e))}</div>` : html`<div class="agenda">${empty('cal', 'Nothing on this day', 'Try another date, or clear the filters.')}</div>`}</div></div>`;
  else if (view === 'year') body = year(events, date.slice(0, 4), t);
  else body = events.length ? agenda(events, t) : html`<div class="agenda">${noEvents(filters.q ? `Nothing found for “${filters.q}”. Try a different word or clear the filters.` : 'Try a different search or clear the filters.')}</div>`;

  const active = Object.values(filters).some(Boolean);
  el.innerHTML = String(html`
  <div class="wrap cal-page">
    <h1 class="sr">University calendar</h1>
    <div class="cal-bar">
      <div class="seg" role="group" aria-label="Previous or next">
        <a href="${link({ date: prev })}" aria-label="Previous">${icon.left}</a>
        <a href="${link({ date: t })}">Today</a>
        <a href="${link({ date: next })}" aria-label="Next">${icon.right}</a>
      </div>
      <h2 aria-live="polite">${title}</h2>
      <div class="seg" role="group" aria-label="Calendar view" style="margin-left:auto">
        ${VIEWS.map(([k, label]) => html`<a href="${link({ view: k })}" class="${view === k ? 'on' : ''}" ${view === k ? raw('aria-current="page"') : ''}>${label}</a>`)}
      </div>
    </div>
    <form class="cal-filters" id="filters">
      <input class="input" name="q" type="search" placeholder="Search events, venues, faculties" value="${filters.q}" aria-label="Search">
      <select class="input" name="dept" aria-label="Faculty or office"><option value="">All faculties and offices</option>${state.meta.departments.map(d => html`<option value="${d.id}" ${filters.dept === d.id ? raw('selected') : ''}>${d.name}</option>`)}</select>
      <select class="input" name="cat" aria-label="Category"><option value="">All categories</option>${state.meta.categories.map(c => html`<option ${filters.cat === c ? raw('selected') : ''}>${c}</option>`)}</select>
      <select class="input" name="venue" aria-label="Venue"><option value="">All venues</option>${state.meta.venues.map(v => html`<option value="${v.id}" ${filters.venue === v.id ? raw('selected') : ''}>${v.name}</option>`)}</select>
      ${active ? html`<a class="btn ghost" href="#/calendar${qs({ view, date })}">Clear</a>` : html`<button class="btn">Apply</button>`}
    </form>
    <nav class="daystrip" aria-label="Choose a day">${Array.from({ length: 21 }, (_, i) => {
      const d = D.addDays(stripFrom, i); const n = stripCounts.get(d) || 0; const pd = D.parse(d);
      return html`<a href="#/calendar${qs({ view: 'day', date: d, ...filters })}" class="${d === date && view === 'day' ? 'on' : ''} ${d === t ? 'today' : ''}" aria-label="${D.long(d)}, ${n} events"><span>${D.DAYS[pd.getUTCDay()].slice(0, 3)}</span><b>${pd.getUTCDate()}</b><i class="${n ? '' : 'none'}"></i></a>`;
    })}</nav>
    <div class="legend" aria-label="Category key">${state.meta.categories.map(c => tag(c))}<span class="small muted" style="margin-left:auto">${events.length} event${events.length === 1 ? '' : 's'} shown</span></div>
    <div id="calbody">${body}</div>
    <p class="swipe-hint">Swipe left or right to move between ${view === 'list' ? 'months' : view + 's'}.</p>
  </div>`);
  // Fit the calendar to the window: no page scrolling on a computer screen.
  document.body.classList.add('cal-fit');
  const fit = () => fitMonth(el);
  fit();
  window.addEventListener('resize', fit);
  onCleanup(() => { document.body.classList.remove('cal-fit'); window.removeEventListener('resize', fit); });

  const on = el.querySelector('.daystrip .on') || el.querySelector('.daystrip .today');
  if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });

  // swipe between periods on touch screens
  const cb = el.querySelector('#calbody');
  let sx = null, sy = 0;
  cb.addEventListener('touchstart', ev => { sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; }, { passive: true });
  cb.addEventListener('touchend', ev => {
    if (sx === null) return;
    const dx = ev.changedTouches[0].clientX - sx, dy = ev.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(link({ date: dx < 0 ? next : prev }));
  });

  const form = el.querySelector('#filters');
  const apply = () => go('#/calendar' + qs({ view, date, ...Object.fromEntries(new FormData(form)) }));
  form.onsubmit = ev => { ev.preventDefault(); apply(); };
  form.querySelectorAll('select').forEach(s => { s.onchange = apply; });
}

function month(events, gridStart, date, t) {
  const ym = date.slice(0, 7);
  const byDay = groupByDay(events);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = D.addDays(gridStart, i);
    const list = byDay.get(d) || [];
    const shown = list;
    const wk = i % 7 >= 5;
    cells.push(html`<div class="cell ${d.slice(0, 7) !== ym ? 'out' : ''} ${wk ? 'wknd' : ''} ${d === t ? 'today' : ''}">
      <a class="num" href="#/calendar?view=day&date=${d}" aria-label="${D.long(d)}, ${list.length} events">${Number(d.slice(8))}</a>
      ${shown.map(e => html`<a class="item ${e.status === 'cancelled' ? 'is-cancelled' : ''}" data-cat="${e.category}" href="#/event/${e.id}${e.occurrence ? '?on=' + encodeURIComponent(e.start) : ''}" title="${D.time(e.start)} ${e.title}, ${e.venueName}"><b>${D.time(e.start)}</b>${e.title}</a>`)}
      ${list.length ? html`<a class="more" href="#/calendar?view=day&date=${d}" hidden></a>` : ''}
    </div>`);
  }
  return html`<div class="month">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => html`<div class="dow">${d}</div>`)}${cells}</div>`;
}

function week(events, start, days, t) {
  const byDay = groupByDay(events, true);
  const hours = [];
  for (let h = H0; h < H1; h++) hours.push(h);
  const now = state.meta.now;
  const cols = [];
  const heads = [];
  for (let i = 0; i < days; i++) {
    const d = D.addDays(start, i);
    const pd = D.parse(d);
    heads.push(html`<a class="head ${d === t ? 'today' : ''}" href="#/calendar?view=day&date=${d}"><div class="wd">${D.DAYS[pd.getUTCDay()].slice(0, 3)}</div><div class="d">${pd.getUTCDate()}</div></a>`);
    const list = (byDay.get(d) || []).slice().sort((a, b) => a.start.localeCompare(b.start));
    // lane assignment for overlaps
    const laneEnds = [];
    const placed = list.map(e => {
      const s = e.start.slice(0, 10) < d ? H0 * 60 : D.minutes(e.start);
      const en = e.end.slice(0, 10) > d ? H1 * 60 : D.minutes(e.end);
      let lane = laneEnds.findIndex(x => x <= s);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(en); } else laneEnds[lane] = en;
      return { e, s, en, lane };
    });
    const lanes = Math.max(1, laneEnds.length);
    const blocks = placed.map(({ e, s, en, lane }) => {
      const span = (H1 - H0) * 60;
      const top = Math.max(0, (s - H0 * 60) / span * 100);
      const height = (Math.min(en, H1 * 60) - Math.max(s, H0 * 60)) / span * 100;
      const w = 100 / lanes;
      return html`<a class="blk ${e.status === 'cancelled' ? 'is-cancelled' : ''}" data-cat="${e.category}" href="#/event/${e.id}${e.occurrence ? '?on=' + encodeURIComponent(e.start) : ''}"
        style="top:${top}%;height:calc(${height}% - 2px);left:calc(${lane * w}% + 3px);right:auto;width:calc(${w}% - 6px)">
        <b>${e.title}</b>${D.time(e.start)}–${D.time(e.end)} · ${e.venueName}</a>`;
    });
    const nowMin = D.minutes(now);
    const nowLine = d === now.slice(0, 10) && nowMin >= H0 * 60 && nowMin < H1 * 60
      ? html`<div class="nowline" style="top:${(nowMin - H0 * 60) / ((H1 - H0) * 60) * 100}%" aria-hidden="true"></div>` : '';
    cols.push(html`<div class="col">${blocks}${nowLine}</div>`);
  }
  return html`<div class="week" style="--days:${days}">
    <div class="head" style="border-left:0"></div>${heads}
    <div class="gutter">${hours.map(h => html`<div>${String(h).padStart(2, '0')}:00</div>`)}</div>${cols}
  </div>`;
}

function year(events, y, t) {
  const counts = new Map();
  events.forEach(e => { const k = e.start.slice(0, 10); counts.set(k, (counts.get(k) || 0) + 1); });
  const months = [];
  for (let m = 0; m < 12; m++) {
    const ms = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const lead = (D.dow(ms) + 6) % 7;
    const n = D.daysInMonth(ms);
    const days = [];
    for (let i = 0; i < lead; i++) days.push(html`<i></i>`);
    for (let d = 1; d <= n; d++) {
      const k = ms.slice(0, 8) + String(d).padStart(2, '0');
      const c = counts.get(k) || 0;
      days.push(html`<a href="#/calendar?view=day&date=${k}" class="${c >= 3 ? 'l3' : c === 2 ? 'l2' : c === 1 ? 'l1' : ''} ${k === t ? 'today' : ''}" aria-label="${D.long(k)}: ${c} events">${d}</a>`);
    }
    months.push(html`<div class="mini"><h3><a href="#/calendar?view=month&date=${ms}">${D.MONTHS[m]}</a></h3>
      <div class="g">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => html`<span>${x}</span>`)}${days}</div></div>`);
  }
  return html`<div class="scale" style="margin-bottom:12px">Events per day:
    <i style="background:#dfe7f1"></i>1 <i style="background:#8fa8c6"></i>2 <i style="background:var(--navy)"></i>3 or more</div>
    <div class="year">${months}</div>`;
}

function groupByDay(events, spanDays = false) {
  const m = new Map();
  events.forEach(e => {
    let d = e.start.slice(0, 10);
    const last = spanDays ? e.end.slice(0, 10) : d;
    let guard = 0;
    while (d <= last && guard++ < 15) {
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(e);
      d = D.addDays(d, 1);
    }
  });
  return m;
}

// Show as many events in each month cell as fit its height; the rest become "+n more".
function fitMonth(root) {
  root.querySelectorAll('.month .cell').forEach(cell => {
    const items = [...cell.querySelectorAll('.item')];
    const more = cell.querySelector('.more');
    if (!items.length) return;
    items.forEach(i => { i.hidden = false; });
    if (more) more.hidden = true;
    let hiddenCount = 0;
    const overflowing = () => cell.scrollHeight > cell.clientHeight + 1;
    while (overflowing() && hiddenCount < items.length) {
      hiddenCount++;
      items[items.length - hiddenCount].hidden = true;
      if (more) { more.hidden = false; more.textContent = `+${hiddenCount} more`; }
    }
  });
}
