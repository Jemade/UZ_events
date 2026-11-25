// Acceptance tests mapped to section 8 of the proposal.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'uzev-'));
const { server } = require('../server');
const T = require('../lib/time');

let base;
test.before(() => new Promise(r => server.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); })));
test.after(() => server.close());

function client() {
  let cookie = '';
  return async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-UZ-Request': '1', ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  };
}
// Event pages are for signed-in members; a student account plays the part of the reader.
const reader = () => login('r2400001@students.uz.ac.zw');
const login = async (email) => { const c = client(); const r = await c('POST', '/api/login', { email, password: 'UZevents2026' }); assert.equal(r.status, 200); return c; };
const day = (n, hm) => T.addDays(T.harareNow().slice(0, 10) + 'T00:00', n).slice(0, 11) + hm;

test('end-to-end submission, approval and publication', async () => {
  const org = await login('organiser.eng@uz.ac.zw');
  const appr = await login('approver.eng@uz.ac.zw');
  const anon = await reader();
  const ev = { title: 'Acceptance Test Lecture', category: 'Academic', departmentId: 'eng', venueId: 'lib', start: day(20, '10:00'), end: day(20, '11:00'), contactName: 'Test', contactEmail: 't@uz.ac.zw', isPublic: true };
  const c = await org('POST', '/api/events', ev);
  assert.equal(c.status, 200);
  const id = c.data.event.id;
  let pub = await anon('GET', `/api/events?from=${day(20, '').slice(0, 10)}&to=${day(20, '').slice(0, 10)}`);
  assert.ok(!pub.data.events.some(e => e.id === id), 'draft must not be public');
  assert.equal((await anon('GET', `/api/events/${id}`)).status, 404, 'draft detail hidden from public');
  assert.equal((await org('POST', `/api/events/${id}/action`, { action: 'submit' })).status, 200);
  assert.equal((await appr('POST', `/api/events/${id}/action`, { action: 'return' })).status, 400, 'return needs a note');
  assert.equal((await appr('POST', `/api/events/${id}/action`, { action: 'return', note: 'Add a summary' })).data.event.status, 'returned');
  await org('PUT', `/api/events/${id}`, { ...ev, summary: 'Now with summary' });
  await org('POST', `/api/events/${id}/action`, { action: 'submit' });
  const ok = await appr('POST', `/api/events/${id}/action`, { action: 'approve' });
  assert.equal(ok.data.event.status, 'published');
  pub = await anon('GET', `/api/events?from=${day(20, '').slice(0, 10)}&to=${day(20, '').slice(0, 10)}`);
  assert.ok(pub.data.events.some(e => e.id === id), 'approved event is public');
  // significant change to a published event needs a note and is recorded publicly
  assert.equal((await appr('PUT', `/api/events/${id}`, { ...ev, venueId: 'gh' })).status, 400);
  const am = await appr('PUT', `/api/events/${id}`, { ...ev, venueId: 'gh', changeNote: 'Moved to a bigger hall' });
  assert.equal(am.status, 200);
  const detail = await anon('GET', `/api/events/${id}`);
  assert.ok(detail.data.event.history.some(h => h.action === 'amended' && h.note === 'Moved to a bigger hall'));
  assert.equal(detail.data.event.createdBy, undefined, 'public sees no internal fields');
});

test('role restrictions are enforced', async () => {
  const anon = await reader();
  const org = await login('organiser.sa@uz.ac.zw');
  const engAppr = await login('approver.eng@uz.ac.zw');
  assert.equal((await anon('POST', '/api/events', {})).status, 401);
  assert.equal((await org('GET', '/api/users')).status, 403);
  assert.equal((await engAppr('GET', '/api/users')).status, 403);
  assert.equal((await org('GET', '/api/stats')).status, 403);
  // organiser cannot submit for another department
  const r = await org('POST', '/api/events', { title: 'Wrong dept', category: 'Academic', departmentId: 'eng', venueId: 'lib', start: day(30, '10:00'), end: day(30, '11:00'), contactName: 'x', contactEmail: 'x@uz.ac.zw' });
  assert.equal(r.status, 403);
  // departmental approver cannot review another department's submission
  const c = await org('POST', '/api/events', { title: 'SA event', category: 'Cultural', departmentId: 'sa', venueId: 'pav', start: day(31, '10:00'), end: day(31, '11:00'), contactName: 'x', contactEmail: 'x@uz.ac.zw' });
  await org('POST', `/api/events/${c.data.event.id}/action`, { action: 'submit' });
  assert.equal((await engAppr('POST', `/api/events/${c.data.event.id}/action`, { action: 'approve' })).status, 403);
  // organiser cannot approve own
  assert.equal((await org('POST', `/api/events/${c.data.event.id}/action`, { action: 'approve' })).status, 403);
  // private events hidden from public
  const anonList = await anon('GET', '/api/events');
  assert.ok(!anonList.data.events.some(e => e.title === 'Senate Meeting'));
  // missing CSRF header rejected
  const res = await fetch(base + '/api/logout', { method: 'POST' });
  assert.equal(res.status, 403);
});

