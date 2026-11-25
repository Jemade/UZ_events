// Gets a Gmail refresh token for UZ Events (permission to SEND email only, nothing else).
// Run on your own computer:
//   GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node scripts/gmail-token.mjs
// Open the link it prints, sign in with the Gmail account the emails should come from, and allow.
// It prints GMAIL_REFRESH_TOKEN. Put it, with the client ID, secret and address, in Render's Environment settings.
// The token is a password: never commit it or paste it into chat or documents.
import http from 'node:http';

const id = process.env.GMAIL_CLIENT_ID, secret = process.env.GMAIL_CLIENT_SECRET;
if (!id || !secret) {
  console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET first (from Google Cloud: APIs & Services, Credentials, OAuth client ID, type "Desktop app").');
  process.exit(1);
}
const server = http.createServer();
server.listen(0, '127.0.0.1', () => {
  const redirect = `http://127.0.0.1:${server.address().port}`;
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: id, redirect_uri: redirect, response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.send', access_type: 'offline', prompt: 'consent',
  });
  console.log('\nOpen this link in your browser and allow UZ Events to send email:\n\n' + url + '\n\nWaiting…');
  server.on('request', async (req, res) => {
    const q = new URL(req.url, redirect).searchParams;
    if (!q.get('code')) { res.end(q.get('error') ? 'Permission was not given. You can close this tab.' : 'Waiting for Google…'); if (q.get('error')) { console.error('Google said: ' + q.get('error')); server.close(); } return; }
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: q.get('code'), client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: 'authorization_code' }),
    });
    const data = await r.json();
    if (!data.refresh_token) {
      res.end('Something went wrong. See the terminal.');
      console.error('No refresh token came back:', data.error_description || data.error || data);
    } else {
      res.end('Done. Go back to the terminal. You can close this tab.');
      console.log('\nGMAIL_REFRESH_TOKEN=' + data.refresh_token + '\n\nAdd it to Render (Environment) with GMAIL_SENDER, GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET.');
    }
    server.close();
  });
});
