# Launch readiness and role guides

Prepared 25 November 2026. These are instructions for future acceptance testing and launch, not claims that UZ approvals or device testing have happened.

## Information to request from UZ

Send these requests through the project supervisor; no requests have been sent by this project task.

| Office | Request | Completion evidence |
|---|---|---|
| ICT | SSO protocol/provider, issuer and discovery details, test application registration, allowed callback URLs, test users and claim mapping | Successful sign-in and role-mapping acceptance tests |
| ICT | Approved PostgreSQL server and version, TLS and network rules, credentials through a secure channel, backup/retention requirements | Tested storage adapter, migration rehearsal and rollback |
| Registrar / Events Office | Authoritative departments, categories, venues, capacity/location details and authorised approvers | Reviewed reference-data import |
| Communications | Approved campus/event photos, usage rights, credits, logo/colour approval | Written branding approval and final assets |
| ICT | SMTP or mail API, sender address, credentials via a secure channel, test destination and sending limits | Delivery/retry/idempotency tests with approved recipients |
| ICT | Public hostname, DNS, hosting/service account and TLS ownership | HTTPS, cookie and QR-code verification |
| Supervisor / Protocol | Named acceptance testers, two or three real phones and a venue TV | Signed test record and resolved findings |

## Acceptance session

Use isolated test data. Record tester, role, date, device/browser, expected result, actual result and any issue. Do not mark a step passed until someone performs it.

1. Public visitor: search, change calendar views/filters, view details and updates, export calendar, copy link, print, browse archive. Type staff-only workspace URLs and verify Page not found.
2. Organiser: submit a draft with an approved photo and alt text. Try an overlapping venue booking. Submit, receive a return note in Your updates, revise and resubmit. Confirm publication arrives as another update.
3. Department approver: review a submission, return it with a note and approve the revision. Confirm other departments and self-approval rules match the agreed policy. Nobody, including administrators, can approve their own event or message.
4. Registrar: review across departments; reschedule, postpone and cancel with public reasons. Confirm the public event history reflects each decision.
5. Protocol: request a welcome message, obtain approval, check schedule/expiry and QR link on a TV. Confirm long text and photos remain readable at viewing distance. Test connection loss and expiry.
6. Administrator: manage a test account and venue; verify session revocation after deactivation/reset. Upload a site photo. Download a backup, restore in an isolated instance and confirm both data and photos return.
7. On real phones: open More, tab through it with a keyboard if available, close with Escape/backdrop, follow each permitted link, rotate the device and upload a real photo. Verify no obscured actions, horizontal overflow or accidental duplicate submissions.

## Launch sequence

Complete SSO, database, mail integration if required, validated data and branding approval. Run acceptance tests and browser/accessibility checks. Rehearse backup recovery. Install behind HTTPS on approved hosting, verify real sign-in and QR URLs, take a fresh off-host backup, verify the automatic daily backup and logs, then obtain the launch owner's sign-off. Give each role its guide below and identify a support contact. No public deployment has been performed.

## Organiser quick guide

Use the invitation-only staff address supplied by the Events Office. Open Submit an event, enter the schedule, venue, audience and contact details, and add an approved photo with a description. Review any venue clash. Save a draft or submit for approval. Review Your updates on Overview for decisions; returned events also show the approver's note in My events. Revise and resubmit as needed. For official visitors, use Welcome messages and set both display start and removal times. Sign out on shared devices.

## Department approver quick guide

Open Review queue. Check the event details, visibility, venue warnings and submitter. Approve suitable submissions; return for changes or reject with a clear note. Review within your department. Use Published events to amend, reschedule, postpone or cancel; enter a public explanation for significant changes. Check the resulting public event page. Ask another approver to decide your own submissions.

## Registrar / central approver quick guide

Use Review queue across departments. Coordinate venue clashes and approval responsibilities with the submitting department. Use Published events for university-wide schedule changes and make public reasons clear. Check dashboard figures against the underlying lists. Review welcome messages against approved protocol wording and display periods. Escalate account or infrastructure problems to the administrator.

## Protocol / welcome-screen quick guide

Use the staff role assigned by UZ; there is no separate Protocol role in the current application. Enter approved guest names, titles, wording and authorised photos. Select the correct screen and start/end times. Submit for approval. Check the screen preview after approval, open display mode on the venue TV and use full screen. Verify the public QR destination and automatic expiry. Correct mistakes through the approval workflow.

## Administrator quick guide

Manage users and roles carefully, using the least access needed. Check departments and active status; resets/deactivation revoke sessions. Maintain venues and approved Site photos. Review the audit log. Create/download complete backups regularly, protect them and retain off-host copies. Restore first on an isolated instance; production restore replaces data and photos. Review logs and pending launch work with ICT. Email outbox records are queued only until a delivery adapter is installed.
