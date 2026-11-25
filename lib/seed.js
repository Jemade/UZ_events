// Starting data.
//  - seed():      full sample data (events, messages, five role accounts, a student, a staff member awaiting a role) for local development and the tests.
//  - seedEmpty(): what a live installation starts with: departments, venues, screens and ONE administrator.
'use strict';
const { hashPassword } = require('./auth');
const T = require('./time');

const DEMO_PASSWORD = 'UZevents2026';

function reference() {
  const departments = [
    { id: 'reg', name: 'Registrar’s Office', short: 'Registry' },
    { id: 'vc', name: 'Office of the Vice-Chancellor', short: 'VC’s Office' },
    { id: 'eng', name: 'Faculty of Engineering and the Built Environment', short: 'Engineering' },
    { id: 'med', name: 'Faculty of Medicine and Health Sciences', short: 'Medicine' },
    { id: 'sci', name: 'Faculty of Science', short: 'Science' },
    { id: 'law', name: 'Faculty of Law', short: 'Law' },
    { id: 'com', name: 'Faculty of Business Management Sciences and Economics', short: 'Commerce' },
    { id: 'art', name: 'Faculty of Arts and Humanities', short: 'Arts' },
    { id: 'agr', name: 'Faculty of Agriculture, Environment and Food Systems', short: 'Agriculture' },
    { id: 'ict', name: 'Faculty of Computer Engineering, Informatics and Communications', short: 'Computing' },
    { id: 'sport', name: 'Sports and Recreation', short: 'Sports' },
    { id: 'sa', name: 'Student Affairs', short: 'Student Affairs' },
  ];

  // mapPlace: the campus building used for Google Maps directions (public/assets/campus-places.json).
  // Null where no building is chosen yet; administrators can set it under Venues.
  const venues = [
    { id: 'gh', name: 'Great Hall', capacity: 1800, location: 'Central campus', mapPlace: 'w297130203' },
    { id: 'senate', name: 'Senate Chamber', capacity: 120, location: 'Administration Block', mapPlace: 'w297130875' },
    { id: 'lib', name: 'Main Library Auditorium', capacity: 300, location: 'Main Library, Ground floor', mapPlace: 'n4400780491' },
    { id: 'elt', name: 'Engineering Lecture Theatre 1', capacity: 250, location: 'Engineering Building', mapPlace: 'w297776742' },
    { id: 'alt', name: 'New Arts Lecture Theatre', capacity: 400, location: 'Arts Faculty', mapPlace: 'w297130971' },
    { id: 'hub', name: 'Innovation Hub', capacity: 150, location: 'Innovation Hub Building', mapPlace: null },
    { id: 'pav', name: 'Sports Pavilion', capacity: 2500, location: 'Sports grounds', mapPlace: 'w310953631' },
    { id: 'med', name: 'Parirenyatwa Lecture Hall', capacity: 200, location: 'College of Health Sciences', mapPlace: null },
  ];

  const screens = [
    { id: 'reception', name: 'Main Reception', venueId: null },
    { id: 'great-hall', name: 'Great Hall Foyer', venueId: 'gh' },
    { id: 'senate', name: 'Senate Chamber Entrance', venueId: 'senate' },
    { id: 'hub', name: 'Innovation Hub Lobby', venueId: 'hub' },
  ];
  const categories = ['Academic', 'Public lecture', 'Research', 'Ceremonial', 'Cultural', 'Sports', 'Administrative'];
  return { departments, venues, screens, categories };
}