test('venue conflicts are flagged', async () => {
  const org = await login('organiser.eng@uz.ac.zw');
  // Graduation Ceremony is in the Great Hall at day 10 08:00-14:00
  const r = await org('POST', '/api/conflicts', { venueId: 'gh', start: day(10, '13:00'), end: day(10, '15:00') });
  assert.ok(r.data.conflicts.some(c => c.title === 'Graduation Ceremony'));
  const free = await org('POST', '/api/conflicts', { venueId: 'gh', start: day(10, '14:00'), end: day(10, '15:00') });
  assert.equal(free.data.conflicts.length, 0, 'back-to-back bookings are not a clash');
});

test('welcome message approval, display and automatic expiry', async () => {
  const org = await login('organiser.eng@uz.ac.zw');
  const appr = await login('approver.reg@uz.ac.zw');
  const anon = client();
  const now = T.harareNow();
  const m = await org('POST', '/api/messages', { guestName: 'Test Delegation', wording: 'Welcome to UZ, friends.', screen: 'senate', displayFrom: T.addDays(now, -1), displayUntil: T.addDays(now, 1) });
  assert.equal(m.status, 200);
  let d = await anon('GET', '/api/display/senate');
  assert.ok(!d.data.messages.some(x => x.guestName === 'Test Delegation'), 'unapproved message not shown');
  await org('POST', `/api/messages/${m.data.message.id}/action`, { action: 'submit' });
  assert.equal((await org('POST', `/api/messages/${m.data.message.id}/action`, { action: 'approve' })).status, 403);
  await appr('POST', `/api/messages/${m.data.message.id}/action`, { action: 'approve' });
  d = await anon('GET', '/api/display/senate');
  assert.ok(d.data.messages.some(x => x.guestName === 'Test Delegation'), 'approved message shown');
  // expiry: move window into the past
  await appr('PUT', `/api/messages/${m.data.message.id}`, { guestName: 'Test Delegation', wording: 'Welcome to UZ, friends.', screen: 'senate', displayFrom: T.addDays(now, -2), displayUntil: T.addDays(now, -1) });
  d = await anon('GET', '/api/display/senate');
  assert.ok(!d.data.messages.some(x => x.guestName === 'Test Delegation'), 'expired message removed');
});

test('backup and restoration', async () => {
  const admin = await login('admin@uz.ac.zw');
  const b = await admin('POST', '/api/admin/backups', {});
  assert.equal(b.status, 200);
  const before = (await admin('GET', '/api/events?scope=manage')).data.events.length;
  const org = await login('organiser.eng@uz.ac.zw');
  const c = await org('POST', '/api/events', { title: 'Will vanish', category: 'Academic', departmentId: 'eng', venueId: 'hub', start: day(40, '10:00'), end: day(40, '11:00'), contactName: 'x', contactEmail: 'x@uz.ac.zw' });
  await org('POST', `/api/events/${c.data.event.id}/action`, { action: 'submit' });
  await admin('POST', `/api/events/${c.data.event.id}/action`, { action: 'approve' });
  assert.equal((await admin('GET', '/api/events?scope=manage')).data.events.length, before + 1);
  const r = await admin('POST', '/api/admin/restore', { name: b.data.name });
  assert.equal(r.status, 200);
  assert.equal((await admin('GET', '/api/events?scope=manage')).data.events.length, before, 'restore brings data back to the backup point');
  assert.equal((await admin('POST', '/api/admin/restore', { snapshot: { users: [] } })).status, 400, 'invalid snapshot refused');
  const log = await admin('GET', '/api/audit?q=backup.restored');
  assert.ok(log.data.audit.length >= 1, 'restore is audited');
});

