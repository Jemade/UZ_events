# UZ Events — Full Project Overview

**School Events Management Web System for the University of Zimbabwe**
Prepared by Jayden Mapasure and Nyasha Madoro · Prototype built 24 November 2026
Status: working prototype, running locally (`npm start` → http://localhost:3000)

---

## 1. What the system is

UZ Events is one official place where the University publishes, approves, coordinates and archives its events: academic, administrative, ceremonial, research, cultural, sports and public lectures. It also runs the **visitor welcome screens** at reception and venue entrances.

It has two completely separate sides:

| Side | Who sees it | How they get there |
|---|---|---|
| **Public site** | Everyone: students, staff, visitors, the public | Normal navigation. No login. |
| **Staff workspace** | Signed-in organisers, approvers and administrators only | Reached through the one sign-in page (`/#/login`) that everyone uses |

### How the admin side is hidden from public users
- The public header and footer have **no** "Sign in", "Workspace" or "Admin" links.
- Every workspace and admin address (for example `/#/work/users`) shows a plain **"Page not found"** to anyone without the right role. It looks exactly like a page that does not exist, so there is no "access denied" hint that an admin area is there.
- The same applies **between staff roles**: an organiser who types an admin address also gets "Page not found", and admin menu items never appear in their sidebar.
- The **server** enforces this too, independently of the browser. Every admin API returns 401 (not signed in) or 403 (wrong role), and public event data has all internal fields stripped (author, review notes, view counts, edit rights). An automated test checks this on every run (test 6).
- The sign-in page shows no account names, emails or roles. It says only that access is by invitation from the Events Office.

---

## 2. Users and roles (least privilege)

| Role | Can do | Cannot do |
|---|---|---|
| **Public viewer** (not signed in) | Browse calendar, search, view public event pages, download .ics, view archive, view visitor screens | See internal events, drafts, any staff page, any admin page |
| **Event organiser** | Create drafts for **their own department**, submit for approval, withdraw, edit while draft/returned, delete drafts, cancel their own published events, request welcome messages | Approve anything, see other people's drafts, edit published content, manage users, see the audit log or backups |
| **Departmental approver** | Everything an organiser can do, plus review **their department's** submissions, approve / return / reject, amend, reschedule, postpone, cancel, reinstate, approve welcome messages, view the statistics dashboard | Approve their **own** submissions, review other departments, manage users/venues/backups |
| **Central approver** (Registrar's Office) | Same as departmental approver, but across **all** departments | Admin functions |
| **System administrator** | Everything, plus users and roles, venues, audit log, backups and restore | Change their own role or deactivate themselves (safety rule) |

---

## 3. Every page and feature

### 3.1 Public site

**Header (every public page)**
- Navy top bar: "University of Zimbabwe · Events Office · today's date", plus links to Display screens, Subscribe (.ics) and uz.ac.zw. It has a 3px orange line along its bottom edge.
- White masthead: UZ crest, the "UZ Events" wordmark (serif) with "UNIVERSITY OF ZIMBABWE" underneath. Navigation: What's on · Calendar · Archive · Visitor screens. The active page has an orange underline.
- On phones the navigation collapses behind a ☰ menu button.

**Home: "What's on" (`/#/`)**
- Date eyebrow in orange capitals, then the large serif headline "What's on at the University of Zimbabwe" and a one-line introduction.
- A search bar (navy outline, navy "Search" button with magnifier icon). It searches titles, descriptions, venues, faculties and categories.
- Category chips with coloured dots. Each chip opens the calendar filtered to that category.
- **"Happening today"** box (white, navy top border): today's events with times. Anything running right now gets a red **ON NOW** tag. When nothing is left today it becomes **"Coming up next"** and shows the next four events.
- **"The next seven days"** agenda. Each day has a date block (weekday in orange capitals, big serif day number, month), then event rows with time, title, venue · faculty, and a category tag. Each row has a thin left stripe in its category colour. Cancelled events are struck through with a red CANCELLED tag.
- **Feature banner** (solid navy): the next ceremonial event (for example Graduation), with a live countdown in big orange serif numbers (days / hours / minutes), when and where, and an orange "Event details" button.
- **"Browse by faculty and office"** grid: every faculty with its number of upcoming events. Hovering turns the cell navy.
- Footer (deep navy): crest on a white tile, the UZ motto in italics ("Integrity · Knowledge · Diligence · Innovativeness · Professionalism"), event links, visitor links, contact address, copyright line.

**Calendar (`/#/calendar`)**
- Five views on a segmented switch: **Day · Week · Month · Year · List**.
- ◀ Today ▶ navigation, with a large serif title for the period shown.
- Filter bar: free-text search, faculty/office, category and venue. Choosing an option applies it instantly, and a "Clear" button appears once any filter is set.
- A category colour key, plus a count of the events shown.
- **Month:** 7-column grid starting on Monday. Today's number sits in a navy circle. Each day shows up to 3 events as small coloured-stripe rows, then "+N more" (which opens day view).
- **Week:** time grid from 07:00 to 22:00 with events as blocks sized by duration. Overlapping events sit side by side. A **red "now" line** with a dot marks the current time today.
- **Day:** one-day time grid plus a full list of that day's events beside it.
- **Year:** 12 mini-months shaded by how busy each day is (light / mid / navy for 1, 2, 3+ events), with a scale key. Today has an orange outline. Click any day to open it.
- **List:** upcoming agenda for 120 days, used for search results and category/faculty browsing.
- Recurring events (weekly/monthly) appear on every date they occur.
- On narrow screens the week view switches to the list view automatically.

**Event detail (`/#/event/:id`)**
- Breadcrumb, category · faculty eyebrow, large serif title.
- Status banners: **red** "This event has been cancelled" with the reason, **orange** "Postponed" with the reason, and a navy note for internal-only or already-ended events.
- Summary in larger serif text, then the full description.
- **"Updates"** timeline: the public record of every amendment, reschedule, postponement, cancellation and reinstatement, each with its date and reason.
- Fact box on the right (orange top border, stays in view while scrolling): a calendar-tile date (navy month strip, big serif day), day and times, repeat pattern, venue + location, organiser, audience, contact (email link), and status (Confirmed / Postponed / Cancelled).
- Buttons: **Add to my calendar** (downloads .ics), **Copy link**, **Print** (has a clean print stylesheet).
- Staff who are signed in also see a "Record" timeline with who did what and when, the view count, and an **Edit event** button if they are allowed to edit.

**Archive (`/#/archive`)**
- Past events grouped by month (newest first), with filters for text, faculty, category and year (last two years by default).

**Visitor screens (`/#/screens`)**
- One card per screen (Main Reception, Great Hall Foyer, Senate Chamber Entrance, Innovation Hub Lobby). Each card shows a mini preview of what that screen is displaying right now.

**Display mode (`/#/display/:screen`)**, built for TVs at reception
- Full-screen solid navy. Crest on a white tile, "University of Zimbabwe" and the screen name at top left. A large orange **live clock** with the date at top right.
- "WELCOME" in spaced orange capitals with a short orange rule, then the guest's name in very large serif type, their title or organisation, and the approved wording in italic serif with an orange left bar.
- Bottom strip (deep navy): "NEXT HERE" with the next events at that venue (or "ON CAMPUS" for reception).
- With several messages it rotates every 12 seconds, with orange/navy page dots.
- Checks for changes every 30 seconds. Messages appear when approved and **disappear automatically** when their display period ends. If the network drops, it keeps showing the last content.
- With no active message: "Welcome to the University of Zimbabwe" and the motto.
- Press **F** for full screen. Hovering the mouse reveals an "Exit display" button.

### 3.2 Staff workspace (signed-in only)

**Sign in (`/#/login`):** one centred form for everyone, in the style of eMhare: Username (registration number for students, email for staff) and Password. No student/staff choice: the server works out who it is, checks the password and role, and sends students to My events and staff to the Workspace. A hidden field catches bots. Too many wrong attempts locks sign-in for 10 minutes (8 failures per username and connection). **Create account** is also one form: a `students.uz.ac.zw` email makes a student account (the registration number is taken from it), any other email makes a staff account that waits for a role.

**Layout:** white sidebar on the left with the user's avatar (navy circle with initials), name, role and department. The sections shown depend on role:
- *Workspace:* Overview · My events · Submit an event · Welcome messages
- *Approvals* (approvers and admins): Review queue (orange badge with the number waiting) · Published events
- *Administration* (admins only): Users and roles · Venues · Audit log · Backups

The current section has an orange left bar and a pale navy background. On phones the sidebar turns into a horizontal scrolling tab strip.

**Overview (`/#/work`)**
- Greeting by time of day ("Good evening, Farai").
- *Organisers:* tiles for Drafts, Awaiting approval, Returned to you and Published, plus a "What to do next" panel listing returned events with the approver's note and a link to revise.
- *Approvers/admins:* five tiles. **Awaiting your review** (and how many have a venue clash), **Upcoming published**, **Average approval time**, **Published via system %**, **Welcome screens live**. Below them: a "Needs a decision" list, a **Public calendar by category** bar chart (navy bars, rounded ends, values on the right), and a **Most viewed events** table with the total public view count. These match the evaluation indicators in section 11 of the proposal.

**My events (`/#/work/events`)**
- Tabs with counts: All · Drafts · Awaiting approval · Returned · Published · Cancelled/rejected.
- Table: title + category, date/time, venue (orange "Clash" tag where relevant), status pill, and actions (Edit, Submit, Withdraw, Delete draft, Cancel event). Approver notes appear under the title.

**Submit / edit an event (`/#/work/events/new`)**
- Grouped sections: *About the event* (title, summary up to 280 characters, description, category, faculty), *When and where* (start/end date and time, venue with capacity, repeats none/weekly/monthly + repeat until), *Audience and contact* (audience, contact name, email, "Show on the public calendar" tick box; untick it for internal events such as Senate).
- **Live clash check** while typing: an orange warning listing overlapping bookings at the same venue, or a green "looks free" confirmation. A clash warns but does not block, and the approver sees it too.
- **Live preview** on the right showing exactly how the event will look in the calendar, plus a three-step "How approval works" explainer.
- Organisers can only choose their own department (the selector is locked).
- When amending a **published** event, a "Reason for the change" field appears. It is **required** when the title, time or venue changes, and is shown publicly under "Updates".
- Buttons: "Save and submit for approval", "Save draft", "Cancel".

**Review queue (`/#/work/review`)**
- One card per submission, with a category-coloured left edge: category, how long it has been waiting, title, summary, when, venue, department, submitter, visibility, and any **venue clash** warning.
- Decision panel: note box, **Approve** (navy), **Return** (outline), **Reject** (red outline). Return and reject require a note. Your own submissions show "another approver must review it" instead of buttons.
- A second section holds **welcome messages** waiting for approval, with the wording shown as a quote.

**Published events (`/#/work/manage`)**
- Search, then tabs: Upcoming · Past · Cancelled · Returned/rejected.
- Actions per event: **Amend**, **Reschedule** (new date and times + public reason), **Postpone** (date to be announced + reason), **Cancel** (reason), **Reinstate**. Every action goes into the event's public "Updates" and the audit log.

**Welcome messages (`/#/work/messages`)**
- Tabs: All · On screen now · Scheduled · Awaiting approval · Drafts/returned · Ended.
- Each row: guest, screen (opens it), display period, state pill, actions (Edit / Submit / Approve / Withdraw).
- Form: guest name, title/organisation, approved wording (600-character counter), screen, optional linked event, "Show from" and "Remove at" times. A **live mini-screen preview** updates as you type.
- If an organiser edits an approved message, it goes back for approval.

**Users and roles (`/#/work/users`, admin only)**
- Table of everyone: name/email, role dropdown (with a confirmation step), department dropdown, Active/Deactivated pill, Reset password, Deactivate/Reactivate.
- Deactivating someone or resetting their password signs them out immediately.
- "Add a user" form: name, email, role (with a plain-English description of each), department, temporary password (10+ characters).

**Venues (`/#/work/venues`, admin only)**: venue list with location and capacity, a "Bookings" link (week view filtered to that venue), Edit, and an Add venue form.

**Audit log (`/#/work/audit`, admin only)**: searchable record of every sign-in, failed sign-in, creation, submission, decision, amendment, cancellation, user change, venue change, backup and restore, with time, user, action, record and detail. Keeps the last 5,000 entries.

**Backups (`/#/work/backups`, admin only)**
- Automatic backup when the server starts and every 24 hours (the last 14 are kept).
- "Create backup now", "Download full export (.json)", "Restore from file…", and a list of server backups each with a **Restore** button.
- Every restore first takes a **safety copy** of the current data. Invalid files are refused. Restores are audited.

---

## 4. Event and message lifecycles

**Events**

```
draft ──submit──▶ submitted ──approve──▶ published ──postpone──▶ postponed
  ▲                  │  │                    │  │                   │
  └──withdraw────────┘  ├──return──▶ returned ─(edit, resubmit)     │
                        └──reject──▶ rejected    │                  │
                                    published ──cancel──▶ cancelled ◀┘
                                    cancelled/postponed ──reinstate──▶ published
                                    published ──reschedule (new date)──▶ published
```

- Only **published / postponed / cancelled** events are ever visible to the public. Cancelled ones stay visible with a banner, so nobody turns up to a cancelled event.
- Events that have finished move into the archive automatically (by date).

**Welcome messages:** draft → submitted → approved (→ shown as *scheduled* → *live* → *expired* purely by time) · returned · rejected · withdrawn.

---

## 5. Design system

### 5.1 Principles
- **Flat and human, not "AI-styled":** no gradients, no drop shadows, no glassy effects, no rounded "bubble" cards. Corners are almost square (3px radius).
- **Editorial and institutional:** serif headlines like a university press office, thin 1px dividing lines, generous white space, strong navy and orange rules to structure the page.
- **Colour has a job:** navy is structure and actions, orange is emphasis and the "current" marker, category colours only identify categories, and red/green/amber only mean status.

### 5.2 Brand colours (taken from uz.ac.zw and eMhare)

| Token | Hex | Used for |
|---|---|---|
| Navy | `#003366` | Primary buttons, links, headings, today marker, display-screen background, feature banner |
| Deep navy | `#002244` | Top bar, footer, button hover, heading text |
| Navy tint | `#e8edf4` | Active sidebar item, hover backgrounds |
| Orange (UZ accent) | `#f79422` | Top-bar rule, active nav underline, countdown digits, display clock, "Welcome", badges, focus outline |
| Orange text | `#a85a00` | Orange text on white (accessible contrast): eyebrows, weekdays |
| Orange tint | `#fdf1e2` | "Awaiting approval" pills, clash warnings |
| Paper | `#f6f4ef` | Page background (warm off-white) |
| White | `#ffffff` | Cards, panels, masthead |
| Ink | `#16212e` | Body text |
| Ink 2 | `#44515f` | Secondary text |
| Muted | `#6b7785` | Labels, captions |
| Line | `#d9dee6` / `#e9ecf1` | Borders and dividers |
| Red | `#b23a3a` (tint `#f8e9e9`) | Cancelled, rejected, errors, "now" line, ON NOW tag |
| Green | `#2f6b3c` (tint `#e7f1e9`) | Published, approved, live, "venue is free" |

### 5.3 Category colours
These run in a fixed order and were checked with a colour-blindness validator. Every category always also shows its **name**, so colour is never the only cue.

| Category | Colour |
|---|---|
| Academic | Blue `#2a78d6` |
| Public lecture | Orange `#eb6834` |
| Research | Aqua `#1baf7a` |
| Ceremonial | Gold `#eda100` |
| Cultural | Pink `#e87ba4` |
| Sports | Green `#008300` |
| Administrative | Violet `#6250d6` |

They appear as the left stripe on event rows and calendar blocks, the small square before category tags, and the dot in category chips.

### 5.4 Status pills
Small uppercase labels with a thin border:
- Grey: Draft, Withdrawn, Expired
- Orange: Awaiting approval, Scheduled
- Amber: Returned, Postponed
- Green: Published, Approved, On screen
- Red: Rejected, Cancelled

### 5.5 Typography
- **Headings:** Georgia (falls back to Iowan Old Style / Palatino / Times). Regular weight, slightly tight letter-spacing. The home headline scales from 30px to 50px.
- **Body:** the device's own system font (Segoe UI on Windows, Roboto/Ubuntu on Linux and Android, San Francisco on Apple), 15px with 1.55 line height. No web fonts are downloaded, which keeps pages fast on low bandwidth.
- **Eyebrows and labels:** 11–12px uppercase with wide letter-spacing, in orange text or muted grey.
- **Numbers:** big serif numerals for dates, countdowns and dashboard figures; aligned digits in tables.

### 5.6 Logo use
- The official UZ crest (shield, Zimbabwe Bird, open book, motto scroll), cropped from the university's own logo image: `public/assets/uz-crest.png`.
- The full logo with the "UNIVERSITY OF ZIMBABWE" lettering is kept at `public/assets/uz-logo.jpg`.
- The crest is used in the masthead (54px), the sign-in page, the footer (on a white tile), display screens (on a white tile against navy) and as the browser-tab icon.

### 5.7 Icons
Simple hand-coded line icons (2px stroke, no icon library):
- 🔍 Search (magnifier): search buttons
- 📅 Calendar: "Add to my calendar"
- ◀ ▶ Chevrons: calendar navigation
- ☰ Menu: mobile navigation
- ＋ Plus: "New event", "Add user", "Add venue"
- 🖥 Screen: visitor-screen hint
- 🖨 Printer: Print
- 🔗 Link: Copy link

Other visual markers: coloured category squares and dots, the red "now" dot-and-line, carousel page dots on the display screen, and initials avatars.

### 5.8 Components
Buttons (navy solid, navy outline, plain, orange, red outline; normal and small), text inputs and selects (42px, thin grey border, navy focus), tick boxes in navy, chips, tags, pills, segmented switches, tabs with counts, tiles, panels with header bars, tables, agenda rows, date blocks, fact box, banners, warning/success boxes, timeline, pop-up dialogs (square, navy top edge, darkened backdrop), toast messages (deep navy with orange left bar, bottom-left), empty states.

### 5.9 Motion
Only a short fade-up when the display screen changes message, and a fade-in on toasts. All motion is switched off for users who set "reduce motion".

### 5.10 Responsive and accessible
- Layout changes at 1080px (columns stack) and 820px (phone: menu button, compact agenda, month cells show coloured bars instead of titles, sidebar becomes tabs).
- "Skip to content" link, visible orange focus outlines, labelled form fields, ARIA labels on icon-only buttons, live regions for calendar titles and clash checks, and readable text contrast.
- Print view hides navigation and buttons.

---

## 6. Technical architecture

```
Browser (any device)                         Server (Node.js, zero dependencies)
┌───────────────────────────┐   JSON/HTTPS   ┌────────────────────────────────────┐
│ index.html + app.css       │ ◀────────────▶ │ server.js   routes, rules, ICS      │
│ js/app.js     router+shell │                │ lib/auth.js passwords, sessions     │
│ js/views/public.js         │                │ lib/store.js data file (atomic)     │
│ js/views/calendar.js       │                │ lib/time.js  Harare time helpers    │
│ js/views/display.js        │                │ lib/seed.js  demo data              │
│ js/views/workspace.js      │                │ data/db.json + data/backups/        │
│ js/util.js  safe templates │                └────────────────────────────────────┘
└───────────────────────────┘
```

- **No frameworks or packages to install.** It runs on Node 18 or newer. The data store sits behind a small module so it can be swapped for **PostgreSQL** (as in the proposal) without touching the rest.
- **Times** are stored as Harare local time (UTC+2, no daylight saving).
- **Recurring events** are expanded into individual dates on the server, capped at one year per series.
- **Clash detection:** two bookings at the same venue clash if their times overlap (back-to-back bookings are fine). It checks every occurrence of recurring series against submitted, published and postponed events.

### 6.1 API (all under `/api`)

| Area | Endpoints |
|---|---|
| Session | `GET /me`, `POST /login`, `POST /logout` |
| Reference data | `GET /meta` (departments, venues, screens, categories, server time) |
| Events | `GET /events` (scopes: public, mine, review, manage, plus filters), `GET /events/:id`, `POST /events`, `PUT /events/:id`, `DELETE /events/:id`, `POST /events/:id/action` (submit, withdraw, approve, return, reject, postpone/reschedule, cancel, reinstate), `POST /conflicts` |
| Calendar export | `GET /events/:id/ics`, `GET /calendar.ics` |
| Welcome messages | `GET /messages`, `POST /messages`, `PUT /messages/:id`, `POST /messages/:id/action`, `GET /display/:screen` (public) |
| Dashboard | `GET /stats` |
| Admin | `GET/POST/PUT /users`, `POST/PUT /venues`, `GET /audit`, `GET/POST /admin/backups`, `GET /admin/export`, `POST /admin/restore` |

### 6.2 Data stored
Users (passwords stored only as hashes), departments (12), venues (8), screens (4), categories (7), events (with full history), welcome messages (with history), and the audit log.

### 6.3 Security
- Passwords hashed with **scrypt** and a unique salt per user; never stored or returned in plain text.
- Session cookie is **HttpOnly** and **SameSite=Strict**, lasts 8 hours (renewed while active), and can be marked Secure behind HTTPS.
- Sign-in throttling (8 failures → 10-minute lock).
- Every change request must carry a special header, which blocks cross-site request forgery.
- Strict Content-Security-Policy (no inline or third-party scripts), no-sniff, deny framing, same-origin referrer, camera/microphone/location disabled.
- Everything shown on screen is escaped, so typed-in content cannot inject code.
- Server-side validation of every field (lengths, emails, valid dates, end after start, existing venue/department/category).
- Rules enforced on the server: own-department submissions, no self-approval, notes required for return/reject/cancel/postpone, a reason required for significant public changes.
- Uploaded files cannot reach outside the `public` folder.
- Everything important goes into the audit log.

---

## 7. Testing (proposal section 8: acceptance)

`npm test` runs six automated end-to-end tests, and all six pass:
1. **Submission → return with note → resubmit → approve → public**. Drafts are hidden from the public, a significant change needs a public reason, and public data carries no internal fields.
2. **Role restrictions:** sign-in required, organisers and approvers blocked from admin, no cross-department submissions, no cross-department approval, no self-approval, internal events hidden, change requests without the security header rejected.
3. **Venue clashes:** an overlap is flagged and back-to-back bookings are not.
4. **Welcome messages:** not shown until approved, self-approval blocked, shown once approved, removed automatically after expiry.
5. **Backup and restore:** take a backup, add data, restore, and the data returns to the backup point. Invalid files are refused and the restore is audited.
6. **Admin side hidden:** anonymous visitors get 401 and organisers get 403 on every admin endpoint, and public data has no staff-only fields.

The site was also checked by hand in Chrome: home, calendar month/week, sign-in, workspace overview, review queue (approval), submission form, event page, display screen, and the hidden-admin behaviour. No browser console errors. The phone layout is written but has **not yet been checked on a real phone**.

---

## 8. Running it and demo accounts

```bash
cd "Innovation Hub project"
npm start                       # then open http://localhost:3000
npm test                        # run the acceptance tests
```

- Sign-in address for everyone: **http://localhost:3000/#/login** (the site opens on it).
- Demo password for every account: `UZevents2026`.

| Email | Role |
|---|---|
| admin@uz.ac.zw | System administrator |
| approver.reg@uz.ac.zw | Central approver (all departments) |
| approver.eng@uz.ac.zw | Departmental approver (Engineering) |
| organiser.eng@uz.ac.zw | Organiser (Engineering) |
| organiser.sa@uz.ac.zw | Organiser (Student Affairs) |

- **Reset the demo:** stop the server and delete `data/db.json`. Demo events are generated around today's date.
- **Demo content (placeholders, to be confirmed with UZ):** venues (Great Hall, Senate Chamber, Main Library Auditorium, Engineering LT1, New Arts LT, Innovation Hub, Sports Pavilion, Parirenyatwa Lecture Hall), 12 faculties and offices, sample events (inaugural lecture, Senate, research day, pitch night, athletics, arts festival, graduation and rehearsal, moot court, weekly seminar, careers fair, a cancelled field day, two pending submissions, one draft), and three welcome messages.

---

## 9. Files

```
Innovation Hub project/
├── server.js                  API, rules, static files, backups
├── lib/  auth.js · store.js · time.js · seed.js
├── public/
│   ├── index.html
│   ├── css/app.css            the whole design system
│   ├── assets/ uz-crest.png · uz-logo.jpg
│   └── js/ app.js · util.js · views/{public, calendar, display, workspace}.js
├── test/acceptance.test.js
├── docs/PROJECT-OVERVIEW.md   this document
├── README.md · package.json · .gitignore
└── data/                      created at run time (database + backups, not committed)
```

---

## 10. Before going live (open items from the proposal)

1. **Single sign-on** with the university directory (for example via eMhare) instead of local passwords.
2. **HTTPS** on a UZ subdomain (for example events.uz.ac.zw); turn on secure cookies.
3. Move data to **PostgreSQL** on UZ-managed or approved hosting; agree uptime, retention and recovery targets with UZ ICT.
4. Replace placeholder venues, departments and events with **validated data**; get **branding approval** from the relevant university office.
5. Optional: **email reminders** (depends on available mail infrastructure).
6. Check the layout on **real phones** and run a formal accessibility review and user-acceptance testing (proposal weeks 11–12).

---

## 11. Elegance update (24 November 2026)

All nine design improvements are now built.

1. **Photography**
   - Admins upload the home-page photo and set the public web address in **Administration → Site photos**.
   - Organisers can attach a **cover photo** (with a description for screen readers) to any event.
   - Protocol can attach a **guest photo** to a welcome message.
   - Photos are shrunk in the browser (longest side 1600px, JPEG) before upload. The server only accepts real JPEG/PNG/WebP files up to 3 MB.
   - Until approved UZ photos are supplied, the site shows flat **line illustrations** instead: a campus hall drawing, plus artwork for each category.
   - Note: uploaded photos live in `data/uploads/` and are **not** part of the JSON backups. Back that folder up separately.
2. **Great Zimbabwe motif**
   - A chevron frieze and stone-course brick pattern, taken from the base of the crest, drawn as flat SVG tiles in `public/assets/motif/`.
   - It appears in the band under the top bar, the footer edge, the brickwork at the foot of the footer, an orange chevron under each section heading, and the display-screen header and corner.
3. **Typeface**
   - Headings are now **Source Serif 4**, hosted on our own server (`public/fonts/`, SIL Open Font License, about 170 KB for upright and italic) and preloaded.
   - There is a defined type scale (display, h1, h2, h3, body 15.5px, small 13px, label 11.5px).
   - Dates and times use aligned figures. Headlines are balanced so they wrap evenly.
4. **Spacing and rhythm**
   - One 4px-based spacing scale (4, 8, 12, 16, 24, 32, 48, 64, 96).
   - The home hero is rebalanced: two-line headline, photo or illustration with a navy "events this week" stamp, and a white **"Happening today / Coming up next" band** with four events.
   - Weekends are lightly shaded in month view.
5. **Motion**
   - A 0.24-second fade when changing pages.
   - Grey **placeholder shapes** while pages load (public and workspace versions).
   - Gentle hover movement on rows and cards.
   - The event you just came back from is **highlighted in orange** and scrolled into view.
   - All of this is off when "reduce motion" is set.
6. **Empty and edge states**
   - Small drawings: an icon in a circle on a chevron course, plus a clear next step ("Review queue clear", "A quiet week", "Page not found" with a way back).
   - Confirmations say exactly what happened ("Approved — now live on the public calendar").
   - **Undo** appears for submitting and withdrawing events.
7. **Icon set**
   - About 40 hand-drawn line icons in `public/js/art.js`, all 1.75px stroke.
   - One icon per category: book (Academic), microphone (Public lecture), flask (Research), mortarboard (Ceremonial), drum (Cultural), trophy (Sports), building (Administrative).
   - Icons also appear beside every workspace menu item and in the event details box (pin, building, people, envelope, repeat, info).
8. **Phones** (checked at 390×844 in headless Chrome)
   - Bigger tap targets (44–48px) and 16px inputs, so phones don't zoom in.
   - A swipeable **day strip** with event dots above the calendar, and **swipe left/right** to change period.
   - The workspace gets a **bottom bar** (Overview · Events · Submit · Review/Messages · More), with "More" opening the full menu as a sheet.
   - The top bar is shortened to fit.
9. **Display screens**
   - Guest or event **photo** in a white frame beside the welcome.
   - **Crossfade** between messages.
   - A **QR code** linking to the event page (or "what's on"). It is generated by our own encoder in `public/js/qr.js`, and test codes from version 1 to 10 were decoded correctly with OpenCV.
   - **Long names shrink** to fit on two lines.

Tests: `npm test` now runs **7** acceptance tests, all passing. The new one covers photo uploads (rejects non-images, fake images and unsafe file paths) and the admin-only site settings.


## Stage 1 update - 25 November 2026

This update supersedes earlier descriptions of backups, typography, settings and test counts. Version 2 backups/export include uploaded photos, notifications and the email outbox. Restore checks references and filenames, stages photos and rolls back photos if saving data fails. Old data-only snapshots require their original photos. The complete backup limit is 100 MiB.

Workspace Overview now includes private decisions in Your updates, with unread status and mark-as-read. Notifications and pending email records persist with the corresponding decision. No mail is sent; delivery requires a future adapter and UZ mail configuration. New APIs: GET /api/updates, POST /api/updates/read, GET /api/admin/outbox (admin only).

Hosting settings are in config.local.json or environment variables; config.example.json is the template. An HTTPS public URL automatically enables Secure cookies and overrides the site-address field. The server still requires a TLS reverse proxy.

The source has keyboard/focus and form-label improvements. Browser accessibility audits, mobile menu click-through and real-photo browser upload remain unverified because browser control was unavailable. See ACCESSIBILITY-CHECK.md for exact limits. All 11 automated tests pass. The bundled Source Serif 4 font replaces the earlier Georgia-only design; Georgia remains a fallback. Font subsetting is documented in the font notes.

See DEPLOYMENT.md and LAUNCH-AND-HANDOVER.md for installation, recovery, institutional requests, acceptance scripts and role guides. SSO, PostgreSQL, approved reference data/assets, mail delivery and actual deployment remain pending.

## 12. Campus photographs (25 November 2026)

Photos now come from the University's own public gallery at uz.ac.zw/index.php/gallery. Facebook, news and other third-party copies were not used. Each photo was shrunk to 1600×900 JPEG and uploaded through the normal photo upload, so it lives in `data/uploads/` and is included in backups.

| Where | Gallery file |
|---|---|
| Home page | The red-brick "University of Zimbabwe" sign wall with the crest. **Not a UZ photo:** it is from a Star FM Zimbabwe Facebook post (Feb 2025), shrunk from Google's preview. Caption credits "Photo: Star FM Zimbabwe" |
| Graduation Ceremony, Graduation Rehearsal | UZ Great Hall_2.png (entrance) |
| Careers Fair (Great Hall) | UZ Great Hall.png |
| Faculty of Science Research Day (Main Library Auditorium) | UZ Main Library.png |
| Inter-faculty Athletics (Sports Pavilion) | Sports Fields Overview.png |

Photos were only matched to events held in the building shown. Other events keep their category illustration. The sign-in, create account, My events, archive and workspace pages have no photo.

Changing only an event's photo or photo description is now an internal edit. It no longer appears in the public "Updates" list, and the organiser is told the event was "given a new photo".

**Still needed:** written permission from the UZ Communications office to reuse these gallery photos in the system, plus any credit wording they require.

**Before any public launch, the home page photo must be dealt with.** It belongs to Star FM. Either get written permission from Star FM, or replace it with a UZ-owned photo of the same wall: take one on campus, or ask UZ Communications for one. Then upload it under Workspace → Site photos → Home page photo. This copy is only about 1000px wide, so it will look soft on large high-resolution screens.