function seed() {
  const today = T.harareNow().slice(0, 10) + 'T00:00';
  const at = (dayOffset, hhmm) => T.addDays(today, dayOffset).slice(0, 11) + hhmm;
  const created = T.addDays(today, -20).slice(0, 11) + '09:00';
  const { departments, venues, screens, categories } = reference();

  const mk = (id, name, email, role, department) => {
    const { salt, hash } = hashPassword(DEMO_PASSWORD);
    return { id, name, email, role, department, salt, hash, active: true, createdAt: created };
  };
  const users = [
    mk('u1', 'Tendai Moyo', 'admin@uz.ac.zw', 'admin', 'reg'),
    mk('u2', 'Dr Rudo Chikore', 'approver.eng@uz.ac.zw', 'approver', 'eng'),
    mk('u3', 'Farai Ncube', 'approver.reg@uz.ac.zw', 'approver', 'reg'),
    mk('u4', 'Nyasha Dube', 'organiser.eng@uz.ac.zw', 'organiser', 'eng'),
    mk('u5', 'Kudzai Mutasa', 'organiser.sa@uz.ac.zw', 'organiser', 'sa'),
    // A sample student (signs in with R2400001) and a staff member who signed up and waits for a role.
    { ...mk('u6', 'Tatenda Sibanda', 'r2400001@students.uz.ac.zw', 'student', 'ict'), regNumber: 'r2400001', saved: [] },
    { ...mk('u7', 'Chipo Mlambo', 'chipo.mlambo@example.com', 'staff', 'art'), saved: [] },
  ];

  let n = 100;
  const ev = (o) => {
    const e = {
      id: 'e' + (++n),
      summary: '', audience: 'Staff, students and invited guests', isPublic: true,
      recurrence: { freq: 'none', until: null },
      status: 'published', createdAt: created, updatedAt: created, submittedAt: created,
      decidedAt: T.addDays(created, 1), reviewNote: '', views: 0, history: [],
      ...o,
    };
    e.history.unshift({ at: created, by: o.createdBy, action: 'created' });
    if (['published', 'submitted', 'returned', 'rejected'].includes(e.status)) {
      e.history.push({ at: created, by: o.createdBy, action: 'submitted' });
    }
    if (e.status === 'published') e.history.push({ at: e.decidedAt, by: 'u3', action: 'approved' });
    if (e.status === 'submitted') { e.decidedAt = null; e.submittedAt = T.addDays(today, -1).slice(0, 11) + '15:20'; }
    if (e.status === 'draft') { e.submittedAt = null; e.decidedAt = null; }
    return e;
  };

  const events = [
    ev({ title: 'Inaugural Lecture: Water Security in a Changing Climate', category: 'Public lecture', departmentId: 'eng', venueId: 'elt',
      start: at(0, '14:00'), end: at(0, '16:00'), createdBy: 'u4', contactName: 'Nyasha Dube', contactEmail: 'organiser.eng@uz.ac.zw',
      summary: 'Professor of Civil Engineering delivers an inaugural lecture on catchment resilience.',
      description: 'An inaugural lecture on the engineering, governance and community dimensions of water security in Southern Africa, followed by questions from the floor.\n\nAll members of the university community and the public are welcome. Seating is on a first-come basis.', views: 214 }),
    ev({ title: 'Senate Meeting', category: 'Administrative', departmentId: 'reg', venueId: 'senate', isPublic: false,
      start: at(1, '09:00'), end: at(1, '13:00'), createdBy: 'u3', contactName: 'Farai Ncube', contactEmail: 'approver.reg@uz.ac.zw',
      audience: 'Members of Senate', description: 'Ordinary meeting of Senate. Papers will be circulated by the Registrar’s Office.' }),
    ev({ title: 'Faculty of Science Research Day', category: 'Research', departmentId: 'sci', venueId: 'lib',
      start: at(2, '08:30'), end: at(2, '16:30'), createdBy: 'u3', contactName: 'Science Faculty Office', contactEmail: 'science@uz.ac.zw',
      summary: 'Poster sessions and short talks from postgraduate researchers.',
      description: 'A day of short talks and poster sessions showcasing postgraduate research across the Faculty of Science. Industry partners are invited to the afternoon panel.', views: 88 }),
    ev({ title: 'Inter-faculty Athletics Championship', category: 'Sports', departmentId: 'sport', venueId: 'pav',
      start: at(4, '08:00'), end: at(4, '17:00'), createdBy: 'u5', contactName: 'Sports Office', contactEmail: 'sports@uz.ac.zw',
      summary: 'Track and field events between faculties.', description: 'Annual inter-faculty athletics. Spectators welcome; refreshments available at the pavilion.', views: 132 }),
    ev({ title: 'Innovation Hub Pitch Night', category: 'Research', departmentId: 'ict', venueId: 'hub',
      start: at(3, '17:30'), end: at(3, '20:00'), createdBy: 'u4', contactName: 'Innovation Hub', contactEmail: 'innovationhub@uz.ac.zw',
      summary: 'Student start-ups pitch to a panel of investors and mentors.',
      description: 'Eight student teams present products developed at the Innovation Hub. The panel includes industry partners and alumni founders.', views: 176 }),
    ev({ title: 'Arts Festival Opening Night', category: 'Cultural', departmentId: 'art', venueId: 'alt',
      start: at(6, '18:00'), end: at(6, '21:00'), createdBy: 'u5', contactName: 'Student Affairs', contactEmail: 'studentaffairs@uz.ac.zw',
      summary: 'Music, poetry and theatre from student groups.', description: 'The opening night of the week-long Arts Festival featuring mbira ensembles, spoken word and a short play by Theatre Arts students.', views: 61 }),
    ev({ title: 'Graduation Ceremony Rehearsal', category: 'Ceremonial', departmentId: 'reg', venueId: 'gh', isPublic: false,
      start: at(8, '09:00'), end: at(8, '12:00'), createdBy: 'u3', contactName: 'Registrar’s Office', contactEmail: 'approver.reg@uz.ac.zw',
      audience: 'Graduands and marshals', description: 'Mandatory rehearsal for graduands and marshals.' }),
    ev({ title: 'Graduation Ceremony', category: 'Ceremonial', departmentId: 'reg', venueId: 'gh',
      start: at(10, '08:00'), end: at(10, '14:00'), createdBy: 'u3', contactName: 'Registrar’s Office', contactEmail: 'approver.reg@uz.ac.zw',
      summary: 'Conferment of degrees, diplomas and certificates.',
      description: 'The Chancellor presides over the conferment of degrees, diplomas and certificates. Graduands should be seated by 07:30. Each graduand may bring two guests.', views: 940 }),
    ev({ title: 'Law Moot Court Final', category: 'Academic', departmentId: 'law', venueId: 'senate',
      start: at(12, '10:00'), end: at(12, '13:00'), createdBy: 'u3', contactName: 'Faculty of Law', contactEmail: 'law@uz.ac.zw',
      description: 'Final round of the internal moot court competition, judged by members of the bench.', views: 47 }),
    ev({ title: 'Public Health Seminar Series', category: 'Academic', departmentId: 'med', venueId: 'med',
      start: at(-6, '12:30'), end: at(-6, '13:30'), createdBy: 'u3', contactName: 'College of Health Sciences', contactEmail: 'chs@uz.ac.zw',
      recurrence: { freq: 'weekly', until: at(40, '23:59') },
      summary: 'Weekly lunchtime seminar.', description: 'A weekly lunchtime seminar on current public health research. Bring your lunch.', views: 302 }),
    ev({ title: 'Careers Fair', category: 'Administrative', departmentId: 'sa', venueId: 'gh',
      start: at(-9, '09:00'), end: at(-9, '15:00'), createdBy: 'u5', contactName: 'Careers Office', contactEmail: 'careers@uz.ac.zw',
      description: 'Employers from finance, engineering, health and the public sector meet final-year students.', views: 512 }),
    ev({ title: 'Agriculture Field Day', category: 'Research', departmentId: 'agr', venueId: 'pav', status: 'cancelled',
      start: at(5, '08:00'), end: at(5, '13:00'), createdBy: 'u3', contactName: 'Faculty of Agriculture', contactEmail: 'agric@uz.ac.zw',
      description: 'Demonstration plots and seed-variety trials.', views: 40 }),
    ev({ title: 'Engineering Open Day', category: 'Public lecture', departmentId: 'eng', venueId: 'elt', status: 'submitted',
      start: at(9, '09:00'), end: at(9, '15:00'), createdBy: 'u4', contactName: 'Nyasha Dube', contactEmail: 'organiser.eng@uz.ac.zw',
      summary: 'Prospective students tour labs and workshops.', description: 'Laboratory tours, design showcases and talks for prospective students and parents.' }),
    ev({ title: 'Hackathon Kick-off', category: 'Research', departmentId: 'eng', venueId: 'hub', status: 'submitted',
      start: at(3, '18:00'), end: at(3, '21:00'), createdBy: 'u4', contactName: 'Nyasha Dube', contactEmail: 'organiser.eng@uz.ac.zw',
      description: 'Opening session for the 48-hour engineering hackathon.' }),
    ev({ title: 'Freshers’ Welcome Braai', category: 'Cultural', departmentId: 'sa', venueId: 'pav', status: 'draft',
      start: at(14, '12:00'), end: at(14, '17:00'), createdBy: 'u5', contactName: 'Kudzai Mutasa', contactEmail: 'organiser.sa@uz.ac.zw',
      description: 'Informal welcome for first-year students.' }),
  ];
  // Mark the cancelled event's history
  const cancelled = events.find(e => e.status === 'cancelled');
  cancelled.history.push({ at: T.addDays(today, -2).slice(0, 11) + '10:00', by: 'u3', action: 'cancelled', note: 'Postponed to next season due to rainfall on the demonstration plots.' });

  const messages = [
    { id: 'm1', guestName: 'Her Excellency the Ambassador of Japan', guestTitle: 'Embassy of Japan in Zimbabwe',
      wording: 'The University of Zimbabwe warmly welcomes Her Excellency and the delegation to the Innovation Hub.',
      eventId: 'e105', screen: 'hub', displayFrom: at(-1, '08:00'), displayUntil: at(3, '21:00'),
      status: 'approved', createdBy: 'u4', createdAt: created, history: [{ at: created, by: 'u4', action: 'created' }, { at: created, by: 'u3', action: 'approved' }] },
    { id: 'm2', guestName: 'Delegation from the Ministry of Higher and Tertiary Education', guestTitle: 'Innovation, Science and Technology Development',
      wording: 'Welcome to the University of Zimbabwe. We are honoured to host you for today’s inaugural lecture.',
      eventId: 'e101', screen: 'reception', displayFrom: at(0, '07:00'), displayUntil: at(0, '18:00'),
      status: 'approved', createdBy: 'u4', createdAt: created, history: [{ at: created, by: 'u4', action: 'created' }, { at: created, by: 'u3', action: 'approved' }] },
    { id: 'm3', guestName: 'Vice-Chancellors of SADC Universities', guestTitle: 'SARUA Leadership Dialogue',
      wording: 'Welcome to the University of Zimbabwe.', eventId: null, screen: 'great-hall',
      displayFrom: at(9, '07:00'), displayUntil: at(10, '18:00'), status: 'submitted', createdBy: 'u4', createdAt: created,
      history: [{ at: created, by: 'u4', action: 'created' }, { at: created, by: 'u4', action: 'submitted' }] },
  ];

  return {
    seq: 2000,
    departments, venues, screens, users, events, messages,
    categories,
    audit: [{ at: created, userId: 'u1', action: 'system.seeded', target: '', detail: 'Sample data loaded' }],
  };
}

