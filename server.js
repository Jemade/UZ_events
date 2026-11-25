// UZ Events: School Events Management Web System
// Zero-dependency Node.js server: static frontend + JSON API.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Store } = require('./lib/store');
const { seed, seedEmpty } = require('./lib/seed');
const crypto = require('crypto');
const A = require('./lib/auth');
const T = require('./lib/time');

const config = require('./lib/config').loadConfig();
const B = require('./lib/backup');
const PORT = config.port;
const DATA_DIR = config.dataDir;
const PUBLIC_DIR = path.join(__dirname, 'public');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const UPLOAD_RE = /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/;
const SECURE_COOKIES = config.secureCookies;

const store = new Store(path.join(DATA_DIR, 'db.json'));
let freshInstall = false;
let db = store.load(() => { freshInstall = true; return config.seedMode === 'empty' ? seedEmpty(config) : seed(); });
// One photo per page. Manifest key in seed-photos/photos.json -> settings prefix (<prefix>Image, <prefix>Alt).
const PAGE_PHOTOS = { home: 'hero', signIn: 'login', staffSignIn: 'staffLogin', signUp: 'signup', myEvents: 'me', archive: 'archive', workspace: 'work' };
const PAGE_PHOTO_LABELS = { hero: 'Home page photo', login: 'Student sign-in photo', staffLogin: 'Staff sign-in photo', signup: 'Create account photo', me: 'My events photo', archive: 'Archive photo', work: 'Workspace photo' };
const DEFAULT_SETTINGS = { heroCaption: '', publicUrl: '', ...Object.fromEntries(Object.values(PAGE_PHOTOS).flatMap(k => [[k + 'Image', null], [k + 'Alt', '']])) };
// Page photos an existing installation has never had (added in a later version); they are filled from seed-photos below.
const missingPhotos = Object.keys(PAGE_PHOTOS).filter(k => !(PAGE_PHOTOS[k] + 'Image' in (db.settings || {})));
function ensureSettings() {
  db.settings = { ...DEFAULT_SETTINGS, ...(db.settings || {}) };
  if (config.publicUrl) db.settings.publicUrl = config.publicUrl;
  db.notifications ||= [];
  db.outbox ||= [];
}
ensureSettings();
// A new installation gets the home and sign-in photos that ship with the code (seed-photos/).
// They are copied into the uploads folder like any upload, so admins can replace them under Site photos.
if (freshInstall) installBundledPhotos(Object.keys(PAGE_PHOTOS));
else if (missingPhotos.length) installBundledPhotos(missingPhotos);
function installBundledPhotos(only) {
  const dir = path.join(__dirname, 'seed-photos');
  const manifest = path.join(dir, 'photos.json');
  if (!fs.existsSync(manifest)) return;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const put = file => {
    const bytes = fs.readFileSync(path.join(dir, path.basename(file)));
    const name = crypto.createHash('md5').update(bytes).digest('hex') + '.jpg';
    fs.writeFileSync(path.join(UPLOAD_DIR, name), bytes);
    return '/uploads/' + name;
  };
  const m = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  for (const key of only) {
    const entry = m[key], prefix = PAGE_PHOTOS[key];
    if (!entry || !prefix) continue;
    Object.assign(db.settings, { [prefix + 'Image']: put(entry.file), [prefix + 'Alt']: entry.alt || '' });
    if (key === 'home') db.settings.heroCaption = entry.caption || '';
  }
  store.save();
}
let saveTimer = null;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.save(), 1500);
}

// ---------- helpers ----------
class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}
const bad = (msg, extra) => new HttpError(400, msg, extra);
const forbidden = (msg = 'You do not have permission to do that.') => new HttpError(403, msg);
const notFound = (msg = 'Not found.') => new HttpError(404, msg);

function send(res, status, body, headers = {}) {
  const isStr = typeof body === 'string' || Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isStr ? (headers['Content-Type'] || 'text/plain; charset=utf-8') : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(isStr ? body : JSON.stringify(body));
}

function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Request too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(bad('Invalid JSON body.')); }
    });
    req.on('error', reject);
  });
}

function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function currentUser(req) {
  const s = A.getSession(cookies(req).uzsid);
  if (!s) return null;
  const u = db.users.find(x => x.id === s.userId && x.active);
  return u || null;
}

function audit(user, action, target, detail = '') {
  db.audit.push({ at: T.harareNow(), userId: user ? user.id : null, action, target, detail });
  if (db.audit.length > 5000) db.audit.splice(0, db.audit.length - 5000);
}

const userName = id => (db.users.find(u => u.id === id) || {}).name || 'Unknown user';
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, department: u.department, active: u.active, createdAt: u.createdAt,
  regNumber: u.regNumber ? u.regNumber.toUpperCase() : undefined, saved: u.saved || [] });
// Students sign in with their registration number (any case, e.g. r2420211 or R2420211);
// their email must be that number at the student domain, e.g. r2420211@students.uz.ac.zw.
const STUDENT_DOMAIN = 'students.uz.ac.zw';
const REG_NUMBER = /^r\d{6,8}[a-z]?$/;
const normReg = v => String(v || '').trim().toLowerCase();

function str(v, field, { min = 0, max = 200, required = false } = {}) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') throw bad(`${field} must be text.`);
  v = v.trim();
  if (required && !v) throw bad(`${field} is required.`);
  if (v && v.length < min) throw bad(`${field} must be at least ${min} characters.`);
  if (v.length > max) throw bad(`${field} must be at most ${max} characters.`);
  return v;
}
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

// ---------- permissions ----------
const isCentral = u => u && (u.role === 'admin' || (u.role === 'approver' && u.department === 'reg'));
function canReview(u, e) {
  if (!u) return false;
  if (u.role === 'admin') return true;
  return u.role === 'approver' && (u.department === 'reg' || u.department === e.departmentId);
}
const LIVE = ['published', 'postponed', 'cancelled'];
function canView(u, e) {
  // Internal (non-public) events are for staff accounts only; students see the open events.
  if (LIVE.includes(e.status)) return e.isPublic || (!!u && u.role !== 'student');
  return !!u && (e.createdBy === u.id || canReview(u, e));
}

