'use strict';
const fs = require('fs');
const path = require('path');

function loadConfig(env = process.env) {
  const file = env.CONFIG_FILE || path.join(__dirname, '..', 'config.local.json');
  const values = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  if (env.CONFIG_FILE && !fs.existsSync(file)) throw new Error('CONFIG_FILE does not exist.');
  const port = Number(env.PORT ?? values.port ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port.');
  // On Render, RENDER_EXTERNAL_URL is the service's own https address.
  const publicUrl = String(env.PUBLIC_URL ?? values.publicUrl ?? env.RENDER_EXTERNAL_URL ?? '').replace(/\/+$/, '');
  if (publicUrl) {
    const url = new URL(publicUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Public URL must be an HTTP(S) origin.');
  }
  const secureSetting = env.SECURE_COOKIES ?? values.secureCookies ?? false;
  if (![true, false, '1', '0'].includes(secureSetting)) throw new Error('secureCookies must be a boolean (SECURE_COOKIES: 1 or 0).');
  const seedMode = String(env.SEED ?? values.seed ?? 'sample');
  if (!['sample', 'empty'].includes(seedMode)) throw new Error('SEED must be "sample" or "empty".');
  return { port, host: env.HOST ?? values.host ?? (env.RENDER ? '0.0.0.0' : '127.0.0.1'),
    seedMode, adminEmail: env.ADMIN_EMAIL, adminName: env.ADMIN_NAME, adminPassword: env.ADMIN_PASSWORD,
    // Behind a hosting proxy (Render), the visitor's address is the first X-Forwarded-For entry.
    trustProxy: env.TRUST_PROXY === '1' || !!env.RENDER,
    dataDir: path.resolve(env.DATA_DIR ?? values.dataDir ?? path.join(__dirname, '..', 'data')),
    publicUrl, secureCookies: publicUrl.startsWith('https:') || secureSetting === true || secureSetting === '1' };
}
module.exports = { loadConfig };
