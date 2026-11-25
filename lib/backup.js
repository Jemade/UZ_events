'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FILE = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
const MAX_BYTES = 100 * 1024 * 1024;
function validData(d) {
  return d && typeof d === 'object' &&
    ['users', 'events', 'messages', 'departments', 'venues', 'screens', 'categories', 'audit'].every(k => Array.isArray(d[k])) &&
    d.users.some(u => u && u.role === 'admin' && u.active && u.salt && u.hash) &&
    ['notifications', 'outbox'].every(k => d[k] === undefined || Array.isArray(d[k]));
}
function createSnapshot(data, dir) {
  const uploads = {};
  for (const entry of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
    if (!entry.isFile() || !FILE.test(entry.name)) throw new Error('Unexpected file in uploads: ' + entry.name);
    uploads[entry.name] = fs.readFileSync(path.join(dir, entry.name)).toString('base64');
  }
  const snapshot = { format: 'uz-events', version: 2, createdAt: new Date().toISOString(), data, uploads };
  if (Buffer.byteLength(JSON.stringify(snapshot)) > MAX_BYTES) throw new Error('Backup exceeds 100 MiB; archive the data directory with the server stopped.');
  return snapshot;
}
function decodeSnapshot(snapshot, dir) {
  const bundled = snapshot && snapshot.format === 'uz-events';
  if (bundled && snapshot.version !== 2) throw new Error('Unsupported backup version.');
  const data = bundled ? snapshot.data : snapshot;
  if (!validData(data)) throw new Error('Invalid backup data or missing active administrator.');
  let files = null;
  if (bundled) {
    if (!snapshot.uploads || typeof snapshot.uploads !== 'object' || Array.isArray(snapshot.uploads)) throw new Error('Missing backup photos.');
    files = new Map();
    for (const [name, encoded] of Object.entries(snapshot.uploads)) {
      if (!FILE.test(name) || typeof encoded !== 'string' || encoded.length > 4 * 1024 * 1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new Error('Invalid backup photo.');
      const bytes = Buffer.from(encoded, 'base64');
      if (!bytes.length || bytes.toString('base64') !== encoded) throw new Error('Invalid photo encoding.');
      files.set(name, bytes);
    }
  }
  const refs = [...Object.entries(data.settings || {}).filter(([k]) => k.endsWith('Image')).map(([, v]) => v), ...data.events.map(e => e.coverImage), ...data.messages.map(m => m.photo)].filter(Boolean);
  for (const ref of refs) {
    if (typeof ref !== 'string' || !ref.startsWith('/uploads/') || !FILE.test(ref.slice(9))) throw new Error('Invalid photo reference.');
    if (files ? !files.has(ref.slice(9)) : !fs.existsSync(path.join(dir, ref.slice(9)))) throw new Error('Backup is missing a referenced photo. Older backups require the original uploads folder.');
  }
  return { data, files };
}
// Stage all photos before touching the active folder; roll back on a failed data write.
function restoreSnapshot(decoded, dir, store) {
  const oldData = store.data;
  if (!decoded.files) {
    try { store.replace(decoded.data); } catch (error) { store.data = oldData; throw error; }
    return;
  }
  const suffix = crypto.randomUUID();
  const staged = dir + '.staged-' + suffix, previous = dir + '.previous-' + suffix;
  fs.mkdirSync(staged, { recursive: true });
  let moved = false, installed = false;
  try {
    for (const [name, bytes] of decoded.files) fs.writeFileSync(path.join(staged, name), bytes, { flag: 'wx' });
    if (fs.existsSync(dir)) { fs.renameSync(dir, previous); moved = true; }
    fs.renameSync(staged, dir); installed = true;
    store.replace(decoded.data);
  } catch (error) {
    store.data = oldData;
    if (installed) fs.rmSync(dir, { recursive: true, force: true });
    if (moved) fs.renameSync(previous, dir);
    throw error;
  } finally {
    fs.rmSync(staged, { recursive: true, force: true });
  }
  // A leftover previous directory is safe if cleanup fails; never roll back committed data.
  try { fs.rmSync(previous, { recursive: true, force: true }); } catch (error) { console.error('Old upload directory cleanup failed:', error.message); }
}
module.exports = { createSnapshot, decodeSnapshot, restoreSnapshot, MAX_BYTES };