// ---------- recurrence & conflicts ----------
function occurrences(e, fromDay, toDay) {
  // fromDay/toDay: 'YYYY-MM-DD' inclusive bounds
  const out = [];
  const dur = T.minutesBetween(e.start, e.end);
  const step = e.recurrence && e.recurrence.freq !== 'none' ? e.recurrence.freq : null;
  const until = step ? (e.recurrence.until || e.start) : e.start;
  let s = e.start, i = 0;
  while (s <= until && i < 400) {
    const end = T.fmt(new Date(T.parse(s).getTime() + dur * 60000));
    if ((!toDay || s.slice(0, 10) <= toDay) && (!fromDay || end.slice(0, 10) >= fromDay)) out.push({ start: s, end, index: i });
    if (toDay && s.slice(0, 10) > toDay) break;
    if (!step) break;
    i++;
    s = step === 'weekly' ? T.addDays(e.start, 7 * i) : T.addMonths(e.start, i);
  }
  return out;
}

function findConflicts(cand, excludeId) {
  if (!cand.venueId || !T.isValid(cand.start) || !T.isValid(cand.end)) return [];
  const mine = occurrences(cand);
  if (!mine.length) return [];
  const from = mine[0].start.slice(0, 10), to = mine[mine.length - 1].end.slice(0, 10);
  const out = [];
  for (const o of db.events) {
    if (o.id === excludeId || o.venueId !== cand.venueId) continue;
    if (!['submitted', 'published', 'postponed'].includes(o.status)) continue;
    for (const b of occurrences(o, from, to)) {
      const hit = mine.find(a => a.start < b.end && b.start < a.end);
      if (hit) { out.push({ id: o.id, title: o.title, status: o.status, start: b.start, end: b.end }); break; }
    }
  }
  return out;
}

// ---------- serialisers ----------
const PUBLIC_ACTIONS = ['amended', 'rescheduled', 'postponed', 'cancelled', 'reinstated'];
function eventOut(e, u, extra = {}) {
  const dept = db.departments.find(d => d.id === e.departmentId);
  const venue = db.venues.find(v => v.id === e.venueId);
  const staff = !!u;
  const o = {
    id: e.id, title: e.title, summary: e.summary, description: e.description, category: e.category,
    departmentId: e.departmentId, departmentName: dept ? dept.name : '', departmentShort: dept ? dept.short : '',
    venueId: e.venueId, venueName: venue ? venue.name : '', venueLocation: venue ? venue.location : '',
    start: e.start, end: e.end, audience: e.audience, contactName: e.contactName, contactEmail: e.contactEmail,
    isPublic: e.isPublic, recurrence: e.recurrence, status: e.status, updatedAt: e.updatedAt,
    coverImage: e.coverImage || null, coverAlt: e.coverAlt || '',
    history: e.history
      .filter(h => staff || PUBLIC_ACTIONS.includes(h.action))
      .map(h => ({ at: h.at, action: h.action, note: h.note || '', by: staff ? userName(h.by) : undefined, changes: h.changes })),
    ...extra,
  };
  if (staff) {
    Object.assign(o, {
      createdBy: e.createdBy, createdByName: userName(e.createdBy), createdAt: e.createdAt,
      submittedAt: e.submittedAt, decidedAt: e.decidedAt, reviewNote: e.reviewNote, views: e.views,
      canEdit: canEdit(u, e), canReview: canReview(u, e),
    });
  }
  return o;
}

function canEdit(u, e) {
  if (!u) return false;
  if (['draft', 'returned'].includes(e.status) && e.createdBy === u.id) return true;
  return canReview(u, e) && !['rejected', 'cancelled'].includes(e.status);
}

function msgState(m, now = T.harareNow()) {
  if (m.status !== 'approved') return m.status;
  if (now >= m.displayUntil) return 'expired';
  if (now < m.displayFrom) return 'scheduled';
  return 'live';
}
function messageOut(m, u) {
  const ev = db.events.find(e => e.id === m.eventId);
  const sc = db.screens.find(s => s.id === m.screen);
  return {
    ...m, state: msgState(m), eventTitle: ev ? ev.title : '', screenName: sc ? sc.name : m.screen,
    createdByName: userName(m.createdBy),
    history: m.history.map(h => ({ ...h, by: userName(h.by) })),
    canEdit: !!u && ((['draft', 'returned'].includes(m.status) && m.createdBy === u.id) || (A.atLeast(u, 'approver') && m.status !== 'withdrawn')),
    canReview: !!u && A.atLeast(u, 'approver') && m.createdBy !== u.id,
  };
}

// ---------- validation ----------
function validateEvent(b, u) {
  const e = {
    title: str(b.title, 'Title', { min: 3, max: 140, required: true }),
    summary: str(b.summary, 'Summary', { max: 280 }),
    description: str(b.description, 'Description', { max: 5000 }),
    audience: str(b.audience, 'Audience', { max: 140 }) || 'Open to all',
    contactName: str(b.contactName, 'Contact name', { max: 100, required: true }),
    contactEmail: str(b.contactEmail, 'Contact email', { max: 120, required: true }),
    isPublic: b.isPublic !== false,
  };
  if (!EMAIL.test(e.contactEmail)) throw bad('Contact email is not a valid address.');
  if (!db.categories.includes(b.category)) throw bad('Choose a valid category.');
  e.category = b.category;
  if (!db.departments.some(d => d.id === b.departmentId)) throw bad('Choose a valid department.');
  if (u.role !== 'admin' && !isCentral(u) && b.departmentId !== u.department) {
    throw forbidden('You can only create events for your own department.');
  }
  e.departmentId = b.departmentId;
  if (!db.venues.some(v => v.id === b.venueId)) throw bad('Choose a valid venue.');
  e.venueId = b.venueId;
  if (!T.isValid(b.start) || !T.isValid(b.end)) throw bad('Start and end must be valid dates and times.');
  if (b.end <= b.start) throw bad('The event must end after it starts.');
  if (T.minutesBetween(b.start, b.end) > 14 * 24 * 60) throw bad('A single occurrence cannot be longer than 14 days.');
  e.start = b.start; e.end = b.end;
  const r = b.recurrence || {};
  const freq = ['none', 'weekly', 'monthly'].includes(r.freq) ? r.freq : 'none';
  let until = null;
  if (freq !== 'none') {
    until = typeof r.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.until) ? r.until + 'T23:59' : r.until;
    if (!T.isValid(until) || until < b.start) throw bad('Repeat-until date must be on or after the first occurrence.');
    if (T.minutesBetween(b.start, until) > 366 * 24 * 60) throw bad('Recurring series are limited to one year.');
  }
  e.recurrence = { freq, until };
  e.coverImage = image(b.coverImage, 'Cover photo');
  e.coverAlt = str(b.coverAlt, 'Photo description', { max: 140 });
  return e;
}

