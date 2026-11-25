import { html, raw, api, D, icon, toast, ask, pill, tag, qs, initials, STATUS_LABEL, empty, compressImage } from '../util.js';
import { ico, categoryArt, campusArt } from '../art.js';
import { state, go, can, today, render } from '../app.js';

const put = (el, tpl) => { el.innerHTML = String(tpl); };
const deptName = id => (state.meta.departments.find(d => d.id === id) || {}).name || id;
const deptShort = id => (state.meta.departments.find(d => d.id === id) || {}).short || id;
const venueName = id => (state.meta.venues.find(v => v.id === id) || {}).name || id;
const rerender = () => render();

async function counts() {
  if (!can('approver')) return {};
  const [r, m] = await Promise.all([api('/api/events?scope=review'), api('/api/messages')]);
  return { review: r.events.length + m.messages.filter(x => x.status === 'submitted' && x.canReview).length };
}

async function layout(el, path, content) {
  const c = await counts();
  const me = state.me;
  const a = (href, i, label, badge) => html`<a href="#${href}" class="${path === href ? 'on' : ''}" ${path === href ? raw('aria-current="page"') : ''}>${ico(i)}<span>${label}</span>${badge ? html`<span class="badge">${badge}</span>` : ''}</a>`;
  const b = (href, i, label, badge) => html`<a href="#${href}" class="${path === href || (href !== '/work' && path.startsWith(href) && href !== '/work/events/new') ? 'on' : ''}">${ico(i)}<span>${label}</span>${badge ? html`<span class="badge">${badge}</span>` : ''}</a>`;
  put(el, html`<div class="work">
    <nav class="side" id="side" aria-label="Workspace">
      <div class="me"><span class="avatar">${initials(me.name)}</span><div><b>${me.name}</b><small>${me.role} · ${deptShort(me.department)}</small></div></div>
      <h2>Workspace</h2>
      ${a('/work', 'home', 'Overview')}
      ${a('/work/events', 'list', 'My events')}
      ${a('/work/events/new', 'plus', 'Submit an event')}
      ${a('/work/messages', 'chat', 'Welcome messages')}
      ${can('approver') ? html`<h2>Approvals</h2>${a('/work/review', 'inbox', 'Review queue', c.review)}${a('/work/manage', 'cal', 'Published events')}` : ''}
      ${can('admin') ? html`<h2>Administration</h2>${a('/work/users', 'shield', 'Users and roles')}${a('/work/venues', 'pin', 'Venues')}${a('/work/site', 'image', 'Site photos')}${a('/work/audit', 'file', 'Audit log')}${a('/work/backups', 'db', 'Backups')}` : ''}
    </nav>
    <div class="main" id="main">${content}</div>
    <nav class="bottombar" aria-label="Workspace shortcuts">
      ${b('/work', 'home', 'Overview')}
      ${b('/work/events', 'list', 'Events')}
      <a href="#/work/events/new" class="new ${path === '/work/events/new' ? 'on' : ''}"><span class="circle">${ico('plus')}</span><span>Submit</span></a>
      ${can('approver') ? b('/work/review', 'inbox', 'Review', c.review) : b('/work/messages', 'chat', 'Messages')}
      <button type="button" id="moreBtn" aria-expanded="false" aria-controls="side">${ico('more')}<span>More</span></button>
    </nav>
  </div>`);
  const side = el.querySelector('#side'), more = el.querySelector('#moreBtn');
  const setOpen = open => {
    side.classList.toggle('open', open);
    more.setAttribute('aria-expanded', String(open));
    el.querySelector('#main').inert = open;
    let bd = el.querySelector('.sheet-backdrop');
    if (open && !bd) { bd = document.createElement('div'); bd.className = 'sheet-backdrop'; bd.onclick = () => setOpen(false); el.querySelector('.work').appendChild(bd); }
    if (!open && bd) bd.remove();
    if (open) side.querySelector('a')?.focus(); else more.focus();
  };
  more.onclick = () => setOpen(!side.classList.contains('open'));
  el.onkeydown = event => {
    if (!side.classList.contains('open')) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
    if (event.key === 'Tab') {
      const items = [...side.querySelectorAll('a'), more];
      const index = items.indexOf(document.activeElement);
      event.preventDefault();
      items[(index + (event.shiftKey ? -1 : 1) + items.length) % items.length].focus();
    }
  };
  // A resized desktop must not retain an inert main panel.
  const media = matchMedia('(max-width: 820px)');
  const onResize = () => { if (el.contains(side) && !media.matches && side.classList.contains('open')) setOpen(false); };
  media.addEventListener('change', onResize);
  const observer = new MutationObserver(() => { if (!el.contains(side)) { media.removeEventListener('change', onResize); observer.disconnect(); } });
  observer.observe(el, { childList: true });
  return el.querySelector('#main');
}

// Photo picker: preview, upload (compressed in the browser), remove.
function photoField({ name, value, label, help, fallback }) {
  return html`<div class="photo-field" data-photo="${name}">
    <div class="pv">${value ? html`<img src="${value}" alt="">` : fallback}</div>
    <div>
      <span class="field" style="margin:0 0 6px"><span>${label}</span></span>
      <div class="acts">
        <label class="btn ghost sm" style="cursor:pointer">${ico('upload')}<span>${value ? 'Replace photo' : 'Upload photo'}</span><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="${label}" class="sr"></label>
        <button type="button" class="btn plain sm" data-remove ${value ? '' : raw('hidden')}>${ico('x')}<span>Remove</span></button>
      </div>
      <small>${help}</small>
      <input type="hidden" name="${name}" value="${value || ''}">
    </div>
  </div>`;
}
function wirePhotos(root, onChange = () => {}) {
  root.addEventListener('submit', event => {
    if (root.querySelector('[data-photo][aria-busy="true"]')) {
      event.preventDefault(); event.stopImmediatePropagation();
      toast('Wait for the photo to finish uploading.', true);
    }
  }, true);
  root.querySelectorAll('[data-photo]').forEach(box => {
    const hidden = box.querySelector('input[type=hidden]');
    const pv = box.querySelector('.pv');
    const rm = box.querySelector('[data-remove]');
    const fallback = hidden.value ? '<span class="small">No photo selected</span>' : pv.innerHTML;
    box.querySelector('input[type=file]').onchange = async ev => {
      const f = ev.target.files[0];
      if (!f) return;
      const previous = pv.innerHTML;
      ev.target.disabled = true;
      rm.disabled = true;
      box.setAttribute('aria-busy', 'true');
      pv.innerHTML = '<span class="small" role="status">Uploading…</span>';
      try {
        const data = await compressImage(f);
        const { url } = await api('/api/uploads', { method: 'POST', body: { data } });
        hidden.value = url;
        pv.innerHTML = String(html`<img src="${url}" alt="">`);
        rm.hidden = false;
        onChange();
      } catch (err) { pv.innerHTML = previous; toast(err.message, true); }
      ev.target.disabled = false;
      rm.disabled = false;
      box.removeAttribute('aria-busy');
      ev.target.value = '';
    };
    rm.onclick = () => { hidden.value = ''; pv.innerHTML = box.dataset.fallback || fallback; rm.hidden = true; onChange(); };
  });
}

const head = (title, sub, actions = '') => html`<div class="main-head"><div><h1>${title}</h1>${sub ? html`<p>${sub}</p>` : ''}</div><div>${actions}</div></div>`;

function conflictBox(list) {
  if (!list || !list.length) return '';
  return html`<div class="warn" role="alert"><b>Possible venue clash</b> — the same venue is booked at an overlapping time:
    <ul>${list.map(c => html`<li><a href="#/event/${c.id}">${c.title}</a> · ${D.medium(c.start)} ${D.time(c.start)}–${D.time(c.end)} (${STATUS_LABEL[c.status] || c.status})</li>`)}</ul></div>`;
}

