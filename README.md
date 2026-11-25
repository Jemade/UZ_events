# UZ Events — School Events Management Web System

The University of Zimbabwe's events system: a public events calendar, an approval workflow for event submissions, visitor welcome screens and a staff workspace with user, venue, photo, audit and backup administration.

Built by Jayden Mapasure and Nyasha Madoro.

## Deploy on Render

1. In the Render dashboard choose **New → Blueprint** and select this repository. Render reads `render.yaml`.
2. Enter the first administrator when asked:
   - `ADMIN_EMAIL`: the address the administrator signs in with.
   - `ADMIN_NAME`: their display name.
   - `ADMIN_PASSWORD`: at least 10 characters. Keep it out of documents and chat; share it in person.
3. Click **Apply**. After the build, the site is at `https://<service-name>.onrender.com`.
4. Opening the site shows the sign-in page first. Nothing else is visible without an account, except the lobby display screens (`#/display/<screen>`) and the calendar feed (`/api/calendar.ics`), which TVs and calendar apps use without signing in.

## Accounts and roles

- **One sign-in form for everyone**, like eMhare: **Username** and **Password**, with no student/staff choice. Students type their registration number (for example `R2420211`, any case) or student email; staff type their email. The server works out who it is and where they go.
- **Create account** is one form too. The email decides the account: `r2420211@students.uz.ac.zw` makes a student account with registration number R2420211 (the part before @ must be a registration number); any other email makes a staff account. Students land on **My events**. Staff start with no role, see a notice on My events, and the administrator is notified to give them a role under **Users and roles → Waiting for a role**.
- **Organisers, approvers and administrators** land in the **Workspace** and see only the screens their role allows. Student accounts can never be given a staff role. Internal events are shown to staff accounts only.

The student email check confirms that the email and the registration number belong together. It does not yet send a code to the inbox, because email delivery is not connected (see the outbox under Workspace).

A new installation starts with UZ's departments, venues (pinned to their campus buildings for directions), lobby screens, one administrator, and one sample event ("UZ Events walkthrough", two days after installation, in the Great Hall) so there is something to open and try. Staff and students then create their own accounts, and the administrator gives staff their roles under **Workspace → Users and roles** (or adds staff directly there).

**Render's free plan has no permanent disk.** Every restart, redeploy, or sleep after 15 idle minutes starts the site afresh from the state above, and everything created is lost. For continued use, move to a paid instance, add a persistent disk mounted at `/var/data`, and set `DATA_DIR=/var/data`. Until then, use **Workspace → Backups → Download** to keep a copy.

### Settings (environment variables)