function image(v, field) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || !UPLOAD_RE.test(v) || !fs.existsSync(path.join(UPLOAD_DIR, path.basename(v)))) throw bad(`${field} is not a valid uploaded image.`);
  return v;
}

function validateMessage(b) {
  const m = {
    guestName: str(b.guestName, 'Guest name', { min: 2, max: 120, required: true }),
    guestTitle: str(b.guestTitle, 'Guest title / organisation', { max: 160 }),
    wording: str(b.wording, 'Welcome wording', { min: 5, max: 600, required: true }),
    eventId: b.eventId || null,
  };
  if (m.eventId && !db.events.some(e => e.id === m.eventId)) throw bad('Linked event not found.');
  if (!db.screens.some(s => s.id === b.screen)) throw bad('Choose a display screen.');
  m.screen = b.screen;
  if (!T.isValid(b.displayFrom) || !T.isValid(b.displayUntil)) throw bad('Display period must be valid dates and times.');
  if (b.displayUntil <= b.displayFrom) throw bad('Display must end after it starts.');
  m.displayFrom = b.displayFrom; m.displayUntil = b.displayUntil;
  m.photo = image(b.photo, 'Guest photo');
  return m;
}

// ---------- ICS ----------
function icsTime(s) {
  const d = new Date(T.parse(s).getTime() - 2 * 3600 * 1000); // Harare is UTC+2, no DST
  return d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
}
const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\r?\n/g, '\\n');
function icsEvent(e) {
  const venue = db.venues.find(v => v.id === e.venueId);
  const lines = [
    'BEGIN:VEVENT', `UID:${e.id}@events.uz.ac.zw`, `DTSTAMP:${icsTime(T.harareNow())}`,
    `DTSTART:${icsTime(e.start)}`, `DTEND:${icsTime(e.end)}`,
    `SUMMARY:${icsEsc(e.title)}`, `DESCRIPTION:${icsEsc(e.summary || e.description)}`,
    `LOCATION:${icsEsc(venue ? venue.name + ', University of Zimbabwe' : 'University of Zimbabwe')}`,
  ];
  if (e.status === 'cancelled') lines.push('STATUS:CANCELLED');
  if (e.recurrence && e.recurrence.freq !== 'none') lines.push(`RRULE:FREQ=${e.recurrence.freq.toUpperCase()};UNTIL=${icsTime(e.recurrence.until)}`);
  lines.push('END:VEVENT');
  return lines;
}
const icsWrap = evs => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//University of Zimbabwe//UZ Events//EN', 'CALSCALE:GREGORIAN', ...evs.flatMap(icsEvent), 'END:VCALENDAR'].join('\r\n');

// ---------- backups ----------
function writeBackup(tag = 'auto') {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const name = `db-${new Date().toISOString().replace(/[:.]/g, '-')}-${require('crypto').randomBytes(4).toString('hex')}-${tag}.json`;
  const file = path.join(BACKUP_DIR, name);
  fs.writeFileSync(file + '.tmp', JSON.stringify(B.createSnapshot(db, UPLOAD_DIR)));
  fs.renameSync(file + '.tmp', file);
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('-auto.json')).sort();
  while (files.length > 14) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  return name;
}
function notifyOwner(actor, record, kind, action, note = '') {
  if (record.createdBy === actor.id) return;
  const recipient = db.users.find(user => user.id === record.createdBy && user.active);
  if (!recipient) return;
  const title = kind === 'event' ? record.title : record.guestName;
  const message = `Your ${kind === 'event' ? 'event' : 'welcome message'} “${title}” was ${action}.${note ? ' ' + note : ''}`;
  const id = store.nextId('n');
  const at = T.harareNow();
  const href = kind === 'event' ? '#/work/events' : '#/work/messages';
  db.notifications.push({ id, userId: recipient.id, at, message, href, readAt: null });
  db.outbox.push({ id: store.nextId('o'), notificationId: id, userId: recipient.id, to: recipient.email,
    subject: `UZ Events: ${action}`, text: message, href, createdAt: at, status: 'pending', attempts: 0, sentAt: null });
}

// ---------- routes ----------
const routes = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler });
};
function need(u, role) {
  if (!u) throw new HttpError(401, 'Please sign in.');
  if (role && !A.atLeast(u, role)) throw forbidden();
}
const getEvent = id => { const e = db.events.find(x => x.id === id); if (!e) throw notFound('Event not found.'); return e; };
const getMessage = id => { const m = db.messages.find(x => x.id === id); if (!m) throw notFound('Message not found.'); return m; };

route('GET', '/api/me', ({ member }) => ({ user: member ? publicUser(member) : null }));