// ---------------- OVERVIEW ----------------
export async function overview({ el, path }) {
  const me = state.me;
  const [{ events: mine }, updates] = await Promise.all([api('/api/events?scope=mine'), api('/api/updates')]);
  const by = s => mine.filter(e => e.status === s).length;
  const hour = Number(state.meta.now.slice(11, 13));
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  let body;
  if (can('approver')) {
    const [s, rq] = await Promise.all([api('/api/stats'), api('/api/events?scope=review')]);
    const catMax = Math.max(1, ...Object.values(s.byCategory));
    body = html`
      <div class="tiles">
        <a class="tile" href="#/work/review"><div class="k">Awaiting your review</div><div class="v">${s.pending}</div><div class="s">${s.pendingWithConflicts} with a venue clash</div></a>
        <a class="tile" href="#/work/manage"><div class="k">Upcoming, published</div><div class="v">${s.upcoming}</div><div class="s">in your remit</div></a>
        <div class="tile"><div class="k">Average approval time</div><div class="v">${s.avgApprovalHours === null ? '—' : s.avgApprovalHours < 48 ? s.avgApprovalHours + 'h' : Math.round(s.avgApprovalHours / 24) + 'd'}</div><div class="s">submission to decision</div></div>
        <div class="tile"><div class="k">Published via system</div><div class="v">${s.publishedShare === null ? '—' : s.publishedShare + '%'}</div><div class="s">of submitted events</div></div>
        <a class="tile" href="#/work/messages"><div class="k">Welcome screens live</div><div class="v">${s.liveMessages}</div><div class="s">${s.pendingMessages} awaiting approval</div></a>
      </div>
      <div class="grid2">
        <section class="panel"><header><h2>Needs a decision</h2><a class="small" href="#/work/review">Open queue</a></header>
          ${rq.events.length ? html`<table class="t"><tbody>${rq.events.slice(0, 6).map(e => html`<tr>
            <td class="title"><a href="#/work/review">${e.title}</a><br><span class="small muted">${e.createdByName} · ${deptShort(e.departmentId)}</span></td>
            <td class="small">${D.medium(e.start)}${e.conflicts.length ? html`<br><span class="pill submitted">Clash</span>` : ''}</td></tr>`)}</tbody></table>`
            : empty('check', 'The queue is clear', 'New submissions will appear here.')}
        </section>
        <section class="panel"><header><h2>Public calendar by category</h2><span class="small muted">Live events</span></header>
          <div class="bars">${state.meta.categories.map(c => html`<div class="bar"><span>${tag(c)}</span><span class="track"><span class="fill" style="width:${((s.byCategory[c] || 0) / catMax) * 100}%"></span></span><b>${s.byCategory[c] || 0}</b></div>`)}</div>
        </section>
      </div>
      <section class="panel"><header><h2>Most viewed events</h2><span class="small muted">${s.totalViews.toLocaleString('en-GB')} public views in total</span></header>
        <table class="t"><thead><tr><th>Event</th><th style="text-align:right">Views</th></tr></thead><tbody>
        ${s.topViewed.map(e => html`<tr><td class="title"><a href="#/event/${e.id}">${e.title}</a></td><td style="text-align:right;font-variant-numeric:tabular-nums">${e.views.toLocaleString('en-GB')}</td></tr>`)}</tbody></table>
      </section>`;
  } else {
    const returned = mine.filter(e => e.status === 'returned');
    body = html`
      <div class="tiles">
        <a class="tile" href="#/work/events?tab=draft"><div class="k">Drafts</div><div class="v">${by('draft')}</div><div class="s">not yet submitted</div></a>
        <a class="tile" href="#/work/events?tab=submitted"><div class="k">Awaiting approval</div><div class="v">${by('submitted')}</div><div class="s">with an approver</div></a>
        <a class="tile" href="#/work/events?tab=returned"><div class="k">Returned to you</div><div class="v">${by('returned')}</div><div class="s">need changes</div></a>
        <a class="tile" href="#/work/events?tab=published"><div class="k">Published</div><div class="v">${by('published')}</div><div class="s">on the public calendar</div></a>
      </div>
      <section class="panel"><header><h2>What to do next</h2></header><div class="pad">
        ${returned.length ? returned.map(e => html`<div class="warn" style="margin:0 0 10px"><b>${e.title}</b> was returned: “${e.reviewNote}” — <a href="#/work/events/${e.id}/edit">revise and resubmit</a></div>`)
          : html`<p class="muted">You have nothing waiting on you.</p>`}
        <div class="form-actions" style="border:0;padding-top:6px">
          <a class="btn" href="#/work/events/new">${icon.plus} Submit an event</a>
          <a class="btn ghost" href="#/work/messages/new">Request a welcome message</a>
        </div>
      </div></section>`;
  }
  const main = await layout(el, path, html`${head(`${greet}, ${me.name.split(' ').filter(w => !/^(Dr|Prof)$/.test(w))[0]}`, `${me.role[0].toUpperCase() + me.role.slice(1)} · ${deptName(me.department)}`, html`<a class="btn" href="#/work/events/new">${icon.plus} Submit an event</a>`)}${body}
    <section class="panel" aria-labelledby="updates-title"><header><h2 id="updates-title">Your updates</h2><span>${updates.unread} unread</span></header>
      <div class="pad">${updates.updates.length ? html`<ul class="updates-list">${updates.updates.map(n => html`<li>${!n.readAt ? html`<strong>New · </strong>` : ''}<a href="${n.href}">${n.message}</a><br><small class="muted">${D.stamp(n.at)}</small></li>`)}</ul>
      ${updates.updates.some(n => !n.readAt) ? html`<button class="btn ghost sm" id="readUpdates">Mark these updates as read</button>` : ''}` : html`<p class="muted">Decisions about your events and welcome messages will appear here.</p>`}</div>
    </section>`);
  const read = main.querySelector('#readUpdates');
  if (read) read.onclick = async () => {
    read.disabled = true;
    try { await api('/api/updates/read', { method: 'POST', body: { ids: updates.updates.map(n => n.id) } }); rerender(); }
    catch (err) { toast(err.message, true); read.disabled = false; }
  };
}