| Variable | Purpose |
|---|---|
| `SEED` | `empty` for a live installation; `sample` (default) adds sample events and five role accounts for local development |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | First administrator of an `empty` installation |
| `PORT`, `HOST` | Set automatically on Render |
| `PUBLIC_URL` | Address used in QR codes and for secure cookies; defaults to Render's own address |
| `DATA_DIR` | Where data, photos and backups are stored (default `./data`) |
| `GMAIL_SENDER`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` | Gmail for reminder emails (see Setting up Gmail) |

## Calendar and directions

After signing in, the calendar is the whole page: no search box or filters, and it fits the screen. Clicking an event opens its details in a window over the calendar, with a map-pin icon beside the venue that opens directions in Google Maps. The link gives Google Maps the venue's building as the destination and no starting point, so Google Maps starts from wherever the person is (with their permission) and gives turn-by-turn directions.

Building positions come from OpenStreetMap (`public/assets/campus-places.json`, © OpenStreetMap contributors, ODbL), built by `tools/build-campus-map.mjs`. Administrators choose each venue's building under **Workspace → Venues**. Venues with no building chosen (Innovation Hub, Parirenyatwa Lecture Hall) open a Google Maps search for the venue's name instead.

## Who sees an event, and reminder emails

Organisers, approvers and administrators can all post events. Each event is for **Everyone**, **Staff only** or **Students only** (step "Audience and contact"). Students never see staff-only events, staff waiting for a role never see student-only events, and staff with a workspace role see everything. The open calendar feed and lobby screens show only events for everyone.

The last step, **Reminder email**, sets an optional date and time (or "1 day before" / "2 hours before"). Once the event is approved and that time comes, everyone the event is for gets one email with the time, place, a Google Maps directions link and a link to the event. Changing the time sends it again. Anyone can turn reminders off with **Email me event reminders** on their Events page. The "your event was approved / returned" notices go out by email too.

The server checks every minute. Emails wait in an outbox (**Workspace → Email**, administrators) and are sent a few at a time; failures are retried after 2, 4, 8, 16 and 32 minutes.

### Setting up Gmail

Render's free plan blocks email (SMTP) ports, so the system sends through the **Gmail API** over HTTPS instead. One-time setup, done by whoever owns the sending Gmail account:

1. Go to console.cloud.google.com, create a project (e.g. "UZ Events") and enable the **Gmail API**.
2. **Google Auth Platform / OAuth consent screen**: External, app name "UZ Events", your email as support and developer contact. Add the scope `https://www.googleapis.com/auth/gmail.send`. Then **Publish app** (In production): in Testing mode Google cancels the permission after 7 days. Google will warn that the app is unverified; that is expected for a private tool.
3. **Credentials → Create credentials → OAuth client ID**, type **Desktop app**. Copy the client ID and client secret.
4. On your computer, in this project: `GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node scripts/gmail-token.mjs`. Open the link, sign in with the sending Gmail account, allow. It prints `GMAIL_REFRESH_TOKEN`.
5. In Render, **uz-events → Environment**, add `GMAIL_SENDER` (the Gmail address), `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` and `GMAIL_REFRESH_TOKEN`, and save (Render redeploys).
6. Sign in as administrator, **Workspace → Email → Send me a test email**.

Treat the client secret and refresh token like passwords. A personal Gmail account can send to about 500 people a day (Google Workspace accounts about 2,000); larger reminders continue the next day.

**On Render's free plan** the site sleeps after 15 minutes without visitors and does not check reminders while asleep, so a reminder goes out when the site next wakes. The free plan also starts afresh on every restart. For reminders on time, use a paid instance (always on) with a persistent disk.

## Forms and buttons

Every form fits on the screen. When a long form does not fit (the event form on most screens, create account on short ones), it shows one section at a time with **Back** and **Next**; on large screens it shows whole. Adding users and venues happens in pop-ups. Any button that sends something to the server shows a spinner until it has finished.

## Run it locally

```bash
npm start          # http://localhost:3000 — no npm install needed, zero dependencies, Node 18+
npm test           # 25 automated tests
```

Locally the site starts with sample data. All sample accounts use the password `UZevents2026`: `admin@uz.ac.zw`, `approver.reg@uz.ac.zw` (central approver), `approver.eng@uz.ac.zw`, `organiser.eng@uz.ac.zw`, `organiser.sa@uz.ac.zw`, the student `R2400001`, and `chipo.mlambo@example.com` (staff waiting for a role). To start again, stop the server and delete `data/`.

## Architecture

- `server.js`: Node HTTP server with the JSON API, permission checks, event lifecycle, recurrence, venue clash detection, calendar (.ics) export and backups.
- `lib/store.js`: JSON-file store with atomic writes. All storage goes through it, so it can be replaced with PostgreSQL.
- `lib/auth.js`: scrypt password hashes, HttpOnly SameSite=Strict session cookies (Secure over HTTPS), sign-in throttling and the role ladder.
- `public/`: single-page app in plain JavaScript modules. All text is HTML-escaped. Fonts: Source Serif 4 (SIL Open Font License).
- Security: strict Content-Security-Policy, nosniff, no framing; every change request needs an `X-UZ-Request` header; nobody can approve their own submission.
- Times are Harare time (`Africa/Harare`).

More: [project overview](docs/PROJECT-OVERVIEW.md) · [installation and recovery](docs/DEPLOYMENT.md) · [launch and role guides](docs/LAUNCH-AND-HANDOVER.md) · [accessibility record](docs/ACCESSIBILITY-CHECK.md).
