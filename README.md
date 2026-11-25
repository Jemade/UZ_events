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
4. Staff sign in at `https://<service-name>.onrender.com/#/staff`. The public site has no sign-in link, so visitors never see the staff side.

A new installation starts with UZ's departments, venues and visitor screens, the home and sign-in photos from `seed-photos/`, and one administrator. The administrator then adds staff accounts under **Workspace → Users and roles**.

**Render's free plan has no permanent disk.** Every restart, redeploy, or sleep after 15 idle minutes starts the site afresh from the state above, and everything created is lost. For continued use, move to a paid instance, add a persistent disk mounted at `/var/data`, and set `DATA_DIR=/var/data`. Until then, use **Workspace → Backups → Download** to keep a copy.

### Settings (environment variables)

| Variable | Purpose |
|---|---|
| `SEED` | `empty` for a live installation; `sample` (default) adds sample events and five role accounts for local development |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | First administrator of an `empty` installation |
| `PORT`, `HOST` | Set automatically on Render |
| `PUBLIC_URL` | Address used in QR codes and for secure cookies; defaults to Render's own address |
| `DATA_DIR` | Where data, photos and backups are stored (default `./data`) |

## Run it locally

```bash
npm start          # http://localhost:3000 — no npm install needed, zero dependencies, Node 18+
npm test           # 15 automated tests
```

Locally the site starts with sample data. All five sample accounts use the password `UZevents2026`: `admin@uz.ac.zw`, `approver.reg@uz.ac.zw` (central approver), `approver.eng@uz.ac.zw`, `organiser.eng@uz.ac.zw`, `organiser.sa@uz.ac.zw`. To start again, stop the server and delete `data/`.

## Architecture

- `server.js`: Node HTTP server with the JSON API, permission checks, event lifecycle, recurrence, venue clash detection, calendar (.ics) export and backups.
- `lib/store.js`: JSON-file store with atomic writes. All storage goes through it, so it can be replaced with PostgreSQL.
- `lib/auth.js`: scrypt password hashes, HttpOnly SameSite=Strict session cookies (Secure over HTTPS), sign-in throttling and the role ladder.
- `public/`: single-page app in plain JavaScript modules. All text is HTML-escaped. Fonts: Source Serif 4 (SIL Open Font License).
- Security: strict Content-Security-Policy, nosniff, no framing; every change request needs an `X-UZ-Request` header; nobody can approve their own submission.
- Times are Harare time (`Africa/Harare`).

More: [project overview](docs/PROJECT-OVERVIEW.md) · [installation and recovery](docs/DEPLOYMENT.md) · [launch and role guides](docs/LAUNCH-AND-HANDOVER.md) · [accessibility record](docs/ACCESSIBILITY-CHECK.md).