const clientIp = req => (config.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;

// Self-service accounts. Students are checked against their registration number and student email.
// Staff use their own email for now and start with no role ("staff") until an administrator gives them one.
route('POST', '/api/signup', ({ req, body }) => {
  const key = 'signup|' + clientIp(req);
  if (A.throttled(key)) throw new HttpError(429, 'Too many new accounts from this connection. Please wait 10 minutes and try again.');
  const kind = body.kind === 'staff' ? 'staff' : body.kind === 'student' ? 'student' : null;
  if (!kind) throw bad('Choose student or staff.');
  const name = str(body.name, 'Full name', { min: 2, max: 100, required: true });
  const email = str(body.email, 'Email', { max: 120, required: true }).toLowerCase();
  if (!EMAIL.test(email)) throw bad('Email is not valid.');
  if (!db.departments.some(d => d.id === body.department)) throw bad('Choose your faculty or department.');
  const password = String(body.password || '');
  if (password.length < 10) throw bad('Password must be at least 10 characters.');
  if (body.confirm !== undefined && String(body.confirm) !== password) throw bad('The two passwords do not match.');
  let regNumber;
  if (kind === 'student') {
    regNumber = normReg(body.regNumber);
    if (!REG_NUMBER.test(regNumber)) throw bad('Registration number is not valid. It starts with R followed by digits, for example R2420211.');
    if (email !== `${regNumber}@${STUDENT_DOMAIN}`) throw bad(`Use your student email: ${regNumber}@${STUDENT_DOMAIN}. It must match your registration number.`);
    if (db.users.some(x => x.regNumber === regNumber)) throw bad('An account with that registration number already exists. Sign in instead.');
  } else if (email.endsWith('@' + STUDENT_DOMAIN)) {
    throw bad('That is a student email. Create a student account instead.');
  }
  if (db.users.some(x => x.email.toLowerCase() === email)) throw bad('An account with that email already exists. Sign in instead.');
  A.recordFailure(key);
  const { salt, hash } = A.hashPassword(password);
  const nu = { id: store.nextId('u'), name, email, role: kind, department: body.department, salt, hash, active: true, createdAt: T.harareNow(), saved: [] };
  if (regNumber) nu.regNumber = regNumber;
  db.users.push(nu);
  audit(nu, 'auth.signup', nu.id, kind === 'student' ? `student ${regNumber.toUpperCase()}` : `staff ${email}, waiting for a role`);
  if (kind === 'staff') {
    for (const admin of db.users.filter(x => x.role === 'admin' && x.active)) {
      db.notifications.push({ id: store.nextId('n'), userId: admin.id, at: T.harareNow(), href: '#/work/users', readAt: null,
        message: `${name} (${email}) created a staff account and is waiting for a role.` });
    }
  }
  store.save();
  return { user: { name: nu.name, role: nu.role, regNumber: regNumber ? regNumber.toUpperCase() : undefined, email } };
});

// A student's or staff member's own saved events.
route('POST', '/api/me/saved', ({ member, body }) => {
  needMember(member);
  const e = getEvent(String(body.eventId || ''));
  if (!LIVE.includes(e.status) || !canView(member, e)) throw notFound('Event not found.');
  member.saved = (member.saved || []).filter(id => id !== e.id && db.events.some(x => x.id === id));
  if (body.saved) member.saved.unshift(e.id);
  member.saved = member.saved.slice(0, 200);
  saveSoon();
  return { saved: member.saved };
});

route('GET', '/api/updates', ({ u }) => {
  need(u, 'organiser');
  const updates = db.notifications.filter(n => n.userId === u.id);
  return { updates: updates.slice(-100).reverse(), unread: updates.filter(n => !n.readAt).length };
});
route('POST', '/api/updates/read', ({ u, body }) => {
  need(u, 'organiser');
  if (!Array.isArray(body.ids) || body.ids.length > 100 || body.ids.some(id => typeof id !== 'string')) throw bad('Provide up to 100 update IDs.');
  db.notifications.filter(n => n.userId === u.id && body.ids.includes(n.id) && !n.readAt).forEach(n => { n.readAt = T.harareNow(); });
  store.save();
  return { ok: true };
});
route('GET', '/api/admin/outbox', ({ u }) => {
  need(u, 'admin');
  return { outbox: db.outbox, deliveryEnabled: false };
});

route('POST', '/api/login', async ({ req, body, res }) => {
  // One sign-in for everyone: a registration number (students) or an email address (staff and students).
  const id = String(body.login ?? body.email ?? '').trim().toLowerCase();
  const key = id + '|' + clientIp(req);
  if (A.throttled(key)) throw new HttpError(429, 'Too many attempts. Please wait 10 minutes and try again.');
  const u = REG_NUMBER.test(id) ? db.users.find(x => x.regNumber === id) : db.users.find(x => x.email.toLowerCase() === id);
  if (!u || !u.active || !A.verifyPassword(String(body.password || ''), u.salt, u.hash)) {
    A.recordFailure(key);
    audit(null, 'auth.failed', id.slice(0, 120));
    saveSoon();
    throw new HttpError(401, REG_NUMBER.test(id) ? 'Registration number or password is incorrect.' : 'Email or password is incorrect.');
  }
  A.clearFailures(key);
  const token = A.createSession(u.id);
  res.setHeader('Set-Cookie', `uzsid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${SECURE_COOKIES ? '; Secure' : ''}`);
  audit(u, 'auth.login', u.email);
  saveSoon();
  return { user: publicUser(u) };
});

route('POST', '/api/logout', ({ req, res, member: u }) => {
  A.destroySession(cookies(req).uzsid);
  res.setHeader('Set-Cookie', 'uzsid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  if (u) audit(u, 'auth.logout', u.email);
  return { ok: true };
});

route('GET', '/api/meta', () => ({
  departments: db.departments, venues: db.venues, screens: db.screens, categories: db.categories, now: T.harareNow(),
  settings: db.settings,
}));

// The site is for signed-in staff and students only: event data needs an account.
// Lobby screens (/api/display) and the calendar feed stay open, since TVs and calendar apps cannot sign in.
const needMember = member => { if (!member) throw new HttpError(401, 'Please sign in.'); };
route('GET', '/api/events', ({ u, member, q }) => {
  needMember(member);
  const scope = q.scope || 'public';
  const text = (q.q || '').toLowerCase().trim();
  const match = e => {
    if (q.dept && e.departmentId !== q.dept) return false;
    if (q.cat && e.category !== q.cat) return false;
    if (q.venue && e.venueId !== q.venue) return false;
    if (!text) return true;
    const venue = (db.venues.find(v => v.id === e.venueId) || {}).name || '';
    const dept = (db.departments.find(d => d.id === e.departmentId) || {}).name || '';
    return [e.title, e.summary, e.description, venue, dept, e.category].join(' ').toLowerCase().includes(text);
  };
  if (scope === 'public') {
    const today = T.harareNow().slice(0, 10);
    const from = /^\d{4}-\d{2}-\d{2}$/.test(q.from || '') ? q.from : T.addDays(today + 'T00:00', -365).slice(0, 10);
    const to = /^\d{4}-\d{2}-\d{2}$/.test(q.to || '') ? q.to : T.addDays(today + 'T00:00', 365).slice(0, 10);
    const list = [];
    for (const e of db.events) {
      if (!LIVE.includes(e.status) || !canView(member, e) || !match(e)) continue;
      if (q.hideCancelled && e.status === 'cancelled') continue;
      for (const o of occurrences(e, from, to)) {
        list.push({ ...eventOut(e, u, { seriesStart: e.start }), start: o.start, end: o.end, occurrence: o.index, history: undefined, description: undefined });
      }
    }
    list.sort((a, b) => (q.order === 'desc' ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)));
    return { events: list.slice(0, Number(q.limit) || 1000) };
  }
  need(u);
  let list;
  if (scope === 'mine') list = db.events.filter(e => e.createdBy === u.id);
  else if (scope === 'review') list = db.events.filter(e => e.status === 'submitted' && canReview(u, e));
  else if (scope === 'manage') list = db.events.filter(e => canReview(u, e) && e.status !== 'draft');
  else throw bad('Unknown scope.');
  list = list.filter(match).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { events: list.map(e => eventOut(e, u, { conflicts: ['submitted', 'published', 'postponed'].includes(e.status) ? findConflicts(e, e.id) : [] })) };
});

route('GET', '/api/events/:id', ({ u, member, p, q }) => {
  needMember(member);
  const e = getEvent(p.id);
  if (!canView(u, e) && !(LIVE.includes(e.status) && canView(member, e))) throw notFound('Event not found.');
  if (q.view === '1' && !u) { e.views = (e.views || 0) + 1; saveSoon(); }
  return { event: eventOut(e, u, { conflicts: u ? findConflicts(e, e.id) : undefined }) };
});

route('POST', '/api/conflicts', ({ u, body }) => {
  need(u, 'organiser');
  return { conflicts: findConflicts({ venueId: body.venueId, start: body.start, end: body.end, recurrence: body.recurrence && body.recurrence.freq !== 'none' ? { freq: body.recurrence.freq, until: (body.recurrence.until || '').length === 10 ? body.recurrence.until + 'T23:59' : body.recurrence.until } : { freq: 'none' } }, body.excludeId) };
});

route('POST', '/api/events', ({ u, body }) => {
  need(u, 'organiser');
  const v = validateEvent(body, u);
  const now = T.harareNow();
  const e = { id: store.nextId('e'), ...v, status: 'draft', createdBy: u.id, createdAt: now, updatedAt: now, submittedAt: null, decidedAt: null, reviewNote: '', views: 0, history: [{ at: now, by: u.id, action: 'created' }] };
  db.events.push(e);
  audit(u, 'event.created', e.id, e.title);
  store.save();
  return { event: eventOut(e, u), conflicts: findConflicts(e, e.id) };
});

const SIGNIFICANT = ['start', 'end', 'venueId', 'title'];
route('PUT', '/api/events/:id', ({ u, p, body }) => {
  need(u, 'organiser');
  const e = getEvent(p.id);
  if (!canEdit(u, e)) throw forbidden('This event cannot be edited by you in its current state.');
  const v = validateEvent({ ...body, departmentId: body.departmentId || e.departmentId }, canReview(u, e) ? { ...u, role: 'admin' } : u);
  const norm = x => (x === undefined || x === '' ? null : x);
  const changes = Object.keys(v).filter(k => JSON.stringify(norm(v[k])) !== JSON.stringify(norm(e[k])));
  if (!changes.length) return { event: eventOut(e, u), conflicts: findConflicts(e, e.id) };
  const now = T.harareNow();
  const live = LIVE.includes(e.status);
  const note = str(body.changeNote, 'Change note', { max: 300 });
  if (live && changes.some(c => SIGNIFICANT.includes(c)) && !note) {
    throw bad('This is a significant change to a published event. Please add a short note explaining it. It will be shown publicly.');
  }
  // A new photo or its description is not news: keep it out of the public "Updates" list.
  const photoOnly = changes.every(c => ['coverImage', 'coverAlt'].includes(c));
  Object.assign(e, v, { updatedAt: now });
  e.history.push({ at: now, by: u.id, action: live && !photoOnly ? 'amended' : 'edited', note, changes });
  if (live) notifyOwner(u, e, 'event', photoOnly ? 'given a new photo' : 'amended', note);
  audit(u, live ? 'event.amended' : 'event.edited', e.id, changes.join(', '));
  store.save();
  return { event: eventOut(e, u), conflicts: findConflicts(e, e.id) };
});

route('DELETE', '/api/events/:id', ({ u, p }) => {
  need(u, 'organiser');
  const e = getEvent(p.id);
  if (e.status !== 'draft' || (e.createdBy !== u.id && u.role !== 'admin')) throw forbidden('Only drafts can be deleted, by their author.');
  db.events = db.events.filter(x => x !== e);
  db.messages.forEach(m => { if (m.eventId === e.id) m.eventId = null; });
  audit(u, 'event.deleted', e.id, e.title);
  store.save();
  return { ok: true };
});

route('POST', '/api/events/:id/action', ({ u, p, body }) => {
  need(u, 'organiser');
  const e = getEvent(p.id);
  const action = body.action;
  const note = str(body.note, 'Note', { max: 500 });
  const now = T.harareNow();
  const owner = e.createdBy === u.id;
  const reviewer = canReview(u, e);
  const requireNote = () => { if (!note) throw bad('Please add a note explaining this decision.'); };
  const from = (...st) => { if (!st.includes(e.status)) throw bad(`Cannot ${action} an event that is ${e.status}.`); };
  let conflicts = [];
  switch (action) {
    case 'submit':
      if (!owner) throw forbidden(); from('draft', 'returned');
      e.status = 'submitted'; e.submittedAt = now; e.decidedAt = null; e.reviewNote = '';
      conflicts = findConflicts(e, e.id);
      break;
    case 'withdraw':
      if (!owner) throw forbidden(); from('submitted');
      e.status = 'draft'; break;
    case 'approve':
      if (!reviewer) throw forbidden(); from('submitted');
      if (owner) throw forbidden('You cannot approve your own submission. Another approver must review it.');
      e.status = 'published'; e.decidedAt = now; e.reviewNote = note; break;
    case 'return':
      if (!reviewer) throw forbidden(); from('submitted'); requireNote();
      e.status = 'returned'; e.decidedAt = now; e.reviewNote = note; break;
    case 'reject':
      if (!reviewer) throw forbidden(); from('submitted'); requireNote();
      e.status = 'rejected'; e.decidedAt = now; e.reviewNote = note; break;
    case 'postpone': {
      if (!reviewer) throw forbidden(); from('published', 'postponed'); requireNote();
      if (body.start || body.end) {
        if (!T.isValid(body.start) || !T.isValid(body.end) || body.end <= body.start) throw bad('New start and end must be valid, and end after start.');
        e.history.push({ at: now, by: u.id, action: 'rescheduled', note, changes: ['start', 'end'], from: { start: e.start, end: e.end } });
        e.start = body.start; e.end = body.end; e.status = 'published';
        conflicts = findConflicts(e, e.id);
        e.updatedAt = now;
        notifyOwner(u, e, 'event', 'rescheduled', note);
        audit(u, 'event.rescheduled', e.id, `${e.start} → ${e.end}`);
        store.save();
        return { event: eventOut(e, u), conflicts };
      }
      e.status = 'postponed'; break;
    }
    case 'cancel':
      if (!reviewer && !owner) throw forbidden(); from('published', 'postponed'); requireNote();
      e.status = 'cancelled'; break;
    case 'reinstate':
      if (!reviewer) throw forbidden(); from('cancelled', 'postponed');
      e.status = 'published'; conflicts = findConflicts(e, e.id); break;
    default: throw bad('Unknown action.');
  }
  const past = { submit: 'submitted', withdraw: 'withdrawn', approve: 'approved', return: 'returned', reject: 'rejected', postpone: 'postponed', cancel: 'cancelled', reinstate: 'reinstated' }[action];
  e.history.push({ at: now, by: u.id, action: past, note });
  e.updatedAt = now;
  if (!['submit', 'withdraw'].includes(action)) notifyOwner(u, e, 'event', action === 'approve' ? 'published' : past, note);
  audit(u, 'event.' + past, e.id, note || e.title);
  store.save();
  return { event: eventOut(e, u), conflicts };
});

route('GET', '/api/events/:id/ics', ({ member, p, res }) => {
  needMember(member);
  const e = getEvent(p.id.replace(/\.ics$/, ''));
  if (!canView(member, e) || !LIVE.includes(e.status)) throw notFound();
  send(res, 200, icsWrap([e]), { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="uz-event-${e.id}.ics"` });
});

route('GET', '/api/calendar.ics', ({ res }) => {
  const evs = db.events.filter(e => e.isPublic && ['published', 'postponed'].includes(e.status));
  send(res, 200, icsWrap(evs), { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="uz-events.ics"' });
});

// ----- welcome messages -----
route('GET', '/api/messages', ({ u, q }) => {
  need(u, 'organiser');
  let list = A.atLeast(u, 'approver') && q.scope !== 'mine' ? db.messages.filter(m => m.status !== 'draft' || m.createdBy === u.id) : db.messages.filter(m => m.createdBy === u.id);
  list = list.slice().sort((a, b) => b.displayFrom.localeCompare(a.displayFrom));
  return { messages: list.map(m => messageOut(m, u)) };
});

route('POST', '/api/messages', ({ u, body }) => {
  need(u, 'organiser');
  const v = validateMessage(body);
  const now = T.harareNow();
  const m = { id: store.nextId('m'), ...v, status: 'draft', createdBy: u.id, createdAt: now, reviewNote: '', history: [{ at: now, by: u.id, action: 'created' }] };
  db.messages.push(m);
  audit(u, 'message.created', m.id, m.guestName);
  store.save();
  return { message: messageOut(m, u) };
});

route('PUT', '/api/messages/:id', ({ u, p, body }) => {
  need(u, 'organiser');
  const m = getMessage(p.id);
  if (!messageOut(m, u).canEdit) throw forbidden('This message cannot be edited by you in its current state.');
  const v = validateMessage(body);
  const now = T.harareNow();
  const wasApproved = m.status === 'approved';
  Object.assign(m, v);
  // Changing approved wording sends it back for approval unless an approver made the change.
  if (wasApproved && !A.atLeast(u, 'approver')) m.status = 'submitted';
  m.history.push({ at: now, by: u.id, action: 'edited' });
  audit(u, 'message.edited', m.id, m.guestName);
  store.save();
  return { message: messageOut(m, u) };
});

route('POST', '/api/messages/:id/action', ({ u, p, body }) => {
  need(u, 'organiser');
  const m = getMessage(p.id);
  const note = str(body.note, 'Note', { max: 500 });
  const now = T.harareNow();
  const owner = m.createdBy === u.id;
  const reviewer = A.atLeast(u, 'approver');
  const from = (...st) => { if (!st.includes(m.status)) throw bad(`Cannot ${body.action} a message that is ${m.status}.`); };
  switch (body.action) {
    case 'submit': if (!owner) throw forbidden(); from('draft', 'returned'); m.status = 'submitted'; break;
    case 'approve':
      if (!reviewer) throw forbidden(); from('submitted');
      if (owner) throw forbidden('You cannot approve your own message.');
      if (m.displayUntil <= now) throw bad('The display period has already ended. Edit the dates first.');
      m.status = 'approved'; break;
    case 'return': if (!reviewer) throw forbidden(); from('submitted'); if (!note) throw bad('Please add a note.'); m.status = 'returned'; m.reviewNote = note; break;
    case 'reject': if (!reviewer) throw forbidden(); from('submitted'); if (!note) throw bad('Please add a note.'); m.status = 'rejected'; m.reviewNote = note; break;
    case 'withdraw': if (!reviewer && !owner) throw forbidden(); from('approved', 'submitted'); m.status = 'withdrawn'; break;
    default: throw bad('Unknown action.');
  }
  m.history.push({ at: now, by: u.id, action: m.status, note });
  if (body.action !== 'submit') notifyOwner(u, m, 'message', m.status, note);
  audit(u, 'message.' + m.status, m.id, note || m.guestName);
  store.save();
  return { message: messageOut(m, u) };
});

route('GET', '/api/display/:screen', ({ p }) => {
  const sc = db.screens.find(s => s.id === p.screen);
  if (!sc) throw notFound('Screen not found.');
  const now = T.harareNow();
  const messages = db.messages
    .filter(m => m.screen === sc.id && msgState(m, now) === 'live')
    .map(m => {
      const ev = db.events.find(e => e.id === m.eventId && LIVE.includes(e.status) && e.isPublic);
      return { id: m.id, guestName: m.guestName, guestTitle: m.guestTitle, wording: m.wording, displayUntil: m.displayUntil,
        eventId: ev ? ev.id : null, eventTitle: ev ? ev.title : '', photo: m.photo || (ev && ev.coverImage) || null };
    });
  const today = now.slice(0, 10);
  const horizon = T.addDays(now, 7).slice(0, 10);
  const upcoming = [];
  for (const e of db.events) {
    if (!e.isPublic || e.status !== 'published') continue;
    if (sc.venueId && e.venueId !== sc.venueId) continue;
    for (const o of occurrences(e, today, horizon)) if (o.end > now) upcoming.push({ id: e.id, title: e.title, start: o.start, end: o.end, category: e.category, venueName: (db.venues.find(v => v.id === e.venueId) || {}).name });
  }
  upcoming.sort((a, b) => a.start.localeCompare(b.start));
  return { screen: sc, now, messages, upcoming: upcoming.slice(0, 6) };
});

// ----- administration -----
route('GET', '/api/stats', ({ u }) => {
  need(u, 'approver');
  const evs = db.events.filter(e => canReview(u, e));
  const by = {};
  evs.forEach(e => { by[e.status] = (by[e.status] || 0) + 1; });
  const decided = evs.filter(e => e.submittedAt && e.decidedAt && e.decidedAt >= e.submittedAt);
  const avgHours = decided.length ? decided.reduce((s, e) => s + T.minutesBetween(e.submittedAt, e.decidedAt), 0) / decided.length / 60 : null;
  const submittedEver = evs.filter(e => e.status !== 'draft').length;
  const now = T.harareNow();
  const pending = evs.filter(e => e.status === 'submitted');
  const byCategory = {};
  evs.filter(e => LIVE.includes(e.status)).forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + 1; });
  return {
    byStatus: by,
    publishedShare: submittedEver ? Math.round(((by.published || 0) + (by.postponed || 0) + (by.cancelled || 0)) / submittedEver * 100) : null,
    avgApprovalHours: avgHours === null ? null : Math.round(avgHours * 10) / 10,
    totalViews: evs.reduce((s, e) => s + (e.views || 0), 0),
    pending: pending.length,
    pendingWithConflicts: pending.filter(e => findConflicts(e, e.id).length).length,
    upcoming: evs.filter(e => e.status === 'published' && e.end >= now).length,
    liveMessages: db.messages.filter(m => msgState(m, now) === 'live').length,
    pendingMessages: db.messages.filter(m => m.status === 'submitted').length,
    byCategory,
    topViewed: evs.filter(e => LIVE.includes(e.status)).sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5).map(e => ({ id: e.id, title: e.title, views: e.views || 0 })),
  };
});

route('GET', '/api/users', ({ u }) => { need(u, 'admin'); return { users: db.users.map(publicUser) }; });

const ROLES = ['organiser', 'approver', 'admin'];
const STAFF_ROLES = ['staff', ...ROLES]; // "staff" = signed up, no workspace role yet
route('POST', '/api/users', ({ u, body }) => {
  need(u, 'admin');
  const name = str(body.name, 'Name', { min: 2, max: 100, required: true });
  const email = str(body.email, 'Email', { max: 120, required: true }).toLowerCase();
  if (!EMAIL.test(email)) throw bad('Email is not valid.');
  if (db.users.some(x => x.email.toLowerCase() === email)) throw bad('A user with that email already exists.');
  if (!ROLES.includes(body.role)) throw bad('Choose a valid role.');
  if (!db.departments.some(d => d.id === body.department)) throw bad('Choose a valid department.');
  const password = String(body.password || '');
  if (password.length < 10) throw bad('Temporary password must be at least 10 characters.');
  const { salt, hash } = A.hashPassword(password);
  const nu = { id: store.nextId('u'), name, email, role: body.role, department: body.department, salt, hash, active: true, createdAt: T.harareNow() };
  db.users.push(nu);
  audit(u, 'user.created', nu.id, `${email} as ${nu.role}`);
  store.save();
  return { user: publicUser(nu) };
});

route('PUT', '/api/users/:id', ({ u, p, body }) => {
  need(u, 'admin');
  const t = db.users.find(x => x.id === p.id);
  if (!t) throw notFound('User not found.');
  const changes = [];
  if (body.role !== undefined && body.role !== t.role) {
    if (t.role === 'student') throw bad('Student accounts keep the student role.');
    if (!STAFF_ROLES.includes(body.role)) throw bad('Choose a valid role.');
    if (t.id === u.id) throw bad('You cannot change your own role.');
    changes.push(`role ${t.role} → ${body.role}`); t.role = body.role;
    const label = { staff: 'no workspace role', organiser: 'the organiser role', approver: 'the approver role', admin: 'the administrator role' }[t.role];
    db.notifications.push({ id: store.nextId('n'), userId: t.id, at: T.harareNow(), href: '#/work', readAt: null, message: `An administrator gave you ${label}.` });
  }
  if (body.department !== undefined && body.department !== t.department) {
    if (!db.departments.some(d => d.id === body.department)) throw bad('Choose a valid department.');
    changes.push(`department → ${body.department}`); t.department = body.department;
  }
  if (body.active !== undefined && !!body.active !== t.active) {
    if (t.id === u.id) throw bad('You cannot deactivate your own account.');
    t.active = !!body.active; changes.push(t.active ? 'reactivated' : 'deactivated');
    if (!t.active) A.destroyUserSessions(t.id);
  }
  if (body.password) {
    if (String(body.password).length < 10) throw bad('Password must be at least 10 characters.');
    Object.assign(t, A.hashPassword(String(body.password)));
    A.destroyUserSessions(t.id); changes.push('password reset');
  }
  if (changes.length) { audit(u, 'user.updated', t.id, `${t.email}: ${changes.join('; ')}`); store.save(); }
  return { user: publicUser(t) };
});

route('POST', '/api/venues', ({ u, body }) => {
  need(u, 'admin');
  const name = str(body.name, 'Venue name', { min: 2, max: 100, required: true });
  const capacity = Math.max(0, Math.min(100000, parseInt(body.capacity, 10) || 0));
  const location = str(body.location, 'Location', { max: 140 });
  const v = { id: store.nextId('v'), name, capacity, location };
  db.venues.push(v);
  audit(u, 'venue.created', v.id, name);
  store.save();
  return { venue: v };
});

route('PUT', '/api/venues/:id', ({ u, p, body }) => {
  need(u, 'admin');
  const v = db.venues.find(x => x.id === p.id);
  if (!v) throw notFound('Venue not found.');
  v.name = str(body.name, 'Venue name', { min: 2, max: 100, required: true });
  v.capacity = Math.max(0, Math.min(100000, parseInt(body.capacity, 10) || 0));
  v.location = str(body.location, 'Location', { max: 140 });
  audit(u, 'venue.updated', v.id, v.name);
  store.save();
  return { venue: v };
});

route('GET', '/api/audit', ({ u, q }) => {
  need(u, 'admin');
  const text = (q.q || '').toLowerCase();
  const list = db.audit.slice().reverse()
    .map(a => ({ ...a, user: a.userId ? userName(a.userId) : 'Anonymous' }))
    .filter(a => !text || `${a.action} ${a.target} ${a.detail} ${a.user}`.toLowerCase().includes(text));
  return { audit: list.slice(0, 300), total: list.length };
});

route('GET', '/api/admin/backups', ({ u }) => {
  need(u, 'admin');
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  return { backups: fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort().reverse().map(f => ({ name: f, size: fs.statSync(path.join(BACKUP_DIR, f)).size })) };
});

route('POST', '/api/admin/backups', ({ u }) => {
  need(u, 'admin');
  const name = writeBackup('manual');
  audit(u, 'backup.created', name);
  store.save();
  return { name };
});

route('GET', '/api/admin/export', ({ u, res }) => {
  need(u, 'admin');
  audit(u, 'backup.downloaded', '');
  saveSoon();
  send(res, 200, JSON.stringify(B.createSnapshot(db, UPLOAD_DIR)), { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="uz-events-backup-${T.harareNow().slice(0, 10)}.json"` });
});

route('POST', '/api/admin/restore', ({ u, body }) => {
  need(u, 'admin');
  let snap = body.snapshot;
  if (body.name) {
    const file = path.join(BACKUP_DIR, path.basename(String(body.name)));
    if (!fs.existsSync(file)) throw notFound('Backup not found.');
    snap = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  let decoded;
  try { decoded = B.decodeSnapshot(snap, UPLOAD_DIR); } catch (err) { throw bad(err.message); }
  const safety = writeBackup('pre-restore');
  clearTimeout(saveTimer);
  B.restoreSnapshot(decoded, UPLOAD_DIR, store);
  db = store.data;
  ensureSettings();
  audit(u, 'backup.restored', body.name || 'uploaded file', `Safety copy: ${safety}`);
  store.save();
  return { ok: true, safety, counts: { events: db.events.length, users: db.users.length, messages: db.messages.length } };
});

// ----- photos -----
const IMG_TYPES = { 'image/jpeg': ['jpg', b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff], 'image/png': ['png', b => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))], 'image/webp': ['webp', b => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP'] };
route('POST', '/api/uploads', ({ u, body }) => {
  need(u, 'organiser');
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data || ''));
  if (!m) throw bad('Upload a JPEG, PNG or WebP photo.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 3 * 1024 * 1024) throw bad('Photo is too large (maximum 3 MB after compression).');
  const [ext, check] = IMG_TYPES[m[1]];
  if (!check(buf)) throw bad('That file is not a valid image.');
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = require('crypto').randomBytes(16).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  audit(u, 'photo.uploaded', name, `${Math.round(buf.length / 1024)} KB`);
  saveSoon();
  return { url: '/uploads/' + name };
});

route('PUT', '/api/settings', ({ u, body }) => {
  need(u, 'admin');
  const s = {
    heroCaption: str(body.heroCaption, 'Home photo caption', { max: 140 }),
    publicUrl: str(body.publicUrl, 'Public address', { max: 200 }).replace(/\/+$/, ''),
  };
  for (const [k, label] of Object.entries(PAGE_PHOTO_LABELS)) {
    s[k + 'Image'] = image(body[k + 'Image'], label);
    s[k + 'Alt'] = str(body[k + 'Alt'], label + ' description', { max: 140 });
  }
  if (s.publicUrl && !/^https?:\/\/[^\s/]+(\/[^\s]*)?$/.test(s.publicUrl)) throw bad('Public address must start with http:// or https://');
  if (config.publicUrl) s.publicUrl = config.publicUrl;
  db.settings = s;
  audit(u, 'settings.updated', 'site', Object.keys(s).filter(k => s[k]).join(', '));
  store.save();
  return { settings: db.settings };
});

// ---------- HTTP server ----------
const MIME = { '.webp': 'image/webp', '.woff2': 'font/woff2', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || !path.extname(rel)) rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/uploads/')) {
    const name = path.basename(url.pathname);
    if (!UPLOAD_RE.test('/uploads/' + name)) return send(res, 404, 'Not found');
    return fs.readFile(path.join(UPLOAD_DIR, name), (err, buf) => {
      if (err) return send(res, 404, 'Not found');
      res.writeHead(200, { 'Content-Type': MIME[path.extname(name)] || 'image/webp', 'Cache-Control': 'public, max-age=86400' });
      res.end(buf);
    });
  }
  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return serveStatic(req, res, url.pathname);
  }
  try {
    const r = routes.find(x => x.method === req.method && x.re.test(url.pathname));
    if (!r) throw notFound('Unknown API route.');
    if (req.method !== 'GET' && req.headers['x-uz-request'] !== '1') throw forbidden('Missing request header.');
    const m = url.pathname.match(r.re);
    const p = {}; r.keys.forEach((k, i) => { p[k] = decodeURIComponent(m[i + 1]); });
    const body = req.method === 'GET' ? {} : await readBody(req, url.pathname === '/api/admin/restore' ? B.MAX_BYTES + 1024 : url.pathname === '/api/uploads' ? 5 * 1024 * 1024 : 1e6);
    const q = Object.fromEntries(url.searchParams);
    // member: anyone signed in (students and staff waiting for a role included).
    // u: only people with a workspace role; every staff permission check uses it.
    const member = currentUser(req);
    const u = member && A.atLeast(member, 'organiser') ? member : null;
    const result = await r.handler({ req, res, u, member, p, q, body });
    if (!res.headersSent && result !== undefined) send(res, 200, result);
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message, ...(err.extra || {}) });
    console.error(err);
    send(res, 500, { error: 'Something went wrong on the server.' });
  }
});

if (require.main === module) {
  writeBackup('auto');
  setInterval(() => { try { writeBackup('auto'); } catch (error) { console.error('Automatic backup failed:', error.message); } }, 24 * 3600 * 1000).unref();
  server.listen(PORT, config.host, () => console.log(`UZ Events running at ${config.publicUrl || `http://${config.host}:${PORT}`}`));
}

module.exports = { server, reset: () => { db = seed(); store.replace(db); } };