test('public visitors and organisers can never reach the admin side', async () => {
  const anon = client();
  const org = await login('organiser.eng@uz.ac.zw');
  const adminGets = ['/api/users', '/api/audit', '/api/admin/backups', '/api/admin/export', '/api/stats', '/api/events?scope=manage', '/api/events?scope=review', '/api/messages'];
  for (const url of adminGets) assert.equal((await anon('GET', url)).status, 401, `anon GET ${url}`);
  for (const url of ['/api/users', '/api/audit', '/api/admin/backups', '/api/admin/export']) assert.equal((await org('GET', url)).status, 403, `organiser GET ${url}`);
  assert.equal((await anon('POST', '/api/admin/restore', { snapshot: {} })).status, 401);
  assert.equal((await org('POST', '/api/admin/restore', { snapshot: {} })).status, 403);
  assert.equal((await org('POST', '/api/users', { name: 'x' })).status, 403);
  // public event data carries no internal fields
  assert.equal((await anon('GET', '/api/events')).status, 401, 'nobody reads events without signing in');
  assert.equal((await anon('GET', '/api/events/e101')).status, 401);
  assert.equal((await anon('GET', '/api/display/senate')).status, 200, 'lobby screens stay open');
  const list = await (await reader())('GET', '/api/events');
  for (const e of list.data.events) {
    for (const k of ['createdBy', 'createdByName', 'reviewNote', 'views', 'canEdit', 'canReview']) assert.equal(e[k], undefined, `${k} leaked`);
  }
  const me = await anon('GET', '/api/me');
  assert.equal(me.data.user, null);
});

test('photo uploads are validated and attach to events and messages; site settings hold the public address', async () => {
  const org = await login('organiser.eng@uz.ac.zw');
  const admin = await login('admin@uz.ac.zw');
  const anon = client();
  // 1x1 PNG
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  assert.equal((await anon('POST', '/api/uploads', { data: png })).status, 401);
  assert.equal((await org('POST', '/api/uploads', { data: 'data:image/png;base64,' + Buffer.from('not an image').toString('base64') })).status, 400, 'fake image refused');
  assert.equal((await org('POST', '/api/uploads', { data: 'data:text/html;base64,PGgxPg==' })).status, 400, 'non-image type refused');
  const up = await org('POST', '/api/uploads', { data: png });
  assert.equal(up.status, 200);
  assert.match(up.data.url, /^\/uploads\/[a-f0-9]{32}\.png$/);
  const img = await fetch(base + up.data.url);
  assert.equal(img.headers.get('content-type'), 'image/png');
  const ev = { title: 'Photo event', category: 'Research', departmentId: 'eng', venueId: 'hub', start: day(50, '10:00'), end: day(50, '11:00'), contactName: 'x', contactEmail: 'x@uz.ac.zw', coverImage: up.data.url, coverAlt: 'A lab' };
  const c = await org('POST', '/api/events', ev);
  assert.equal(c.data.event.coverImage, up.data.url);
  assert.equal((await org('POST', '/api/events', { ...ev, coverImage: '/uploads/../../etc/passwd' })).status, 400, 'arbitrary path refused');
  assert.equal((await org('PUT', '/api/settings', { publicUrl: 'https://x.example' })).status, 403);
  const s = await admin('PUT', '/api/settings', { heroImage: up.data.url, publicUrl: 'https://events.uz.ac.zw/' });
  assert.equal(s.data.settings.publicUrl, 'https://events.uz.ac.zw');
  assert.deepEqual(Object.keys((await anon('GET', '/api/meta')).data.settings), ['publicUrl'], 'no site photos');
  assert.equal((await fetch(base + '/uploads/../server.js')).status, 404);
});

