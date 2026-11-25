// Sends email through the Gmail API over HTTPS.
// (Render's free plan blocks the SMTP ports, so Gmail's SMTP server cannot be used there.)
//
// Settings (environment variables), all four needed:
//   GMAIL_SENDER         the Gmail address the emails come from
//   GMAIL_CLIENT_ID      OAuth client ID from Google Cloud (type: Desktop app)
//   GMAIL_CLIENT_SECRET  its client secret
//   GMAIL_REFRESH_TOKEN  from `node scripts/gmail-token.mjs` (scope gmail.send only)
// Without them, emails wait in the outbox and nothing is sent.
'use strict';

function mailConfig(env = process.env) {
  const c = {
    sender: String(env.GMAIL_SENDER || '').trim(),
    clientId: String(env.GMAIL_CLIENT_ID || '').trim(),
    clientSecret: String(env.GMAIL_CLIENT_SECRET || '').trim(),
    refreshToken: String(env.GMAIL_REFRESH_TOKEN || '').trim(),
  };
  c.configured = !!(c.sender && c.clientId && c.clientSecret && c.refreshToken);
  return c;
}

let cached = { token: null, expires: 0 };
async function accessToken(c) {
  if (cached.token && Date.now() < cached.expires - 60000) return cached.token;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken, grant_type: 'refresh_token' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const why = data.error === 'invalid_grant' ? 'the refresh token was refused (expired or revoked); create a new one with scripts/gmail-token.mjs' : (data.error_description || data.error || `HTTP ${res.status}`);
    throw Object.assign(new Error(`Gmail sign-in failed: ${why}`), { permanent: data.error === 'invalid_grant' || data.error === 'invalid_client' });
  }
  cached = { token: data.access_token, expires: Date.now() + (data.expires_in || 3600) * 1000 };
  return cached.token;
}

const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const header = s => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const clean = s => String(s).replace(/[\r\n]+/g, ' ').trim(); // no header injection

function mime(c, { to, subject, text }) {
  const body = b64(text.replace(/\r?\n/g, '\r\n')).replace(/.{76}/g, '$&\r\n');
  return [
    `From: ${header('UZ Events')} <${clean(c.sender)}>`,
    `To: ${clean(to)}`,
    `Subject: ${header(clean(subject))}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join('\r\n');
}

async function sendMail(c, msg) {
  if (!c.configured) throw new Error('Gmail is not set up.');
  const raw = Buffer.from(mime(c, msg), 'utf8').toString('base64url');
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken(c)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const reason = data.error?.message || `HTTP ${res.status}`;
    // 429 / rate or quota errors: stop for now and try again later.
    throw Object.assign(new Error(`Gmail refused the email: ${reason}`), { quota: res.status === 429 || /quota|rate limit|limit exceeded/i.test(reason), permanent: res.status === 400 });
  }
  return res.json();
}

module.exports = { mailConfig, sendMail, mime };
