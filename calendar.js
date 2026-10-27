// Reads a Google Calendar through its private iCal address and returns the
// events that overlap a time window, with repeating events expanded.
const ical = require("node-ical");

const dayKeyUTC = d => d.toISOString().slice(0, 10);

function normaliseUrl(raw) {
  const url = String(raw || "").trim().replace(/^webcal:\/\//i, "https://");
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("That doesn't look like a calendar address. Paste the \"Secret address in iCal format\", which starts with https://");
  }
  return url;
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (res.status === 404 || res.status === 403 || res.status === 401) {
    throw new Error("Google refused that address. Copy the secret address again; it changes if you reset it.");
  }
  if (!res.ok) throw new Error(`The calendar couldn't be loaded (error ${res.status}). Try again in a few minutes.`);
  const text = await res.text();
  if (!/BEGIN:VCALENDAR/.test(text)) throw new Error("That address didn't return a calendar. Make sure you copied the iCal address, not the calendar's web link.");
  return text;
}

// Events overlapping [from, to).
function eventsBetween(text, from, to) {
  const data = ical.sync.parseICS(text);
  const out = [];
  const add = (start, end, src, allDay) => {
    if (!(start instanceof Date) || isNaN(start)) return;
    if (end > from && start < to) {
      out.push({
        uid: `${src.uid || src.summary}@${start.toISOString()}`,
        title: String((src.summary && src.summary.val) || src.summary || "Busy").trim(),
        start: start.toISOString(), end: end.toISOString(), allDay,
      });
    }
  };
  for (const ev of Object.values(data)) {
    if (!ev || ev.type !== "VEVENT" || ev.status === "CANCELLED") continue;
    const allDay = ev.datetype === "date";
    const dur = ev.end ? ev.end - ev.start : allDay ? 864e5 : 0;
    if (!ev.rrule) { add(ev.start, new Date(ev.start.getTime() + dur), ev, allDay); continue; }
    // Widen the window by a day each side so time-zone shifts can't drop an occurrence.
    const hits = ev.rrule.between(new Date(from.getTime() - 864e5), new Date(to.getTime() + 864e5), true);
    for (const hit of hits) {
      // For zoned and all-day events, rrule returns this computer's local clock time stored in the
      // UTC fields. Rebuild the real moment from those fields.
      const start = ev.rrule.origOptions.tzid || allDay
        ? new Date(hit.getUTCFullYear(), hit.getUTCMonth(), hit.getUTCDate(), hit.getUTCHours(), hit.getUTCMinutes(), hit.getUTCSeconds())
        : hit;
      const key = dayKeyUTC(start);
      const excluded = ev.exdate && Object.values(ev.exdate).some(x => x instanceof Date && Math.abs(x - start) < 6e4);
      if (excluded) continue;
      const moved = ev.recurrences && (ev.recurrences[key] || Object.values(ev.recurrences).find(r => r.recurrenceid && Math.abs(r.recurrenceid - start) < 6e4));
      if (moved) {
        if (moved.status !== "CANCELLED") add(moved.start, moved.end || new Date(moved.start.getTime() + dur), moved, moved.datetype === "date");
        continue;
      }
      add(start, new Date(start.getTime() + dur), ev, allDay);
    }
  }
  // De-duplicate (an override can also appear as its own VEVENT) and sort.
  const seen = new Set();
  return out.filter(e => { const k = e.title + e.start; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.start.localeCompare(b.start));
}

async function loadEvents(rawUrl, fromISO, toISO) {
  const text = await fetchText(normaliseUrl(rawUrl));
  return eventsBetween(text, new Date(fromISO), new Date(toISO));
}

module.exports = { loadEvents, eventsBetween, normaliseUrl };
