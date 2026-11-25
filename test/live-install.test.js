// A live (Render) installation: empty start, admin from settings, bundled photos, proxy-aware sign-in.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uzlive-'));
Object.assign(process.env, { DATA_DIR: dir, SEED: 'empty', ADMIN_EMAIL: 'Events.Admin@uz.ac.zw', ADMIN_NAME: 'Events Office', ADMIN_PASSWORD: 'a-long-test-pass', TRUST_PROXY: '1', RENDER_EXTERNAL_URL: 'https://uz-events.onrender.com' });
const { server } = require('../server');

let base;
test.before(() => new Promise(r => server.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); })));
test.after(() => server.close());
const post = (url, body, headers = {}) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-UZ-Request': '1', ...headers }, body: JSON.stringify(body) });

test('a new live installation starts empty with one administrator and the bundled photos', async () => {
  const meta = await (await fetch(base + '/api/meta')).json();
  assert.equal(meta.venues.length, 8);
  assert.equal(meta.departments.length, 12);
  assert.match(meta.settings.heroImage, /^\/uploads\/[a-f0-9]{32}\.jpg$/);
  assert.match(meta.settings.heroCaption, /Star FM/);
  assert.match(meta.settings.loginImage, /^\/uploads\/[a-f0-9]{32}\.jpg$/);
  assert.equal(meta.settings.publicUrl, 'https://uz-events.onrender.com', 'QR codes use the Render address');
  assert.equal((await fetch(base + meta.settings.heroImage)).status, 200);
  assert.equal((await fetch(base + '/api/events')).status, 401, 'events need an account');
  // the sample accounts do not exist here
  assert.equal((await post('/api/login', { email: 'admin@uz.ac.zw', password: 'UZevents2026' })).status, 401);
  const ok = await post('/api/login', { email: 'events.admin@uz.ac.zw', password: 'a-long-test-pass' });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('set-cookie'), /; Secure/, 'cookies are Secure on https');
  assert.equal((await ok.json()).user.role, 'admin');
  const events = await (await fetch(base + '/api/events?from=2000-01-01&to=2100-01-01', { headers: { Cookie: ok.headers.get('set-cookie').split(';')[0] } })).json();
  assert.equal(events.events.length, 0);
});

test('sign-in throttling counts each visitor separately behind the proxy', async () => {
  for (let i = 0; i < 8; i++) await post('/api/login', { email: 'events.admin@uz.ac.zw', password: 'wrong' }, { 'X-Forwarded-For': '203.0.113.7' });
  assert.equal((await post('/api/login', { email: 'events.admin@uz.ac.zw', password: 'a-long-test-pass' }, { 'X-Forwarded-For': '203.0.113.7' })).status, 429);
  assert.equal((await post('/api/login', { email: 'events.admin@uz.ac.zw', password: 'a-long-test-pass' }, { 'X-Forwarded-For': '198.51.100.9' })).status, 200);
});
