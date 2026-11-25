// Student and staff accounts: self sign-up, sign-in by registration number or email, and role-based access.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uzacct-'));
Object.assign(process.env, { DATA_DIR: dir, SEED: 'empty', ADMIN_EMAIL: 'admin@uz.ac.zw', ADMIN_NAME: 'Events Office', ADMIN_PASSWORD: 'admin-pass-123', TRUST_PROXY: '1' });
const { server } = require('../server');

let base;
test.before(() => new Promise(r => server.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); })));
test.after(() => server.close());

const call = async (method, url, body, cookie) => {
  const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', 'X-UZ-Request': '1', 'X-Forwarded-For': '192.0.2.10', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
};
const signIn = async (login, password) => {
  const r = await call('POST', '/api/login', { login, password });
  assert.equal(r.status, 200, `sign in as ${login}: ${r.json.error}`);
  return r.cookie;
};
const student = { name: 'Jayden Mapasure', email: 'r2420211@students.uz.ac.zw', department: 'ict', password: 'student-pass-1', confirm: 'student-pass-1' };

test('student sign-up checks the registration number against the student email', async () => {
  const wrongDomain = await call('POST', '/api/signup', { ...student, regNumber: 'R2420211', email: 'r2420211@gmail.com' });
  assert.equal(wrongDomain.json.user?.role, 'staff', 'a non-student email makes a staff account, never a student one');
  const otherNumber = await call('POST', '/api/signup', { ...student, regNumber: 'R2420211', email: 'r2420999@students.uz.ac.zw' });
  assert.equal(otherNumber.status, 400, 'a registration number, when given, must match the email');
  assert.equal((await call('POST', '/api/signup', { ...student, email: 'jayden@students.uz.ac.zw' })).status, 400, 'student emails start with the registration number');
  assert.equal((await call('POST', '/api/signup', { ...student, website: 'http://spam' })).status, 400, 'bots that fill the hidden field are refused');
  assert.equal((await call('POST', '/api/signup', { ...student, confirm: 'different-pass' })).status, 400);

  const ok = await call('POST', '/api/signup', { ...student, email: 'R2420211@Students.UZ.ac.zw' }); // no student/staff choice: the email decides
  assert.equal(ok.status, 200, ok.json.error);
  assert.equal(ok.json.user.regNumber, 'R2420211');
  assert.equal(ok.json.user.role, 'student');
  assert.equal((await call('POST', '/api/signup', { ...student })).status, 400, 'one account per registration number');
});

test('students sign in with their registration number in any case and only see student screens', async () => {
  const lower = await signIn('r2420211', student.password);
  await signIn('R2420211', student.password);
  await signIn('r2420211@students.uz.ac.zw', student.password);
  assert.equal((await call('POST', '/api/login', { login: 'R2420211', password: 'wrong-password' })).json.error, 'Username or password is incorrect.');

  const me = await call('GET', '/api/me', null, lower);
  assert.equal(me.json.user.role, 'student');
  assert.equal(me.json.user.regNumber, 'R2420211');
  // no workspace, no administration
  assert.equal((await call('GET', '/api/events?scope=mine', null, lower)).status, 401);
  assert.equal((await call('POST', '/api/events', { title: 'Party' }, lower)).status, 401);
  assert.equal((await call('GET', '/api/users', null, lower)).status, 401);
  assert.equal((await call('GET', '/api/updates', null, lower)).status, 401);
});

test('staff sign up with their own email, wait for a role, and get the workspace once the admin gives one', async () => {
  const made = await call('POST', '/api/signup', { name: 'Nyasha Madoro', email: 'Nyasha.Madoro@gmail.com', department: 'ict', password: 'staff-pass-12' });
  assert.equal(made.status, 200, made.json.error);
  assert.equal(made.json.user.role, 'staff');

  const staff = await signIn('nyasha.madoro@gmail.com', 'staff-pass-12');
  assert.equal((await call('GET', '/api/me', null, staff)).json.user.role, 'staff');
  assert.equal((await call('GET', '/api/events?scope=mine', null, staff)).status, 401, 'no workspace before a role is given');

  const admin = await signIn('admin@uz.ac.zw', 'admin-pass-123');
  const updates = await call('GET', '/api/updates', null, admin);
  assert.ok(updates.json.updates.some(n => /Nyasha Madoro .* waiting for a role/.test(n.message)), 'the administrator is told');
  const list = (await call('GET', '/api/users', null, admin)).json.users;
  const target = list.find(x => x.email === 'nyasha.madoro@gmail.com');
  const stud = list.find(x => x.regNumber === 'R2420211');
  assert.equal((await call('PUT', '/api/users/' + stud.id, { role: 'organiser' }, admin)).status, 400, 'students keep the student role');
  assert.equal((await call('PUT', '/api/users/' + target.id, { role: 'organiser' }, admin)).status, 200);

  // the same session now has the organiser workspace
  assert.equal((await call('GET', '/api/events?scope=mine', null, staff)).status, 200);
  assert.equal((await call('GET', '/api/users', null, staff)).status, 403);
});

test('signed-in students can save events to My events', async () => {
  const admin = await signIn('admin@uz.ac.zw', 'admin-pass-123');
  const organiser = await signIn('nyasha.madoro@gmail.com', 'staff-pass-12');
  const draft = await call('POST', '/api/events', { title: 'Computing Society Hackathon', category: 'Academic', departmentId: 'ict', venueId: 'hub',
    start: '2026-12-10T09:00', end: '2026-12-10T17:00', audience: 'Students', contactName: 'Nyasha Madoro', contactEmail: 'nyasha.madoro@gmail.com',
    description: 'A day of building software in teams.', isPublic: true }, organiser);
  assert.equal(draft.status, 200, draft.json.error);
  const id = draft.json.event.id;
  assert.equal((await call('POST', `/api/events/${id}/action`, { action: 'submit' }, organiser)).status, 200);
  const st = await signIn('r2420211', student.password);
  assert.equal((await call('POST', '/api/me/saved', { eventId: id, saved: true }, st)).status, 404, 'unpublished events cannot be saved');
  assert.equal((await call('POST', `/api/events/${id}/action`, { action: 'approve' }, admin)).status, 200);
  const saved = await call('POST', '/api/me/saved', { eventId: id, saved: true }, st);
  assert.deepEqual(saved.json.saved, [id]);
  assert.deepEqual((await call('GET', '/api/me', null, st)).json.user.saved, [id]);
  assert.equal((await call('POST', '/api/me/saved', { eventId: id, saved: true })).status, 401);
});
