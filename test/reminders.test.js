// Events for everyone, staff only or students only, and the reminder emails sent at a chosen time.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uzmail-'));
Object.assign(process.env, { DATA_DIR: dir, SEED: 'empty', ADMIN_EMAIL: 'admin@uz.ac.zw', ADMIN_NAME: 'Events Office', ADMIN_PASSWORD: 'admin-pass-123', TRUST_PROXY: '1' });
const { server, mail } = require('../server');
const T = require('../lib/time');
const { mime } = require('../lib/mail');

let base;
test.after(() => server.close());

const call = async (method, url, body, cookie) => {
  const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', 'X-UZ-Request': '1', 'X-Forwarded-For': '192.0.2.44', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => ({})), cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
};
const signIn = async (login, password) => { const r = await call('POST', '/api/login', { login, password }); assert.equal(r.status, 200, r.json.error); return r.cookie; };
const sent = [];
const reminders = () => sent.filter(m => m.subject.startsWith('Reminder:'));
const people = {};

test.before(async () => {
  await new Promise(r => server.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); }));
  const pw = 'long-enough-pass';
  await call('POST', '/api/signup', { name: 'Student One', email: 'r2400101@students.uz.ac.zw', department: 'ict', password: pw });
  await call('POST', '/api/signup', { name: 'Staff Waiting', email: 'staff.waiting@example.com', department: 'art', password: pw });
  people.admin = await signIn('admin@uz.ac.zw', 'admin-pass-123');
  await call('POST', '/api/users', { name: 'Org One', email: 'org.one@example.com', role: 'organiser', department: 'ict', password: pw }, people.admin);
  people.org = await signIn('org.one@example.com', pw);
  people.student = await signIn('r2400101', pw);
  people.staff = await signIn('staff.waiting@example.com', pw);
  mail.useMailer(async (_cfg, msg) => { sent.push(msg); return { id: 'x' }; });
});

const day = n => T.addDays(T.harareNow().slice(0, 10) + 'T00:00', n).slice(0, 10);
async function publish(fields) {
  const r = await call('POST', '/api/events', { category: 'Academic', departmentId: 'ict', venueId: 'gh', start: `${day(3)}T10:00`, end: `${day(3)}T12:00`,
    contactName: 'Org One', contactEmail: 'org.one@example.com', ...fields }, people.org);
  assert.equal(r.status, 200, r.json.error);
  assert.equal((await call('POST', `/api/events/${r.json.event.id}/action`, { action: 'submit' }, people.org)).status, 200);
  assert.equal((await call('POST', `/api/events/${r.json.event.id}/action`, { action: 'approve' }, people.admin)).status, 200);
  return r.json.event.id;
}
const past = () => T.addDays(T.harareNow(), -1).slice(0, 16);

test('a reminder must come before the event', async () => {
  const r = await call('POST', '/api/events', { title: 'Late reminder', category: 'Academic', departmentId: 'ict', venueId: 'gh', start: `${day(3)}T10:00`, end: `${day(3)}T12:00`, contactName: 'x', contactEmail: 'x@uz.ac.zw', remindAt: `${day(3)}T11:00` }, people.org);
  assert.equal(r.status, 400);
});

test('staff-only events are hidden from students and their reminders go to staff only', async () => {
  const id = await publish({ title: 'Staff Meeting', audienceGroup: 'staff', remindAt: past() });
  assert.equal((await call('GET', `/api/events/${id}`, null, people.student)).status, 404, 'students cannot open it');
  assert.equal((await call('GET', `/api/events/${id}`, null, people.staff)).status, 200, 'staff can');
  sent.length = 0;
  const queued = mail.runReminders();
  assert.equal(queued, 3, 'admin, organiser and the staff member');
  assert.equal(mail.runReminders(), 0, 'sent once only');
  await mail.deliver();
  assert.ok(sent.some(m => m.subject === 'UZ Events: published' && m.to === 'org.one@example.com'), 'the organiser is emailed that it was published');
  const to = reminders().map(m => m.to).sort();
  assert.deepEqual(to, ['admin@uz.ac.zw', 'org.one@example.com', 'staff.waiting@example.com']);
  const r = reminders()[0];
  assert.match(r.subject, /^Reminder: Staff Meeting/);
  assert.match(r.text, /Great Hall/);
  assert.match(r.text, /google\.com\/maps\/dir\/.*destination=-17\.78/, 'directions link');
});

test('students-only events reach students, and people can turn reminders off', async () => {
  assert.equal((await call('PUT', '/api/me', { emailReminders: false }, people.org)).json.user.emailReminders, false);
  const id = await publish({ title: 'Freshers Welcome', audienceGroup: 'students', remindAt: past() });
  assert.equal((await call('GET', `/api/events/${id}`, null, people.staff)).status, 404, 'staff without a role do not see student events');
  assert.equal((await call('GET', `/api/events/${id}`, null, people.student)).status, 200);
  sent.length = 0;
  mail.runReminders();
  await mail.deliver();
  assert.deepEqual(reminders().map(m => m.to).sort(), ['admin@uz.ac.zw', 'r2400101@students.uz.ac.zw'], 'student and admin; the organiser turned reminders off');
});

test('an event for everyone reminds everyone, and a failed send is retried', async () => {
  await call('PUT', '/api/me', { emailReminders: true }, people.org);
  await publish({ title: 'Open Day', audienceGroup: 'everyone', remindAt: past() });
  let fail = true;
  sent.length = 0;
  mail.useMailer(async (_c, msg) => { if (fail && msg.to.startsWith('r24')) throw new Error('temporary'); sent.push(msg); });
  assert.equal(mail.runReminders(), 4);
  await mail.deliver();
  assert.equal(reminders().length, 3, 'one failed');
  const outbox = (await call('GET', '/api/admin/outbox', null, people.admin)).json;
  const failed = outbox.outbox.find(o => o.to.startsWith('r24') && o.subject.includes('Open Day'));
  assert.equal(failed.status, 'pending');
  assert.equal(failed.attempts, 1);
  assert.ok(failed.nextAt, 'retried later');
});

test('emails are built safely', () => {
  const m = mime({ sender: 'events@example.com' }, { to: 'a@b.com\r\nBcc: evil@x.com', subject: 'Reminder: Café\nBcc: x', text: 'Hi' });
  assert.ok(!/\r\nBcc:/i.test(m), 'no header injection');
  assert.match(m, /Subject: =\?UTF-8\?B\?/);
});

test('only administrators can see the outbox or send a test email', async () => {
  assert.equal((await call('GET', '/api/admin/outbox', null, people.org)).status, 403);
  assert.equal((await call('POST', '/api/admin/test-email', {}, people.student)).status, 401);
  const t = await call('POST', '/api/admin/test-email', {}, people.admin);
  assert.equal(t.status, 200, t.json.error);
});