// ---------------- MY EVENTS ----------------
const TABS = [['all', 'All'], ['draft', 'Drafts'], ['submitted', 'Awaiting approval'], ['returned', 'Returned'], ['published', 'Published'], ['closed', 'Cancelled / rejected']];
export async function myEvents({ el, path, query }) {
  const { events } = await api('/api/events?scope=mine');
  const tab = query.tab || 'all';
  const inTab = (e, k) => k === 'all' || (k === 'closed' ? ['cancelled', 'rejected', 'postponed'].includes(e.status) : e.status === k);
  const list = events.filter(e => inTab(e, tab));
  const main = await layout(el, path, html`
    ${head('My events', 'Everything you have created, from first draft to publication.', html`<a class="btn" href="#/work/events/new">${icon.plus} New event</a>`)}
    <div class="tabs">${TABS.map(([k, l]) => html`<a href="#/work/events?tab=${k}" class="${tab === k ? 'on' : ''}">${l}<span>${events.filter(e => inTab(e, k)).length}</span></a>`)}</div>
    <div class="panel table-wrap">${list.length ? html`<table class="t">
      <thead><tr><th>Event</th><th>When</th><th>Venue</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map(e => html`<tr>
        <td class="title"><a href="#/event/${e.id}">${e.title}</a><br>${tag(e.category)}${e.reviewNote && e.status !== 'published' ? html`<div class="small" style="color:#8a4b00;margin-top:4px">Approver: “${e.reviewNote}”</div>` : ''}</td>
        <td class="small">${D.medium(e.start)}<br>${D.time(e.start)}–${D.time(e.end)}</td>
        <td class="small">${e.venueName}${e.conflicts && e.conflicts.length ? html`<br><span class="pill submitted">Clash</span>` : ''}</td>
        <td>${pill(e.status)}</td>
        <td><div class="acts">
          ${['draft', 'returned'].includes(e.status) ? html`<a class="btn ghost sm" href="#/work/events/${e.id}/edit">Edit</a><button class="btn sm" data-act="submit" data-id="${e.id}">Submit</button>` : ''}
          ${e.status === 'submitted' ? html`<button class="btn ghost sm" data-act="withdraw" data-id="${e.id}">Withdraw</button>` : ''}
          ${e.status === 'draft' ? html`<button class="btn danger sm" data-act="delete" data-id="${e.id}">Delete</button>` : ''}
          ${['published', 'postponed'].includes(e.status) ? html`<button class="btn danger sm" data-act="cancel" data-id="${e.id}">Cancel event</button>` : ''}
        </div></td></tr>`)}</tbody></table>`
      : empty('list', tab === 'all' ? 'You haven’t created any events yet' : 'Nothing in this list', tab === 'all' ? 'Submit an event and it will appear here while it is reviewed.' : 'Events move here as their status changes.', html`<a class="btn" href="#/work/events/new">${icon.plus} Submit an event</a>`)}</div>`);
  main.onclick = async ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    try {
      if (act === 'delete') {
        if (!await ask({ title: 'Delete this draft?', text: 'This cannot be undone.', confirm: 'Delete draft', danger: true })) return;
        await api('/api/events/' + id, { method: 'DELETE' }); toast('Draft deleted permanently.');
      } else if (act === 'cancel') {
        const r = await ask({ title: 'Cancel this event?', text: 'The event stays on the calendar marked as cancelled, with your reason shown publicly.', fields: [{ name: 'note', label: 'Reason (shown publicly)', type: 'textarea', required: true }], confirm: 'Cancel event', danger: true });
        if (!r) return;
        await api(`/api/events/${id}/action`, { method: 'POST', body: { action: 'cancel', note: r.note } }); toast('Cancelled — the calendar now shows it as cancelled, with your reason.');
      } else {
        const res = await api(`/api/events/${id}/action`, { method: 'POST', body: { action: act } });
        const undo = async () => { await api(`/api/events/${id}/action`, { method: 'POST', body: { action: act === 'submit' ? 'withdraw' : 'submit' } }); rerender(); };
        toast(act === 'submit' ? (res.conflicts.length ? 'Sent to an approver — they will see the venue clash.' : 'Sent to an approver for review.') : 'Withdrawn — back in your drafts.', { undo });
      }
      rerender();
    } catch (err) { toast(err.message, true); }
  };
}

