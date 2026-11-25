// All event times are stored as local Harare wall-clock strings "YYYY-MM-DDTHH:MM".
// Zimbabwe has no daylight saving, so string comparison is a correct ordering.
'use strict';

function harareNow() {
  const s = new Date().toLocaleString('sv-SE', { timeZone: 'Africa/Harare' });
  return s.replace(' ', 'T').slice(0, 16);
}

function parse(s) {
  const [d, t = '00:00'] = s.split('T');
  const [y, m, dd] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, dd, hh, mm));
}

function fmt(date) {
  return date.toISOString().slice(0, 16);
}

function addDays(s, n) {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

function addMonths(s, n) {
  const d = parse(s);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return fmt(d);
}

function minutesBetween(a, b) {
  return (parse(b) - parse(a)) / 60000;
}

const VALID = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
function isValid(s) {
  if (typeof s !== 'string' || !VALID.test(s)) return false;
  return fmt(parse(s)) === s;
}

module.exports = { harareNow, parse, fmt, addDays, addMonths, minutesBetween, isValid };