test('photo backups restore missing files and reject unsafe or incomplete bundles', async () => {
  const admin = await login('admin@uz.ac.zw');
  const exported = (await admin('GET', '/api/admin/export')).data;
  assert.equal(exported.version, 2);
  // pick a photo the data actually uses, so removing it from the bundle must be refused
  const d = exported.data;
  const used = [...d.events.map(e => e.coverImage), ...d.messages.map(m => m.photo)].filter(Boolean).map(u => u.slice(9));
  const name = Object.keys(exported.uploads).find(n => used.includes(n));
  assert.ok(name, 'fixture has a photo in use');
  const encoded = exported.uploads[name];
  const file = path.join(process.env.DATA_DIR, 'uploads', name);
  fs.unlinkSync(file);
  assert.equal((await fetch(base + '/uploads/' + name)).status, 404);
  const saved = await admin('POST', '/api/admin/restore', { snapshot: exported });
  assert.equal(saved.status, 200);
  assert.equal(fs.readFileSync(file).toString('base64'), encoded);
  const safety = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR, 'backups', saved.data.safety)));
  assert.equal(safety.version, 2);
  const malicious = structuredClone(exported);
  malicious.uploads['../outside.png'] = encoded;
  assert.equal((await admin('POST', '/api/admin/restore', { snapshot: malicious })).status, 400);
  assert.equal(fs.readFileSync(file).toString('base64'), encoded, 'failed validation leaves photos untouched');
  const missing = structuredClone(exported);
  delete missing.uploads[name];
  assert.equal((await admin('POST', '/api/admin/restore', { snapshot: missing })).status, 400);
  const a = await admin('POST', '/api/admin/backups', {});
  const b = await admin('POST', '/api/admin/backups', {});
  assert.notEqual(a.data.name, b.data.name, 'rapid backups must not overwrite one another');
});

test('updates and email outbox persist decisions and remain private to the owner', async () => {
  const org = await login('organiser.eng@uz.ac.zw');
  const other = await login('organiser.sa@uz.ac.zw');
  const appr = await login('approver.eng@uz.ac.zw');
  const admin = await login('admin@uz.ac.zw');
  const event = (await org('POST', '/api/events', { title: 'Notification test', category: 'Academic', departmentId: 'eng', venueId: 'hub', start: day(60, '10:00'), end: day(60, '11:00'), contactName: 'Test', contactEmail: 't@uz.ac.zw' })).data.event;
  await org('POST', `/api/events/${event.id}/action`, { action: 'submit' });
  await appr('POST', `/api/events/${event.id}/action`, { action: 'return', note: 'Please add a summary.' });
  let updates = (await org('GET', '/api/updates')).data;
  const returned = updates.updates.find(n => n.message.includes('Notification test'));
  assert.ok(returned.message.includes('Please add a summary.'));
  assert.equal(returned.readAt, null);
  assert.ok(!(await other('GET', '/api/updates')).data.updates.some(n => n.id === returned.id));
  await other('POST', '/api/updates/read', { ids: [returned.id] });
  assert.equal((await org('GET', '/api/updates')).data.updates.find(n => n.id === returned.id).readAt, null);
  await org('POST', '/api/updates/read', { ids: [returned.id] });
  assert.ok((await org('GET', '/api/updates')).data.updates.find(n => n.id === returned.id).readAt);
  await org('POST', `/api/events/${event.id}/action`, { action: 'submit' });
  await appr('POST', `/api/events/${event.id}/action`, { action: 'approve' });
  const outbox = (await admin('GET', '/api/admin/outbox')).data;
  assert.equal(outbox.deliveryEnabled, false);
  const mail = outbox.outbox.find(n => n.text.includes('Notification test') && n.text.includes('published'));
  assert.equal(mail.status, 'pending');
  assert.equal(mail.to, 'organiser.eng@uz.ac.zw');
  const disk = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR, 'db.json')));
  assert.ok(disk.outbox.some(n => n.id === mail.id));
  assert.equal((await client()('GET', '/api/updates')).status, 401);
  assert.equal((await client()('GET', '/api/admin/outbox')).status, 401);
  assert.equal((await org('GET', '/api/admin/outbox')).status, 403);
  assert.equal((await org('POST', '/api/updates/read', { ids: 'all' })).status, 400);
});

test('hosting settings validate origins and enable secure cookies for HTTPS', () => {
  const { loadConfig } = require('../lib/config');
  assert.equal(loadConfig({ PUBLIC_URL: 'https://events.example.test', SECURE_COOKIES: '0' }).secureCookies, true);
  assert.equal(loadConfig({ PUBLIC_URL: 'http://localhost:3000' }).secureCookies, false);
  assert.throws(() => loadConfig({ PORT: 'invalid' }));
  assert.throws(() => loadConfig({ PUBLIC_URL: 'https://user:password@example.test' }));
  const configFile = path.join(process.env.DATA_DIR, 'config-test.json');
  fs.writeFileSync(configFile, JSON.stringify({ port: 4000, host: '127.0.0.1', publicUrl: 'https://events.example.test', secureCookies: true }));
  const config = loadConfig({ CONFIG_FILE: configFile, PORT: '5000' });
  assert.equal(config.port, 5000);
  assert.equal(config.secureCookies, true);
});