// ---------------- EVENT FORM ----------------
export async function eventForm({ el, path, params }) {
  const me = state.me;
  let e = null;
  if (params.id) e = (await api('/api/events/' + encodeURIComponent(params.id))).event;
  if (e && !e.canEdit) { await layout(el, path, html`<div class="empty-state"><h1>This event cannot be edited</h1><p>It is ${e.status}. <a href="#/work/events">Back to my events</a></p></div>`); return; }
  const live = e && ['published', 'postponed'].includes(e.status);
  const central = me.role === 'admin' || (me.role === 'approver' && me.department === 'reg');
  const isReviewerEdit = e && e.canReview && e.createdBy !== me.id;
  const t = today();
  const v = e || { title: '', summary: '', description: '', category: state.meta.categories[0], departmentId: me.department, venueId: '', start: `${D.addDays(t, 7)}T10:00`, end: `${D.addDays(t, 7)}T12:00`, audience: 'Staff, students and invited guests', contactName: me.name, contactEmail: me.email, isPublic: true, recurrence: { freq: 'none', until: null } };
  const deptLocked = !central && !isReviewerEdit;

  const main = await layout(el, path, html`
    ${head(e ? (live ? 'Amend published event' : 'Edit event') : 'Submit an event', e ? html`${pill(e.status)} ${e.reviewNote && e.status === 'returned' ? html`<span>Approver note: “${e.reviewNote}”</span>` : ''}` : 'Your event goes to an approver before it appears on the public calendar.')}
    <div class="form-layout">
      <form class="form-card" id="ef" novalidate>
        <div id="err"></div>
        <fieldset><legend>About the event</legend>
          <label class="field"><span>Title</span><input class="input" name="title" required maxlength="140" value="${v.title}"></label>
          <label class="field"><span>Short summary</span><input class="input" name="summary" maxlength="280" value="${v.summary}"><small>One sentence shown in listings. Up to 280 characters.</small></label>
          <label class="field"><span>Full description</span><textarea class="input" name="description" maxlength="5000" rows="6">${v.description}</textarea></label>
          <div class="row">
            <label class="field"><span>Category</span><select class="input" name="category">${state.meta.categories.map(c => html`<option ${v.category === c ? raw('selected') : ''}>${c}</option>`)}</select></label>
            <label class="field"><span>Faculty or office</span><select class="input" name="departmentId" ${deptLocked ? raw('disabled') : ''}>${state.meta.departments.map(d => html`<option value="${d.id}" ${v.departmentId === d.id ? raw('selected') : ''}>${d.name}</option>`)}</select>${deptLocked ? html`<small>Organisers submit for their own department.</small>` : ''}</label>
          </div>
        </fieldset>
        <fieldset><legend>When and where</legend>
          <div class="row">
            <label class="field"><span>Start date</span><input class="input" type="date" name="sd" required value="${v.start.slice(0, 10)}"></label>
            <label class="field"><span>Start time</span><input class="input" type="time" name="st" required value="${v.start.slice(11)}"></label>
            <label class="field"><span>End date</span><input class="input" type="date" name="ed" required value="${v.end.slice(0, 10)}"></label>
            <label class="field"><span>End time</span><input class="input" type="time" name="et" required value="${v.end.slice(11)}"></label>
          </div>
          <div class="row">
            <label class="field"><span>Venue</span><select class="input" name="venueId" required><option value="">Choose a venue…</option>${state.meta.venues.map(x => html`<option value="${x.id}" ${v.venueId === x.id ? raw('selected') : ''}>${x.name} (${x.capacity})</option>`)}</select></label>
            <label class="field"><span>Repeats</span><select class="input" name="freq">${[['none', 'Does not repeat'], ['weekly', 'Every week'], ['monthly', 'Every month']].map(([k, l]) => html`<option value="${k}" ${v.recurrence.freq === k ? raw('selected') : ''}>${l}</option>`)}</select></label>
            <label class="field" id="untilF"><span>Repeat until</span><input class="input" type="date" name="until" value="${v.recurrence.until ? v.recurrence.until.slice(0, 10) : ''}"></label>
          </div>
          <div id="conf" aria-live="polite"></div>
        </fieldset>
        <fieldset><legend>Photo</legend>
          ${photoField({ name: 'coverImage', value: v.coverImage, label: 'Cover photo (optional)', help: 'Landscape works best. Use photos you have permission to publish. Without one, the category artwork is shown.', fallback: categoryArt(v.category) })}
          <label class="field"><span>Describe the photo</span><input class="input" name="coverAlt" maxlength="140" value="${v.coverAlt || ''}" placeholder="e.g. Graduands in gowns outside the Great Hall"><small>Read aloud by screen readers.</small></label>
        </fieldset>
        <fieldset><legend>Audience and contact</legend>
          <label class="field"><span>Who is it for?</span><input class="input" name="audience" maxlength="140" value="${v.audience}"></label>
          <div class="row">
            <label class="field"><span>Contact name</span><input class="input" name="contactName" required maxlength="100" value="${v.contactName}"></label>
            <label class="field"><span>Contact email</span><input class="input" type="email" name="contactEmail" required maxlength="120" value="${v.contactEmail}"></label>
          </div>
          <label class="check"><input type="checkbox" name="isPublic" ${v.isPublic ? raw('checked') : ''}><span><b>Show on the public calendar</b><br><span class="muted small">Untick for internal events (for example Senate). They will only be visible to signed-in staff.</span></span></label>
        </fieldset>
        ${live ? html`<fieldset><legend>Reason for the change</legend><label class="field"><span>Change note</span><textarea class="input" name="changeNote" rows="3" maxlength="300" placeholder="e.g. Moved to the Great Hall to accommodate more guests"></textarea><small>Required when changing the title, time or venue of a published event. Shown publicly under “Updates”.</small></label></fieldset>` : ''}
        <div class="form-actions">
          ${live ? html`<button class="btn" data-mode="save">Save changes</button>`
            : html`${!e || e.createdBy === me.id ? html`<button class="btn" data-mode="submit">Save and submit for approval</button>` : ''}<button class="btn ghost" data-mode="save">Save ${!e || e.status === 'draft' || e.status === 'returned' ? 'draft' : 'changes'}</button>`}
          <a class="btn plain" href="#/work/events">Cancel</a>
        </div>
      </form>
      <aside class="preview"><h2>Preview in the calendar</h2><div id="pv"></div>
        <h2 style="margin-top:22px">How approval works</h2>
        <ol class="small muted" style="padding-left:18px;margin:0">
          <li>You save a draft and submit it.</li>
          <li>A ${deptShort(v.departmentId)} or central approver reviews it and may return it with a note.</li>
          <li>Once approved it appears on the public calendar. Later changes are recorded.</li>
        </ol>
      </aside>
    </div>`);

  const f = main.querySelector('#ef');
  const read = () => ({
    title: f.elements.title.value, summary: f.elements.summary.value, description: f.elements.description.value, category: f.elements.category.value,
    departmentId: f.elements.departmentId.value, venueId: f.elements.venueId.value,
    start: `${f.elements.sd.value}T${f.elements.st.value}`, end: `${f.elements.ed.value}T${f.elements.et.value}`,
    audience: f.elements.audience.value, contactName: f.elements.contactName.value, contactEmail: f.elements.contactEmail.value, isPublic: f.elements.isPublic.checked,
    recurrence: { freq: f.elements.freq.value, until: f.elements.freq.value === 'none' ? null : f.elements.until.value },
    changeNote: f.elements.changeNote ? f.elements.changeNote.value : '',
    coverImage: f.elements.coverImage.value || null, coverAlt: f.elements.coverAlt.value,
  });
  const preview = () => {
    const d = read();
    main.querySelector('#untilF').style.display = d.recurrence.freq === 'none' ? 'none' : '';
    const ok = /T\d\d:\d\d$/.test(d.start) && d.start.length === 16;
    const ph = main.querySelector('[data-photo="coverImage"]');
    ph.dataset.fallback = String(categoryArt(d.category));
    if (!d.coverImage) ph.querySelector('.pv').innerHTML = ph.dataset.fallback;
    main.querySelector('#pv').innerHTML = String(html`<div class="cover" style="margin-bottom:0">${d.coverImage ? html`<img src="${d.coverImage}" alt="">` : categoryArt(d.category)}</div><div class="agenda"><div class="ev-row" data-cat="${d.category}" style="grid-template-columns:1fr">
      <span class="time">${ok ? `${D.medium(d.start)} · ${d.start.slice(11)}–${d.end.slice(11)}` : 'Date to be set'}</span>
      <span><span class="t">${d.title || 'Event title'}</span><span class="meta">${d.venueId ? venueName(d.venueId) : 'Venue'} · ${deptShort(d.departmentId)}</span></span>
      <span>${tag(d.category)} ${d.isPublic ? '' : html`<span class="pill draft">Internal</span>`}</span>
    </div></div>${d.summary ? html`<p class="small muted" style="margin-top:8px">${d.summary}</p>` : ''}`);
  };
  let timer;
  const checkConflicts = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const d = read();
      const box = main.querySelector('#conf');
      if (!d.venueId || d.start.length !== 16 || d.end.length !== 16) { box.innerHTML = ''; return; }
      try {
        const { conflicts } = await api('/api/conflicts', { method: 'POST', body: { venueId: d.venueId, start: d.start, end: d.end, recurrence: d.recurrence, excludeId: e && e.id } });
        box.innerHTML = conflicts.length ? String(conflictBox(conflicts)) + '<p class="small muted">You can still submit — the approver will see the clash and decide.</p>' : String(html`<div class="ok">${venueName(d.venueId)} looks free at that time.</div>`);
      } catch { box.innerHTML = ''; }
    }, 350);
  };
  f.addEventListener('input', () => { preview(); });
  wirePhotos(main, preview);
  f.addEventListener('change', ev => { preview(); if (['venueId', 'sd', 'st', 'ed', 'et', 'freq', 'until'].includes(ev.target.name)) checkConflicts(); });
  // keep end date in step with start date
  f.elements.sd.addEventListener('change', () => { if (f.elements.ed.value < f.elements.sd.value) f.elements.ed.value = f.elements.sd.value; });
  preview(); checkConflicts();

  let mode = 'save';
  f.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; }));
  f.onsubmit = async ev => {
    ev.preventDefault();
    const err = main.querySelector('#err');
    err.innerHTML = '';
    try {
      const body = read();
      const res = e ? await api('/api/events/' + e.id, { method: 'PUT', body }) : await api('/api/events', { method: 'POST', body });
      if (mode === 'submit') {
        await api(`/api/events/${res.event.id}/action`, { method: 'POST', body: { action: 'submit' } });
        toast(res.conflicts.length ? 'Submitted for approval — the approver will see the venue clash.' : 'Submitted for approval.');
      } else toast(live ? 'Changes saved and recorded.' : 'Saved.');
      go(isReviewerEdit || live ? '#/event/' + res.event.id : '#/work/events');
    } catch (x) {
      err.innerHTML = String(html`<div class="error" role="alert">${x.message}</div>`);
      err.scrollIntoView({ block: 'center' });
    }
  };
}

