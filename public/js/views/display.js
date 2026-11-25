import { html, raw, api, D, icon } from '../util.js';
import { qrSvg } from '../qr.js';
import { state } from '../app.js';

const publicBase = () => (state.meta.settings && state.meta.settings.publicUrl) || location.origin;

export async function screens({ el }) {
  const data = await Promise.all(state.meta.screens.map(s => api('/api/display/' + s.id)));
  el.innerHTML = String(html`
  <div class="page-head"><div class="wrap">
    <div class="crumbs"><a href="#/">What’s on</a> / Visitor screens</div>
    <h1>Visitor welcome screens</h1>
    <p class="muted" style="margin-top:8px;max-width:70ch">Each reception or venue screen welcomes official guests during their visit, and shows the next events at that venue the rest of the time.</p>
  </div></div>
  <div class="wrap" style="padding-top:26px">
    <div class="screen-list">
      ${data.map(({ screen, messages, upcoming }) => html`<a class="screen-card" href="#/display/${screen.id}">
        <div class="screen-mini">
          <div class="top"><img src="/assets/uz-crest.png" alt="">University of Zimbabwe</div>
          <div class="mid">
            ${messages.length ? html`<div class="w">Welcome</div><div class="g">${messages[0].guestName}</div><div class="x">${messages[0].guestTitle}</div>`
              : html`<div class="w">Welcome</div><div class="g">University of Zimbabwe</div><div class="x">${upcoming[0] ? `Next: ${upcoming[0].title}` : 'No events scheduled'}</div>`}
          </div>
        </div>
        <div class="cap"><b>${screen.name}</b><br><span class="small muted">${messages.length ? `${messages.length} welcome message${messages.length > 1 ? 's' : ''} on screen now` : 'Showing upcoming events'}</span></div>
      </a>`)}
    </div>
    <p class="small muted" style="margin-top:20px">${icon.screen} Open a screen on the venue display and press <b>F</b> for full screen.</p>
  </div>`);
}

const clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Harare', hour: '2-digit', minute: '2-digit', hour12: false });

// Shrink the guest name until it fits on at most two lines.
function fitGuest(root) {
  const g = root.querySelector('.guest');
  if (!g) return;
  let vh = 9;
  g.style.fontSize = vh + 'vh';
  const lineH = () => parseFloat(getComputedStyle(g).lineHeight) || g.offsetHeight;
  while (g.scrollHeight > lineH() * 2.15 && vh > 4.5) { vh -= 0.5; g.style.fontSize = vh + 'vh'; }
}

export async function display({ el, params, onCleanup }) {
  let data = await api('/api/display/' + encodeURIComponent(params.id));
  let idx = 0;
  document.title = `${data.screen.name} · UZ Events display`;

  const stageHtml = () => {
    const m = data.messages.length ? data.messages[idx % data.messages.length] : null;
    return html`
      <div>${m ? html`
        <div class="welcome">Welcome</div>
        <div class="guest">${m.guestName}</div>
        ${m.guestTitle ? html`<div class="gtitle">${m.guestTitle}</div>` : ''}
        <div class="words">${m.wording}</div>`
      : html`
        <div class="welcome">Welcome</div>
        <div class="guest">Welcome to the University of Zimbabwe</div>
        <div class="gtitle">Integrity · Knowledge · Diligence · Innovativeness · Professionalism</div>`}</div>
      ${m && m.photo ? html`<div class="photo"><img src="${m.photo}" alt=""></div>` : ''}`;
  };
  const qrFor = () => {
    const m = data.messages.length ? data.messages[idx % data.messages.length] : null;
    const id = (m && m.eventId) || (data.upcoming[0] && data.upcoming[0].id);
    const url = id ? `${publicBase()}/#/event/${id}` : `${publicBase()}/#/`;
    return html`<div class="qr">${raw(qrSvg(url))}<span>${id ? 'Scan for event details' : 'Scan for what’s on'}</span></div>`;
  };
  const hasPhoto = () => { const m = data.messages[idx % (data.messages.length || 1)]; return !!(m && m.photo); };

  const draw = () => {
    el.innerHTML = String(html`<div class="display">
      <div class="top">
        <div class="uz"><img src="/assets/uz-crest.png" alt="University of Zimbabwe crest"><div><b>University of Zimbabwe</b><span>${data.screen.name}</span></div></div>
        <div class="clock"><b id="clk">${clockFmt.format(new Date())}</b><span>${D.long(data.now)}</span></div>
      </div>
      <h1 class="sr">Welcome screen: ${data.screen.name}</h1>
      <div class="wall" aria-hidden="true"></div>
      <div class="stage ${hasPhoto() ? 'with-photo' : ''}" id="stage">${stageHtml()}</div>
      <div class="bottom">
        <h2>${data.screen.venueId ? 'Next here' : 'On campus'}</h2>
        <div class="next">${data.upcoming.length ? data.upcoming.slice(0, 3).map(u => html`<div><b>${u.start.slice(0, 10) === data.now.slice(0, 10) ? D.time(u.start) : `${D.short(u.start)} ${D.time(u.start)}`}</b>${u.title}${data.screen.venueId ? '' : ` · ${u.venueName}`}</div>`) : html`<div>No further events scheduled this week.</div>`}</div>
        <div class="dots" id="dots"></div>
        <div id="qr">${qrFor()}</div>
      </div>
      <a class="btn ghost sm exit" href="#/screens" style="background:#fff">Exit display</a>
    </div>`);
    drawDots();
    fitGuest(el);
  };
  const drawDots = () => {
    const d = el.querySelector('#dots');
    if (d) d.innerHTML = data.messages.length > 1 ? data.messages.map((_, i) => `<i class="${i === idx % data.messages.length ? 'on' : ''}"></i>`).join('') : '';
  };
  // Crossfade: fade the stage out, swap its content, fade back in.
  let fading = null;
  const swap = () => {
    const st = el.querySelector('#stage');
    if (!st) return draw();
    st.classList.add('out');
    clearTimeout(fading);
    fading = setTimeout(() => {
      st.innerHTML = String(stageHtml());
      st.classList.toggle('with-photo', hasPhoto());
      el.querySelector('#qr').innerHTML = String(qrFor());
      drawDots();
      fitGuest(el);
      st.classList.remove('out');
    }, 600);
  };
  draw();

  const tick = setInterval(() => { const c = document.getElementById('clk'); if (c) c.textContent = clockFmt.format(new Date()); }, 1000);
  const rotate = setInterval(() => { if (data.messages.length > 1) { idx++; swap(); } }, 12000);
  const poll = setInterval(async () => {
    try {
      const fresh = await api('/api/display/' + encodeURIComponent(params.id));
      const changed = JSON.stringify(fresh.messages) !== JSON.stringify(data.messages) || JSON.stringify(fresh.upcoming) !== JSON.stringify(data.upcoming);
      data = fresh;
      if (changed) { idx = 0; draw(); }
    } catch { /* keep showing the last content if the network drops */ }
  }, 30000);
  const onResize = () => fitGuest(el);
  window.addEventListener('resize', onResize);
  const key = e => {
    if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
    }
  };
  document.addEventListener('keydown', key);
  onCleanup(() => { clearInterval(tick); clearInterval(rotate); clearInterval(poll); clearTimeout(fading); window.removeEventListener('resize', onResize); document.removeEventListener('keydown', key); if (document.fullscreenElement) document.exitFullscreen(); });
}
