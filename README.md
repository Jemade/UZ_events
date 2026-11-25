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
4. Everyone signs in at `https://<service-name>.onrender.com/#/login` (the **Sign in** button on every public page).

## Accounts and roles

- **Students** choose **Create account → Student** and enter their registration number (for example `R2420211`, any case) and their student email. The email must be that number at `students.uz.ac.zw` (`r2420211@students.uz.ac.zw`), otherwise the account is refused. They sign in with the registration number and land on **My events**: saved events and what their faculty has coming up.
- **Staff** choose **Create account → Staff** and use their own email. They start with no role and land on **My events** with a notice. The administrator is notified and gives them a role under **Users and roles → Waiting for a role**.
- **Organisers, approvers and administrators** land in the **Workspace** and see only the screens their role allows. Student accounts can never be given a staff role.

The student email check confirms that the email and the registration number belong together. It does not yet send a code to the inbox, because email delivery is not connected (see the outbox under Workspace).

A new installation starts with UZ's departments, venues and lobby screens, the home and sign-in photos from `seed-photos/`, and one administrator. Staff and students then create their own accounts, and the administrator gives staff their roles under **Workspace → Users and roles** (or adds staff directly there).

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
npm test           # 19 automated tests
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
