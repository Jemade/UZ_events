# Server installation and recovery

Two ways to run UZ Events: on **Render** (quickest, described first), or on a **UZ server** behind a reverse proxy.

## Render

`render.yaml` describes the whole service. In Render choose **New → Blueprint**, pick the repository, and enter `ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` (10+ characters) for the first administrator. Render then sets the rest:
- the port and address (`RENDER`, `PORT`);
- the public `https` address used for QR codes and Secure cookies (`RENDER_EXTERNAL_URL`);
- the visitor's real address for sign-in throttling (taken from Render's proxy).

`SEED=empty` makes the first start create only departments, venues, screens, the bundled photos and the administrator.

On the free plan the disk is temporary. Data resets to that starting state on every restart, redeploy, or sleep after 15 idle minutes, and the first visit after a sleep takes about a minute to wake the service. For lasting use, switch to a paid instance, attach a disk at `/var/data`, and set `DATA_DIR=/var/data`; nothing else changes.

## UZ server

UZ ICT provides the hosting, hostname, TLS and, later, single sign-on details. Each new installation needs `SEED=empty` and the three `ADMIN_` settings, as on Render.

## Configure

Use a supported Node.js LTS release. The application has no runtime packages to install. Copy `config.example.json` to `config.local.json` and set:

- `host`: `127.0.0.1` behind a reverse proxy; bind to another interface only when the hosting network requires it.
- `port`: the internal HTTP port, normally 3000.
- `dataDir`: an absolute path on persistent storage, writable only by the service account.
- `publicUrl`: the approved origin, for example `https://events.uz.ac.zw`, without a path, query or credentials. This overrides the address in Site photos and is used for display links/QR codes.
- `secureCookies`: `true` behind TLS. An HTTPS public URL always enables Secure cookies, even if this option is false. Local HTTP development requires an HTTP URL and false.

Environment variables override file settings: `CONFIG_FILE`, `HOST`, `PORT`, `DATA_DIR`, `PUBLIC_URL`, `SECURE_COOKIES` (`1` or `0`). An explicitly named missing config file fails startup. Relative data paths resolve from the process working directory. Do not commit local configuration.

Run `npm test` before installation, then `npm start`. The server serves HTTP internally; it does not issue certificates or terminate TLS. Configure an approved reverse proxy to terminate HTTPS, redirect HTTP, and forward to the loopback port. Do not expose the Node port publicly. Set the proxy body limit to at least 101 MiB if browser-based full restores are required; upload requests are limited separately. Verify cookies have HttpOnly, SameSite=Strict and Secure in the browser. Do not trust arbitrary client-supplied forwarding headers for TLS decisions.

## Example service definition

Adapt these paths and the service account to the UZ server. This example has not been installed:

```ini
[Unit]
Description=UZ Events
After=network.target

[Service]
Type=simple
User=uz-events
Group=uz-events
WorkingDirectory=/opt/uz-events
Environment=CONFIG_FILE=/etc/uz-events/config.json
ExecStart=/usr/bin/node /opt/uz-events/server.js
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/uz-events

[Install]
WantedBy=multi-user.target
```

Set `dataDir` to `/var/lib/uz-events` in this example. Keep only one Node process: the file store is not designed for multiple writers. Sessions are in memory; restarting signs users out. PostgreSQL, SSO and mail transport are still integrations to complete once UZ provides details. A separate production provisioning plan must replace demo users; never expose a fresh seeded demo as production.

## Backup and restore

Automatic snapshots run on startup and every 24 hours while the process stays running. The last 14 automatic files are retained. Manual and pre-restore safety backups are retained until an administrator applies an agreed retention policy. Watch service logs for automatic-backup errors. A failed scheduled backup is reported and does not terminate the server.

Version 2 JSON bundles contain the database, notifications, outbox and all uploaded photos encoded as base64. Download full export produces the same format as server backups. Filenames are unique even for rapid successive requests. The supported bundle limit is 100 MiB; base64 increases photo size by about a third. Larger installations need streamed/offline backup tooling before launch. For an offline archive, stop the server and copy the complete data directory, including uploads, to approved encrypted storage.

Restore validates the bundle and photo references, takes a safety copy, stages photos and replaces data. A data-write failure rolls back the photo folder. Legacy data-only backups are accepted only if all referenced photos still exist locally; they cannot recover lost photos. Do not restore an untrusted backup. Backups include password hashes and personal data: restrict downloads, storage and access.

The JSON store does not provide a database transaction across a power failure during restore. If the host crashes during restore, stop it, preserve the data directory and any `uploads.previous-*` / `uploads.staged-*` folders, and recover a known-good complete bundle in an isolated instance before bringing the service back. Do not delete recovery folders blindly.

Keep encrypted off-host copies and verify a restore periodically on an isolated installation. Backups on the same disk are not disaster recovery. UZ ICT must agree retention, recovery time and recovery point targets.

## Email outbox contract

Decision changes and their notifications/outbox entries are saved together in `db.json`. Organisers see their own latest 100 updates at Workspace → Overview and can mark those updates read. Decisions include event publication, return, rejection, amendment, reschedule, postponement, cancellation and reinstatement, and welcome-message decisions by another staff member. No email is sent now.

Admins can inspect `/api/admin/outbox`; other users cannot. Each record includes `id`, `notificationId`, `userId`, recipient `to`, `subject`, `text`, relative `href`, `createdAt`, `status: pending`, `attempts` and `sentAt`. This is the persistent input contract for a future delivery adapter. Once UZ provides SMTP/API details, implement a single-writer dispatcher with retry/backoff, error reporting and idempotency keyed by outbox ID. Resolve links against the configured public URL. Updating a destination alone is not enough to implement delivery. Never run a second process that writes the JSON file independently.

Before enabling delivery, decide whether historical pending messages should be discarded or sent. Restoring an old backup may reintroduce previously delivered messages; reconcile with the provider delivery ledger before restarting email delivery.