// ---------------- REVIEW QUEUE ----------------
export async function review({ el, path }) {
  const [{ events }, { messages }] = await Promise.all([api('/api/events?scope=review'), api('/api/messages')]);
  const pendingMsgs = messages.filter(m => m.status === 'submitted' && m.canReview);
  const now = state.meta.now;
  const waited = s => { const h = Math.round((Date.parse(now + ':00Z') - Date.parse(s + ':00Z')) / 36e5); return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`; };
  const main = await layout(el, path, html`
    ${head('Review queue', 'Approve, return with a note, or reject. Every decision is recorded in the audit log.')}
    <h2 style="font-size:20px;margin:6px 0 14px">Events <span class="muted">(${events.length})</span></h2>
    ${events.length ? events.map(e => html`<article class="review-card" data-cat="${e.category}">
      <div class="info">
        <div>${tag(e.category)} <span class="small muted">· waiting ${waited(e.submittedAt)}</span></div>
        <h3><a href="#/event/${e.id}" style="text-decoration:none">${e.title}</a></h3>
        ${e.summary ? html`<p class="muted">${e.summary}</p>` : ''}
        <dl class="kv">
          <dt>When</dt><dd>${D.range(e.start, e.end)}${e.recurrence.freq !== 'none' ? ` · repeats ${e.recurrence.freq} until ${D.short(e.recurrence.until)}` : ''}</dd>
          <dt>Venue</dt><dd>${e.venueName}</dd>
          <dt>Department</dt><dd>${e.departmentName}</dd>
          <dt>Submitted by</dt><dd>${e.createdByName} · ${D.stamp(e.submittedAt)}</dd>
          <dt>Visibility</dt><dd>${e.isPublic ? 'Public calendar' : 'Internal (staff only)'}</dd>
        </dl>
        ${conflictBox(e.conflicts)}
      </div>
      <form class="decide" data-id="${e.id}">
        <label class="field"><span>Note to organiser</span><textarea class="input" name="note" rows="4" placeholder="Required when returning or rejecting"></textarea></label>
        ${e.createdBy === state.me.id ? html`<p class="small muted">You submitted this event, so another approver must review it.</p>` : html`<div class="btns">
          <button class="btn sm" value="approve">Approve</button>
          <button class="btn ghost sm" value="return">Return</button>
          <button class="btn danger sm" value="reject">Reject</button>
        </div>`}
        <a class="small" href="#/work/events/${e.id}/edit" style="display:inline-block;margin-top:12px">Edit before approving</a>
      </form>
    </article>`) : html`<div class="panel">${empty('check', 'Review queue clear', 'Nothing is waiting for a decision. New submissions will appear here.')}</div>`}

    <h2 style="font-size:20px;margin:30px 0 14px">Welcome messages <span class="muted">(${pendingMsgs.length})</span></h2>
    ${pendingMsgs.length ? pendingMsgs.map(m => html`<article class="review-card">
      <div class="info">
        <div class="eyebrow">For ${m.screenName}</div>
        <h3>${m.guestName}</h3>
        <p class="muted">${m.guestTitle}</p>
        <blockquote style="margin:10px 0;font:italic 17px var(--serif);border-left:3px solid var(--orange);padding-left:14px">${m.wording}</blockquote>
        <dl class="kv"><dt>Display</dt><dd>${D.stamp(m.displayFrom)} → ${D.stamp(m.displayUntil)}</dd><dt>Linked event</dt><dd>${m.eventTitle || '—'}</dd><dt>Requested by</dt><dd>${m.createdByName}</dd></dl>
      </div>
      <form class="decide" data-msg="${m.id}">
        <label class="field"><span>Note</span><textarea class="input" name="note" rows="3"></textarea></label>
        <div class="btns"><button class="btn sm" value="approve">Approve</button><button class="btn ghost sm" value="return">Return</button><button class="btn danger sm" value="reject">Reject</button></div>
      </form>
    </article>`) : html`<div class="panel">${empty('chat', 'No welcome messages waiting', 'Requests from organisers will appear here.')}</div>`}`);

  main.querySelectorAll('form.decide').forEach(form => {
    form.onsubmit = async ev => {
      ev.preventDefault();
      const action = ev.submitter && ev.submitter.value;
      if (!action) return;
      const note = form.note.value.trim();
      const url = form.dataset.id ? `/api/events/${form.dataset.id}/action` : `/api/messages/${form.dataset.msg}/action`;
      try {
        await api(url, { method: 'POST', body: { action, note } });
        toast({ approve: 'Approved — now live on the public calendar.', return: 'Returned to the organiser with your note.', reject: 'Rejected — the organiser can see your note.' }[action]);
        rerender();
      } catch (err) { toast(err.message, true); }
    };
  });
}

// ---------------- MANAGE PUBLISHED ----------------
export async function manage({ el, path, query }) {
  const { events } = await api('/api/events' + qs({ scope: 'manage', q: query.q }));
  const tab = query.tab || 'upcoming';
  const now = state.meta.now;
  const T = {
    upcoming: e => ['published', 'postponed'].includes(e.status) && e.end >= now,
    past: e => e.status === 'published' && e.end < now,
    cancelled: e => e.status === 'cancelled',
    decided: e => ['returned', 'rejected'].includes(e.status),
  };
  const labels = { upcoming: 'Upcoming', past: 'Past', cancelled: 'Cancelled', decided: 'Returned / rejected' };
  const list = events.filter(T[tab]).sort((a, b) => tab === 'past' ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start));
  const main = await layout(el, path, html`
    ${head('Published events', 'Amend, reschedule, postpone or cancel events in your remit. Significant changes are shown publicly.')}
    <form id="s" class="search" style="margin:0 0 14px"><input name="q" aria-label="Search published events" placeholder="Search events" value="${query.q || ''}"><button class="btn" aria-label="Search">${icon.search}</button></form>
    <div class="tabs">${Object.keys(T).map(k => html`<a href="#/work/manage${qs({ tab: k, q: query.q })}" class="${tab === k ? 'on' : ''}">${labels[k]}<span>${events.filter(T[k]).length}</span></a>`)}</div>
    <div class="panel table-wrap">${list.length ? html`<table class="t"><thead><tr><th>Event</th><th>When</th><th>Venue</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map(e => html`<tr>
        <td class="title"><a href="#/event/${e.id}">${e.title}</a><br><span class="small muted">${e.departmentShort} · ${e.views} views${e.isPublic ? '' : ' · internal'}</span></td>
        <td class="small">${D.medium(e.start)}<br>${D.time(e.start)}–${D.time(e.end)}</td>
        <td class="small">${e.venueName}${e.conflicts.length ? html`<br><span class="pill submitted" title="${e.conflicts.map(c => c.title).join(', ')}">Clash</span>` : ''}</td>
        <td>${pill(e.status)}</td>
        <td><div class="acts">
          ${e.canEdit ? html`<a class="btn ghost sm" href="#/work/events/${e.id}/edit">Amend</a>` : ''}
          ${['published', 'postponed'].includes(e.status) ? html`<button class="btn ghost sm" data-act="reschedule" data-id="${e.id}">Reschedule</button>` : ''}
          ${e.status === 'published' ? html`<button class="btn ghost sm" data-act="postpone" data-id="${e.id}">Postpone</button>` : ''}
          ${['published', 'postponed'].includes(e.status) ? html`<button class="btn danger sm" data-act="cancel" data-id="${e.id}">Cancel</button>` : ''}
          ${['cancelled', 'postponed'].includes(e.status) ? html`<button class="btn sm" data-act="reinstate" data-id="${e.id}">Reinstate</button>` : ''}
        </div></td></tr>`)}</tbody></table>` : empty('cal', 'No events in this list', 'Try another tab or search.')}</div>`);
  main.querySelector('#s').onsubmit = ev => { ev.preventDefault(); go('#/work/manage' + qs({ tab, q: ev.target.q.value })); };
  main.onclick = async ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const e = events.find(x => x.id === b.dataset.id);
    let body = null;
    if (b.dataset.act === 'reschedule') {
      const r = await ask({ title: 'Reschedule event', text: `“${e.title}” — the new time is published with your note.`, confirm: 'Reschedule', fields: [
        { name: 'sd', label: 'New date', type: 'date', value: e.start.slice(0, 10), required: true },
        { name: 'st', label: 'Start time', type: 'time', value: e.start.slice(11), required: true },
        { name: 'et', label: 'End time', type: 'time', value: e.end.slice(11), required: true },
        { name: 'note', label: 'Reason (shown publicly)', type: 'textarea', required: true }] });
      if (r) body = { action: 'postpone', note: r.note, start: `${r.sd}T${r.st}`, end: `${r.sd}T${r.et}` };
    } else if (b.dataset.act === 'postpone') {
      const r = await ask({ title: 'Postpone — new date to be announced', text: 'The event stays listed and is marked as postponed.', confirm: 'Postpone', fields: [{ name: 'note', label: 'Reason (shown publicly)', type: 'textarea', required: true }] });
      if (r) body = { action: 'postpone', note: r.note };
    } else if (b.dataset.act === 'cancel') {
      const r = await ask({ title: 'Cancel event', text: `“${e.title}” will be marked as cancelled on the public calendar.`, confirm: 'Cancel event', danger: true, fields: [{ name: 'note', label: 'Reason (shown publicly)', type: 'textarea', required: true }] });
      if (r) body = { action: 'cancel', note: r.note };
    } else if (b.dataset.act === 'reinstate') {
      const r = await ask({ title: 'Reinstate event', text: 'The event returns to the calendar as confirmed.', confirm: 'Reinstate', fields: [{ name: 'note', label: 'Note (optional)', type: 'textarea' }] });
      if (r) body = { action: 'reinstate', note: r.note };
    }
    if (!body) return;
    try {
      const res = await api(`/api/events/${e.id}/action`, { method: 'POST', body });
      toast(res.conflicts && res.conflicts.length ? 'Saved — note: this now clashes with another booking.' : 'Saved and recorded.');
      rerender();
    } catch (err) { toast(err.message, true); }
  };
}

// ---------------- WELCOME MESSAGES ----------------
export async function messages({ el, path, query }) {
  const { messages: all } = await api('/api/messages');
  const tab = query.tab || 'all';
  const F = { all: () => true, live: m => m.state === 'live', scheduled: m => m.state === 'scheduled', submitted: m => m.status === 'submitted', draft: m => ['draft', 'returned'].includes(m.status), ended: m => ['expired', 'withdrawn', 'rejected'].includes(m.state) };
  const L = { all: 'All', live: 'On screen now', scheduled: 'Scheduled', submitted: 'Awaiting approval', draft: 'Drafts / returned', ended: 'Ended' };
  const list = all.filter(F[tab]);
  const main = await layout(el, path, html`
    ${head('Visitor welcome messages', 'Approved messages show on the chosen screen during their display period and expire automatically.', html`<a class="btn" href="#/work/messages/new">${icon.plus} New message</a>`)}
    <div class="tabs">${Object.keys(F).map(k => html`<a href="#/work/messages?tab=${k}" class="${tab === k ? 'on' : ''}">${L[k]}<span>${all.filter(F[k]).length}</span></a>`)}</div>
    <div class="panel table-wrap">${list.length ? html`<table class="t"><thead><tr><th>Guest</th><th>Screen</th><th>Display period</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map(m => html`<tr>
        <td class="title"><b>${m.guestName}</b><br><span class="small muted">${m.guestTitle}</span>${m.reviewNote && m.status === 'returned' ? html`<div class="small" style="color:#8a4b00">Approver: “${m.reviewNote}”</div>` : ''}</td>
        <td class="small"><a href="#/display/${m.screen}">${m.screenName}</a></td>
        <td class="small">${D.stamp(m.displayFrom)}<br>→ ${D.stamp(m.displayUntil)}</td>
        <td>${pill(m.state)}</td>
        <td><div class="acts">
          ${m.canEdit && !['expired', 'rejected'].includes(m.state) ? html`<a class="btn ghost sm" href="#/work/messages/${m.id}/edit">Edit</a>` : ''}
          ${['draft', 'returned'].includes(m.status) && m.createdBy === state.me.id ? html`<button class="btn sm" data-act="submit" data-id="${m.id}">Submit</button>` : ''}
          ${m.status === 'submitted' && m.canReview ? html`<button class="btn sm" data-act="approve" data-id="${m.id}">Approve</button>` : ''}
          ${['live', 'scheduled', 'submitted'].includes(m.state) && (m.canReview || m.createdBy === state.me.id) ? html`<button class="btn danger sm" data-act="withdraw" data-id="${m.id}">Withdraw</button>` : ''}
        </div></td></tr>`)}</tbody></table>` : empty('chat', 'No messages in this list', 'Welcome messages for official guests appear here.', html`<a class="btn ghost" href="#/work/messages/new">${icon.plus} New message</a>`)}</div>`);
  main.onclick = async ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'withdraw' && !await ask({ title: 'Withdraw this message?', text: 'It will be removed from the screen immediately.', confirm: 'Withdraw', danger: true })) return;
    try {
      await api(`/api/messages/${b.dataset.id}/action`, { method: 'POST', body: { action: b.dataset.act } });
      toast({ submit: 'Sent to an approver for review.', approve: 'Approved — it will appear on screen during its display period.', withdraw: 'Withdrawn — removed from the screen.' }[b.dataset.act]);
      rerender();
    } catch (err) { toast(err.message, true); }
  };
}

export async function messageForm({ el, path, params }) {
  let m = null;
  if (params.id) {
    const { messages: all } = await api('/api/messages');
    m = all.find(x => x.id === params.id);
    if (!m) throw new Error('Message not found.');
  }
  const { events } = await api('/api/events' + qs({ from: today(), to: D.addDays(today(), 120) }));
  const seen = new Set();
  const evOpts = events.filter(e => !seen.has(e.id) && seen.add(e.id));
  const t = today();
  const v = m || { guestName: '', guestTitle: '', wording: 'The University of Zimbabwe warmly welcomes you.', eventId: '', screen: state.meta.screens[0].id, displayFrom: `${t}T07:00`, displayUntil: `${t}T18:00` };
  const main = await layout(el, path, html`
    ${head(m ? 'Edit welcome message' : 'New welcome message', 'Use the guest’s approved name and title exactly as protocol has confirmed them.')}
    <div class="form-layout">
      <form class="form-card" id="mf" novalidate>
        <div id="err"></div>
        <fieldset><legend>Guest</legend>
          <label class="field"><span>Guest name</span><input class="input" name="guestName" maxlength="120" required value="${v.guestName}" placeholder="e.g. His Excellency the Ambassador of Kenya"></label>
          <label class="field"><span>Title or organisation</span><input class="input" name="guestTitle" maxlength="160" value="${v.guestTitle}"></label>
          ${photoField({ name: 'photo', value: v.photo, label: 'Guest photo (optional)', help: 'Portrait, supplied or approved by protocol. If empty, the linked event’s photo is used.', fallback: html`${ico('user', { size: 40 })}` })}
          <label class="field"><span>Approved wording</span><textarea class="input" name="wording" maxlength="600" rows="4" required>${v.wording}</textarea><small><span id="wc">0</span>/600 characters</small></label>
        </fieldset>
        <fieldset><legend>Where and when</legend>
          <div class="row">
            <label class="field"><span>Screen</span><select class="input" name="screen">${state.meta.screens.map(s => html`<option value="${s.id}" ${v.screen === s.id ? raw('selected') : ''}>${s.name}</option>`)}</select></label>
            <label class="field"><span>Linked event (optional)</span><select class="input" name="eventId"><option value="">None</option>${evOpts.map(e => html`<option value="${e.id}" ${v.eventId === e.id ? raw('selected') : ''}>${D.short(e.start)} · ${e.title}</option>`)}</select></label>
          </div>
          <div class="row">
            <label class="field"><span>Show from</span><input class="input" type="datetime-local" name="displayFrom" value="${v.displayFrom}" required></label>
            <label class="field"><span>Remove at</span><input class="input" type="datetime-local" name="displayUntil" value="${v.displayUntil}" required><small>The message disappears automatically at this time.</small></label>
          </div>
        </fieldset>
        <div class="form-actions">
          ${!m || m.createdBy === state.me.id ? html`<button class="btn" data-mode="submit">Save and submit for approval</button>` : ''}
          <button class="btn ghost" data-mode="save">Save</button>
          <a class="btn plain" href="#/work/messages">Cancel</a>
        </div>
      </form>
      <aside class="preview"><h2>Screen preview</h2><div id="pv"></div><p class="small muted" style="margin-top:10px">Shown full screen on the venue display, with the clock and the next events below.</p></aside>
    </div>`);
  const f = main.querySelector('#mf');
  const read = () => ({ guestName: f.elements.guestName.value, guestTitle: f.elements.guestTitle.value, wording: f.elements.wording.value, screen: f.elements.screen.value, eventId: f.elements.eventId.value || null, photo: f.elements.photo.value || null, displayFrom: f.elements.displayFrom.value.slice(0, 16), displayUntil: f.elements.displayUntil.value.slice(0, 16) });
  const pv = () => {
    const d = read();
    main.querySelector('#wc').textContent = d.wording.length;
    main.querySelector('#pv').innerHTML = String(html`<div class="screen-mini">
      <div class="top"><img src="/assets/uz-crest.png" alt="">University of Zimbabwe</div>
      <div class="mid-row"><div class="mid"><div class="w">Welcome</div><div class="g">${d.guestName || 'Guest name'}</div><div class="x">${d.guestTitle}</div><div class="x" style="margin-top:6px;font-style:italic">${d.wording}</div></div>${d.photo ? html`<img class="mph" src="${d.photo}" alt="">` : ''}</div>
    </div>`);
  };
  f.addEventListener('input', pv); pv();
  wirePhotos(main, pv);
  let mode = 'save';
  f.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; }));
  f.onsubmit = async ev => {
    ev.preventDefault();
    try {
      const res = m ? await api('/api/messages/' + m.id, { method: 'PUT', body: read() }) : await api('/api/messages', { method: 'POST', body: read() });
      if (mode === 'submit' && ['draft', 'returned'].includes(res.message.status)) await api(`/api/messages/${res.message.id}/action`, { method: 'POST', body: { action: 'submit' } });
      toast(mode === 'submit' ? 'Submitted for approval.' : 'Saved.');
      go('#/work/messages');
    } catch (x) { main.querySelector('#err').innerHTML = String(html`<div class="error" role="alert">${x.message}</div>`); }
  };
}

// ---------------- USERS ----------------
export async function users({ el, path }) {
  const { users: list } = await api('/api/users');
  const roleSel = (u) => html`<select class="input" data-role="${u.id}" style="height:34px" ${u.id === state.me.id ? raw('disabled') : ''} aria-label="Role for ${u.name}">${['organiser', 'approver', 'admin'].map(r => html`<option ${u.role === r ? raw('selected') : ''}>${r}</option>`)}</select>`;
  const main = await layout(el, path, html`
    ${head('Users and roles', 'Least privilege: give each person the lowest role they need.')}
    <div class="panel table-wrap"><table class="t"><thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map(u => html`<tr>
        <td class="title"><b>${u.name}</b>${u.id === state.me.id ? html` <span class="small muted">(you)</span>` : ''}<br><span class="small muted">${u.email}</span></td>
        <td>${roleSel(u)}</td>
        <td><select class="input" data-dept="${u.id}" style="height:34px" aria-label="Department for ${u.name}">${state.meta.departments.map(d => html`<option value="${d.id}" ${u.department === d.id ? raw('selected') : ''}>${d.short}</option>`)}</select></td>
        <td>${u.active ? html`<span class="pill published">Active</span>` : html`<span class="pill draft">Deactivated</span>`}</td>
        <td><div class="acts"><button class="btn ghost sm" data-act="reset" data-id="${u.id}">Reset password</button>${u.id !== state.me.id ? html`<button class="btn ${u.active ? 'danger' : ''} sm" data-act="toggle" data-id="${u.id}">${u.active ? 'Deactivate' : 'Reactivate'}</button>` : ''}</div></td>
      </tr>`)}</tbody></table></div>
    <section class="panel"><header><h2>Add a user</h2></header>
      <form class="pad" id="nu">
        <div class="row">
          <label class="field"><span>Full name</span><input class="input" name="name" required></label>
          <label class="field"><span>University email</span><input class="input" name="email" type="email" required></label>
        </div>
        <div class="row">
          <label class="field"><span>Role</span><select class="input" name="role"><option value="organiser">Organiser — submits events</option><option value="approver">Approver — reviews and publishes</option><option value="admin">Administrator — full control</option></select></label>
          <label class="field"><span>Department</span><select class="input" name="department">${state.meta.departments.map(d => html`<option value="${d.id}">${d.name}</option>`)}</select></label>
          <label class="field"><span>Temporary password</span><input class="input" type="password" name="password" minlength="10" autocomplete="new-password" required><small>At least 10 characters.</small></label>
        </div>
        <button class="btn">${icon.plus} Add user</button>
      </form>
    </section>`);
  const upd = async (id, body, msg) => { try { await api('/api/users/' + id, { method: 'PUT', body }); toast(msg); rerender(); } catch (err) { toast(err.message, true); rerender(); } };
  main.querySelectorAll('[data-role]').forEach(s => s.onchange = async () => {
    const u = list.find(x => x.id === s.dataset.role);
    if (!await ask({ title: 'Change role?', text: `${u.name}: ${u.role} → ${s.value}. This is recorded in the audit log.`, confirm: 'Change role' })) { s.value = u.role; return; }
    upd(u.id, { role: s.value }, 'Role updated.');
  });
  main.querySelectorAll('[data-dept]').forEach(s => s.onchange = () => upd(s.dataset.dept, { department: s.value }, 'Department updated.'));
  main.onclick = async ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const u = list.find(x => x.id === b.dataset.id);
    if (b.dataset.act === 'toggle') {
      if (!await ask({ title: `${u.active ? 'Deactivate' : 'Reactivate'} ${u.name}?`, text: u.active ? 'They will be signed out and unable to sign in.' : 'They will be able to sign in again.', confirm: u.active ? 'Deactivate' : 'Reactivate', danger: u.active })) return;
      upd(u.id, { active: !u.active }, u.active ? 'User deactivated.' : 'User reactivated.');
    } else {
      const r = await ask({ title: `Reset password for ${u.name}`, text: 'They will be signed out of all sessions.', fields: [{ name: 'password', type: 'password', label: 'New temporary password (10+ characters)', required: true }], confirm: 'Reset password' });
      if (r) upd(u.id, { password: r.password }, 'Password reset.');
    }
  };
  main.querySelector('#nu').onsubmit = async ev => {
    ev.preventDefault();
    try { await api('/api/users', { method: 'POST', body: Object.fromEntries(new FormData(ev.target)) }); toast('User added.'); rerender(); } catch (err) { toast(err.message, true); }
  };
}

// ---------------- VENUES ----------------
export async function venues({ el, path }) {
  const main = await layout(el, path, html`
    ${head('Venues', 'Venues are used for bookings and clash detection.')}
    <div class="panel table-wrap"><table class="t"><thead><tr><th>Venue</th><th>Location</th><th style="text-align:right">Capacity</th><th></th></tr></thead><tbody>
    ${state.meta.venues.map(v => html`<tr><td class="title"><b>${v.name}</b></td><td class="small">${v.location}</td><td style="text-align:right">${v.capacity.toLocaleString('en-GB')}</td><td><div class="acts"><a class="btn ghost sm" href="#/calendar?view=week&venue=${v.id}">Bookings</a><button class="btn ghost sm" data-id="${v.id}">Edit</button></div></td></tr>`)}
    </tbody></table></div>
    <section class="panel"><header><h2>Add a venue</h2></header>
      <form class="pad" id="nv"><div class="row">
        <label class="field"><span>Name</span><input class="input" name="name" required></label>
        <label class="field"><span>Location</span><input class="input" name="location"></label>
        <label class="field"><span>Capacity</span><input class="input" name="capacity" type="number" min="0"></label>
      </div><button class="btn">${icon.plus} Add venue</button></form>
    </section>`);
  const done = async msg => { const { refreshMeta } = await import('../app.js'); await refreshMeta(); toast(msg); rerender(); };
  main.querySelector('#nv').onsubmit = async ev => {
    ev.preventDefault();
    try { await api('/api/venues', { method: 'POST', body: Object.fromEntries(new FormData(ev.target)) }); done('Venue added.'); } catch (err) { toast(err.message, true); }
  };
  main.onclick = async ev => {
    const b = ev.target.closest('button[data-id]');
    if (!b) return;
    const v = state.meta.venues.find(x => x.id === b.dataset.id);
    const r = await ask({ title: 'Edit venue', confirm: 'Save', fields: [{ name: 'name', label: 'Name', value: v.name, required: true }, { name: 'location', label: 'Location', value: v.location }, { name: 'capacity', label: 'Capacity', type: 'number', value: String(v.capacity) }] });
    if (!r) return;
    try { await api('/api/venues/' + v.id, { method: 'PUT', body: r }); done('Venue updated.'); } catch (err) { toast(err.message, true); }
  };
}

// ---------------- AUDIT ----------------
export async function audit({ el, path, query }) {
  const { audit: list, total } = await api('/api/audit' + qs({ q: query.q }));
  const main = await layout(el, path, html`
    ${head('Audit log', `Every sign-in, submission, decision, change and backup. ${total} entries${query.q ? ' match' : ''}.`)}
    <form id="s" class="search" style="margin:0 0 16px"><input name="q" aria-label="Filter audit log" placeholder="Filter by action, user or record" value="${query.q || ''}"><button class="btn" aria-label="Search">${icon.search}</button></form>
    <div class="panel table-wrap"><table class="t"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Record</th><th>Detail</th></tr></thead><tbody>
    ${list.map(a => html`<tr><td class="small" style="white-space:nowrap">${D.stamp(a.at)}</td><td class="small">${a.user}</td><td><code>${a.action}</code></td><td class="small">${a.target && /^e\d+$/.test(a.target) ? html`<a href="#/event/${a.target}">${a.target}</a>` : a.target}</td><td class="small">${a.detail}</td></tr>`)}
    </tbody></table></div>`);
  main.querySelector('#s').onsubmit = ev => { ev.preventDefault(); go('#/work/audit' + qs({ q: ev.target.q.value })); };
}

// ---------------- BACKUPS ----------------
export async function backups({ el, path }) {
  const { backups: list } = await api('/api/admin/backups');
  const main = await layout(el, path, html`
    ${head('Backups and restore', 'Backups include data and uploaded photos. An automatic backup is taken at start-up and every 24 hours (last 14 kept). A safety copy is always taken before a restore.')}
    <section class="panel"><div class="pad" style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn" id="mk">Create backup now</button>
      <a class="btn ghost" href="/api/admin/export">Download full export (.json)</a>
      <label class="btn ghost" style="cursor:pointer">Restore from file…<input type="file" id="up" accept="application/json,.json" class="sr"></label>
    </div></section>
    <div class="panel table-wrap"><table class="t"><thead><tr><th>Backup</th><th>Size</th><th></th></tr></thead><tbody>
    ${list.length ? list.map(b => html`<tr><td><code>${b.name}</code></td><td class="small">${(b.size / 1024).toFixed(1)} KB</td><td><div class="acts"><button class="btn danger sm" data-name="${b.name}">Restore</button></div></td></tr>`) : html`<tr><td colspan="3" class="muted">No backups yet.</td></tr>`}
    </tbody></table></div>`);
  main.querySelector('#mk').onclick = async () => { try { const r = await api('/api/admin/backups', { method: 'POST', body: {} }); toast('Backup created: ' + r.name); rerender(); } catch (err) { toast(err.message, true); } };
  const restore = async (body, label) => {
    if (!await ask({ title: 'Restore this backup?', text: `Current data and uploaded photos will be replaced with ${label}. A safety copy of the current data is taken first.`, confirm: 'Restore', danger: true })) return;
    try {
      const r = await api('/api/admin/restore', { method: 'POST', body });
      toast(`Restored: ${r.counts.events} events, ${r.counts.users} users. Safety copy ${r.safety}.`);
      const { refreshMe, refreshMeta } = await import('../app.js');
      await Promise.all([refreshMe(), refreshMeta()]);
      if (!state.me) go('#/staff'); else rerender();
    } catch (err) { toast(err.message, true); }
  };
  main.onclick = ev => { const b = ev.target.closest('[data-name]'); if (b) restore({ name: b.dataset.name }, b.dataset.name); };
  main.querySelector('#up').onchange = async ev => {
    const file = ev.target.files[0];
    if (!file) return;
    try { restore({ snapshot: JSON.parse(await file.text()) }, file.name); } catch { toast('That file is not valid JSON.', true); }
  };
}

// ---------------- SITE PHOTOS (admin) ----------------
export async function sitePhotos({ el, path }) {
  const st = state.meta.settings || {};
  const main = await layout(el, path, html`
    ${head('Site photos and address', 'Photographs give the public site its character. Use only approved UZ photography that the university has the right to publish.')}
    <form id="sf">
      <div class="settings-grid">
        <section class="panel"><header><h2>Home page photo</h2></header><div class="pad">
          ${photoField({ name: 'heroImage', value: st.heroImage, label: 'Photo beside the headline', help: 'Landscape, at least 1600px wide. Shown at 4:3 on desktop.', fallback: campusArt() })}
          <label class="field"><span>Describe the photo</span><input class="input" name="heroAlt" maxlength="140" value="${st.heroAlt || ''}" placeholder="e.g. The Great Hall at sunrise"></label>
          <label class="field"><span>Caption</span><input class="input" name="heroCaption" maxlength="140" value="${st.heroCaption || ''}" placeholder="e.g. The Great Hall, Mount Pleasant campus"></label>
        </div></section>
        <section class="panel"><header><h2>Staff sign-in photo</h2></header><div class="pad">
          ${photoField({ name: 'loginImage', value: st.loginImage, label: 'Photo on the sign-in page', help: 'Landscape. Only staff who know the sign-in address see it.', fallback: campusArt() })}
          <label class="field"><span>Describe the photo</span><input class="input" name="loginAlt" maxlength="140" value="${st.loginAlt || ''}"></label>
        </div></section>
      </div>
      <section class="panel"><header><h2>Public web address</h2></header><div class="pad">
        <label class="field"><span>Address used in QR codes on visitor screens</span><input class="input" name="publicUrl" value="${st.publicUrl || ''}" placeholder="https://events.uz.ac.zw"><small>Leave empty to use the address the screen was opened with (${location.origin}).</small></label>
      </div></section>
      <button class="btn">${ico('check')} Save site settings</button>
    </form>`);
  wirePhotos(main);
  main.querySelector('#sf').onsubmit = async ev => {
    ev.preventDefault();
    try {
      await api('/api/settings', { method: 'PUT', body: Object.fromEntries(new FormData(ev.target)) });
      const { refreshMeta } = await import('../app.js');
      await refreshMeta();
      toast('Saved — the public site now uses these photos.');
      rerender();
    } catch (err) { toast(err.message, true); }
  };
}