// One published event so a new installation has something to open on the calendar:
// two days from installation, 10:00 to 12:00 in the Great Hall (which is on the campus map).
function walkthroughEvent(now, contactEmail) {
  const day = T.addDays(now.slice(0, 10) + 'T00:00', 2).slice(0, 11);
  return {
    id: 'e1', title: 'UZ Events walkthrough', category: 'Administrative', departmentId: 'reg', venueId: 'gh',
    start: day + '10:00', end: day + '12:00',
    summary: 'A short session showing staff and students how to use UZ Events.',
    description: 'A walkthrough of the University of Zimbabwe events system: signing in, reading the calendar, opening an event and finding the way to its venue on the campus map, and how organisers submit events for approval.\n\nThis sample event is created with every new installation so there is something to try. An administrator can cancel or edit it.',
    audience: 'Staff and students', contactName: 'Events Office', contactEmail,
    isPublic: true, recurrence: { freq: 'none', until: null }, status: 'published',
    createdBy: 'u1', createdAt: now, updatedAt: now, submittedAt: now, decidedAt: now, reviewNote: '', views: 0,
    history: [{ at: now, by: 'u1', action: 'created' }, { at: now, by: 'u1', action: 'approved', note: 'Sample event for a new installation' }],
  };
}

// A live installation: one sample event, no messages, one administrator who then invites everyone else.
function seedEmpty({ adminEmail, adminName, adminPassword }) {
  if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) throw new Error('ADMIN_EMAIL must be set to a valid email address for a new installation.');
  if (!adminPassword || String(adminPassword).length < 10) throw new Error('ADMIN_PASSWORD must be set (at least 10 characters) for a new installation.');
  const now = T.harareNow();
  const { departments, venues, screens, categories } = reference();
  const { salt, hash } = hashPassword(String(adminPassword));
  return {
    seq: 1000,
    departments, venues, screens, categories,
    users: [{ id: 'u1', name: adminName || 'System Administrator', email: adminEmail.trim().toLowerCase(), role: 'admin', department: 'reg', salt, hash, active: true, createdAt: now }],
    events: [walkthroughEvent(now, adminEmail.trim().toLowerCase())], messages: [],
    audit: [{ at: now, userId: 'u1', action: 'system.installed', target: '', detail: 'New installation' }],
  };
}

module.exports = { seed, seedEmpty, reference, DEMO_PASSWORD };
