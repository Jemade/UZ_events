# UZ Events — School Events Management Web System

Working prototype of the University of Zimbabwe events system described in the project proposal
(Jayden Mapasure and Nyasha Madoro, 20 November 2026).

## Run it

```bash
npm start          # http://localhost:3000  (no npm install needed — zero dependencies, Node 18+)
npm test           # acceptance tests for section 8 of the proposal
```

Staff sign in at http://localhost:3000/#/staff (not linked from the public site — public visitors never see the staff/admin side).
Full project overview: `docs/PROJECT-OVERVIEW.md`. Fonts: Source Serif 4 (SIL Open Font License) in `public/fonts/`. Uploaded photos are stored in `data/uploads/` and included in version 2 JSON backups and exports.

Demo accounts (password `UZevents2026` for all):

| Account | Role |
|---|---|
| admin@uz.ac.zw | System administrator |
| approver.reg@uz.ac.zw | Central approver (Registrar — can review all departments) |
| approver.eng@uz.ac.zw | Departmental approver (Engineering only) |
| organiser.eng@uz.ac.zw | Event organiser (Engineering) |
| organiser.sa@uz.ac.zw | Event organiser (Student Affairs) |

To reset the demo data, stop the server and delete `data/db.json`. Seed events are placed relative to today.

## What maps to the proposal

| Proposal | Where |
|---|---|
| 4.1 Public discovery: day/week/month/year calendar, filters (date, department, category, venue), search, detail pages, public-only data | `#/`, `#/calendar`, `#/event/:id`, `#/archive` |
| 4.2 Draft → submit → approve / return / reject with notes; amend, reschedule, postpone, cancel with public change notes; venue clash flags | `#/work/events`, `#/work/review`, `#/work/manage` |
| 4.3 Visitor welcome messages with approval, display period, auto-expiry, presentation view for screens | `#/work/messages`, `#/screens`, `#/display/:screen` (press F for full screen) |
| 4.4 Roles: public viewer, organiser, departmental approver, administrator (least privilege, no self-approval) | `#/work/users` |
| Calendar export | `.ics` per event and `/api/calendar.ics` feed |
| 5 Audit log, input validation, backups with a tested restore | `#/work/audit`, `#/work/backups`, `test/acceptance.test.js` |
| 11 Evaluation indicators: share published via system, approval turnaround, views, clashes | `#/work` (approver/admin overview) |

## Architecture

- `server.js` — Node HTTP server: JSON API, permission checks, event lifecycle, recurrence, clash detection, ICS, backups.
- `lib/store.js` — JSON-file store with atomic writes (stand-in for PostgreSQL; all persistence goes through it).
- `lib/auth.js` — scrypt password hashes, HttpOnly SameSite=Strict session cookies, login throttling, role ladder.
- `public/` — vanilla JS single-page app (ES modules, hash routing). All interpolated text is HTML-escaped.
- Security headers: strict CSP (no inline scripts), nosniff, frame-deny; mutating requests require an `X-UZ-Request` header.
- Times are Harare wall-clock (`Africa/Harare`, UTC+2, no DST).

## Before production (from the proposal's open items)

- Replace local passwords with university single sign-on; serve over HTTPS (set `SECURE_COOKIES=1` behind TLS).
- Move the store to PostgreSQL; agree retention, uptime and recovery targets with UZ ICT.
- Replace placeholder venues, departments and seed events with validated data; confirm branding use with the relevant university office.
- Email reminders (desirable enhancement) depend on the available mail infrastructure.

## Finishing work (25 November 2026)

- Complete photo backups with pre-restore safety copies, validation and rollback on data-write failure.
- Private organiser updates on Overview and a persistent email outbox (delivery not enabled).
- File/environment hosting configuration: copy `config.example.json` to ignored `config.local.json`.
- Keyboard and labelling fixes; browser audit is still pending because browser access was unavailable.
- See [installation and recovery](docs/DEPLOYMENT.md), [acceptance and role guides](docs/LAUNCH-AND-HANDOVER.md), and [accessibility verification limits](docs/ACCESSIBILITY-CHECK.md).

`npm test` now runs 11 tests. The original seven plus photo recovery/unsafe backups, private updates/outbox persistence, hosting configuration, and restore rollback. Tests use temporary storage, not the local demo database.