test('restore rolls photos back when saving the data fails', () => {
  const B = require('../lib/backup');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uzev-rollback-'));
  const uploads = path.join(dir, 'uploads');
  fs.mkdirSync(uploads);
  const name = 'a'.repeat(32) + '.png';
  fs.writeFileSync(path.join(uploads, name), 'original');
  const original = { marker: 'original data' };
  const store = { data: original, replace(data) { this.data = data; throw new Error('disk full'); } };
  assert.throws(() => B.restoreSnapshot({ data: {}, files: new Map([[name, Buffer.from('replacement')]]) }, uploads, store), /disk full/);
  assert.equal(store.data, original);
  assert.equal(fs.readFileSync(path.join(uploads, name), 'utf8'), 'original');
  fs.rmSync(dir, { recursive: true });
});

test('nobody, including administrators, can approve their own submission', async () => {
  const admin = await login('admin@uz.ac.zw');
  const now = T.harareNow();
  const ev = { title: 'Admin Own Event', category: 'Administrative', departmentId: 'reg', venueId: 'lib', start: day(25, '09:00'), end: day(25, '10:00'), contactName: 'Admin', contactEmail: 'a@uz.ac.zw', isPublic: true };
  const c = await admin('POST', '/api/events', ev);
  assert.equal(c.status, 200);
  await admin('POST', `/api/events/${c.data.event.id}/action`, { action: 'submit' });
  assert.equal((await admin('POST', `/api/events/${c.data.event.id}/action`, { action: 'approve' })).status, 403);
  const m = await admin('POST', '/api/messages', { guestName: 'Own Guest', wording: 'Welcome.', screen: 'senate', displayFrom: now, displayUntil: T.addDays(now, 1) });
  await admin('POST', `/api/messages/${m.data.message.id}/action`, { action: 'submit' });
  assert.equal((await admin('POST', `/api/messages/${m.data.message.id}/action`, { action: 'approve' })).status, 403);
  const list = await admin('GET', '/api/messages');
  assert.equal(list.data.messages.find(x => x.id === m.data.message.id).canReview, false);
  const appr = await login('approver.reg@uz.ac.zw');
  assert.equal((await appr('POST', `/api/events/${c.data.event.id}/action`, { action: 'approve' })).data.event.status, 'published');
});

test('changing only the cover photo of a published event is not a public update', async () => {
  const org = await login('organiser.eng@uz.ac.zw');
  const appr = await login('approver.eng@uz.ac.zw');
  const anon = await reader();
  const ev = { title: 'Photo Change Lecture', category: 'Academic', departmentId: 'eng', venueId: 'lib', start: day(30, '10:00'), end: day(30, '11:00'), contactName: 'Test', contactEmail: 't@uz.ac.zw', isPublic: true };
  const id = (await org('POST', '/api/events', ev)).data.event.id;
  await org('POST', `/api/events/${id}/action`, { action: 'submit' });
  assert.equal((await appr('POST', `/api/events/${id}/action`, { action: 'approve' })).data.event.status, 'published');
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const up = await appr('POST', '/api/uploads', { data: png });
  assert.equal(up.status, 200);
  const before = (await anon('GET', `/api/events/${id}`)).data.event.history.length;
  const r = await appr('PUT', `/api/events/${id}`, { ...ev, coverImage: up.data.url, coverAlt: 'A test photo' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const pub = (await anon('GET', `/api/events/${id}`)).data.event;
  assert.equal(pub.coverImage, up.data.url);
  assert.equal(pub.history.length, before, 'photo change is not listed publicly');
  // a real change is still public
  await appr('PUT', `/api/events/${id}`, { ...ev, coverImage: up.data.url, coverAlt: 'A test photo', venueId: 'gh', changeNote: 'Moved' });
  assert.equal((await anon('GET', `/api/events/${id}`)).data.event.history.length, before + 1);
});
