// Game rules and saved state, shared by the dashboard and the desktop buddy.
// Every change goes load -> modify -> save so both windows stay in sync.
(function () {
  const KEY = "pitchpal.v1";
  const NAMES = { energy: "Energy", fitness: "Fitness", morale: "Morale" };
  const COLORS = { energy: "#5cc8ff", fitness: "#5fe08f", morale: "#ff8fc8" };
  const DIVISIONS = [
    { xp: 0, name: "Sunday League", cap: 500 },
    { xp: 15, name: "Division 3", cap: 5000 },
    { xp: 50, name: "Division 2", cap: 15000 },
    { xp: 120, name: "Division 1", cap: 35000 },
    { xp: 250, name: "Premier", cap: 60000 },
    { xp: 500, name: "Legend", cap: 90000 },
  ];
  const MISS_PENALTY = 18, DONE_BONUS = 12, DAILY_DECAY = 4;
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const pad = n => String(n).padStart(2, "0");
  const dayKey = d => { const x = new Date(d); return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); };
  const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = parseKey(k); return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)); };
  const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
  const now = s => new Date(Date.now() + (s.offset || 0) * 864e5);
  const uid = () => Math.random().toString(36).slice(2, 9);
  const clamp = v => Math.max(0, Math.min(100, Math.round(v)));

  function fresh() {
    const today = dayKey(new Date());
    return {
      name: "Rico", number: 10, kit: "#e63946", skin: "#f7d1b5", hair: "#3b2618",
      stats: { energy: 70, fitness: 62, morale: 75 },
      tasks: [
        { id: uid(), name: "Drink 8 glasses of water", stat: "energy", done: true },
        { id: uid(), name: "30 minute workout", stat: "fitness", done: false, days: [1, 3, 5] },
        { id: uid(), name: "In bed by 11pm", stat: "energy", done: false },
        { id: uid(), name: "Read 20 pages", stat: "morale", done: true },
      ],
      xp: 2, streak: 0, best: 0, matchday: 1, cheerUntil: 0, remindAt: "18:00", snoozeUntil: 0,
      lastDay: today, offset: 0, notified: "", sound: true,
      log: [{ d: today, t: "Signed for the club. First training session today." }],
    };
  }

  // In-memory copy keeps the game working where storage is blocked.
  let mem = null;
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.stats) mem = s; } catch (e) {}
    if (!mem) { mem = fresh(); save(mem); }
    mem.skin = mem.skin || "#f7d1b5"; mem.hair = mem.hair || "#3b2618";
    if (mem.notified && !mem.sent) mem.sent = { evening: mem.notified };
    mem.history = mem.history || {}; mem.rest = mem.rest || {}; mem.badges = mem.badges || {};
    mem.totals = mem.totals || { wins: 0, draws: 0, losses: 0, promotions: 0, titles: 0, seasons: 0, fullDays: 0 };
    mem.toasts = mem.toasts || []; mem.extras = mem.extras || {};
    if (!mem.league) mem.league = newLeague(xpTier(mem), 1);
    return mem;
  }
  function save(s) { mem = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function update(fn) { const s = load(); fn(s); awardBadges(s); save(s); return s; }

  const addLog = (s, d, t) => { s.log.unshift({ d, t }); s.log = s.log.slice(0, 80); };

  // ---------- schedules and rest days ----------
  // task.days lists the weekdays it's due (0 = Sunday). No list means every day.
  const scheduledOn = (t, date) => t.cal || !t.days || !t.days.length || t.days.includes(date.getDay());
  const todayTasks = s => s.tasks.filter(t => scheduledOn(t, now(s)));
  const isRest = (s, key) => !!(s.rest && s.rest[key]);
  // One rest day per week.
  function canRest(s) {
    const start = dayKey(weekStart(now(s))), today = dayKey(now(s));
    return !Object.keys(s.rest || {}).some(k => k >= start && k <= addDays(start, 6) && k !== today);
  }
  function setRest(on) {
    update(s => {
      const k = dayKey(now(s));
      if (on && canRest(s)) { s.rest[k] = true; addLog(s, k, `Rest day. ${s.name} puts the feet up; no penalties today.`); }
      if (!on) delete s.rest[k];
    });
  }

  // ---------- the end of each day ----------
  function evaluateDay(s, day, tasks) {
    const date = parseKey(day);
    const due = tasks.filter(t => scheduledOn(t, date)), missed = due.filter(t => !t.done);
    const rest = isRest(s, day);
    if (!rest) {
      for (const k in s.stats) s.stats[k] = clamp(s.stats[k] - DAILY_DECAY);
      for (const t of missed) s.stats[t.stat] = clamp(s.stats[t.stat] - MISS_PENALTY);
    }
    s.matchday++;
    if (rest) { /* streak paused */ }
    else if (due.length && !missed.length) {
      s.streak++; s.best = Math.max(s.best, s.streak); s.totals.fullDays++;
      addLog(s, day, `Full session completed. Streak now ${s.streak}.`);
    } else if (due.length) {
      if (s.streak >= 3) addLog(s, day, `Streak of ${s.streak} broken.`);
      s.streak = 0;
      addLog(s, day, `Missed ${missed.length}: ${missed.map(t => t.name).join(", ")}.`);
    }
    s.history[day] = { done: due.length - missed.length, total: due.length, rest, e: s.stats.energy, f: s.stats.fitness, m: s.stats.morale };
    const keys = Object.keys(s.history).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 400))) delete s.history[k];
    // A week ends: Match Day.
    if (dayKey(weekStart(date)) === addDays(day, -6)) playMatch(s, day);
  }
  function rollover() {
    let changed = false;
    update(s => {
      const today = dayKey(now(s));
      const gap = daysBetween(s.lastDay, today);
      if (gap <= 0) return;
      evaluateDay(s, s.lastDay, s.tasks);
      // Calendar tasks only last for their own day.
      s.tasks = s.tasks.filter(t => !t.cal);
      // Whole days with the app closed count as fully missed.
      for (let i = 1; i < Math.min(gap, 30); i++) {
        evaluateDay(s, addDays(s.lastDay, i), s.tasks.map(t => ({ ...t, done: false })));
      }
      s.tasks.forEach(t => t.done = false);
      if (s.cal) s.cal.events = [];
      s.lastDay = today;
      changed = true;
    });
    return changed;
  }

  // ---------- league and Match Day ----------
  const TOWNS = ["Millbrook", "Kingsport", "Ashford", "Riverton", "Hollowmere", "Stonebridge", "Elmwood", "Bayside", "Fairhaven", "Northgate",
    "Oakridge", "Westfield", "Brightwater", "Redcliffe", "Pinecrest", "Larkhill", "Cobble Bay", "Thornbury", "Marshfield", "Glenhurst", "Silverdale", "Harrowgate"];
  const SUFFIX = ["United", "Rovers", "Athletic", "City", "Town", "Wanderers", "Albion", "FC", "Rangers", "Harriers"];
  function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
  const hashStr = str => [...String(str)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
  const xpTier = s => { let i = 0; DIVISIONS.forEach((d, j) => { if ((s.xp || 0) >= d.xp) i = j; }); return i; };

  function newLeague(tier, season, old) {
    const r = rng(hashStr("season" + season + tier + Date.now()));
    const names = new Set();
    while (names.size < 7) names.add(TOWNS[Math.floor(r() * TOWNS.length)] + " " + SUFFIX[Math.floor(r() * SUFFIX.length)]);
    const base = 0.4 + 0.05 * tier;
    const clubs = [{ name: null, you: true }, ...[...names].map(name => ({ name, rating: Math.max(0.15, Math.min(0.9, base + (r() - 0.5) * 0.36)) }))]
      .map(c => ({ ...c, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }));
    // Round robin for 8 clubs (circle method): 7 rounds, everyone plays everyone once.
    const ids = [0, 1, 2, 3, 4, 5, 6, 7], fixtures = [];
    for (let rd = 0; rd < 7; rd++) {
      const pairs = [];
      for (let i = 0; i < 4; i++) { const a = ids[i], b = ids[7 - i]; pairs.push(rd % 2 ? [b, a] : [a, b]); }
      fixtures.push(pairs);
      ids.splice(1, 0, ids.pop());
    }
    return { tier, season, round: 0, clubs, fixtures, last: (old && old.last) || null, seasonEnd: (old && old.seasonEnd) || null, past: (old && old.past) || [] };
  }
  function poisson(l, r) { let k = 0, p = 1; const L = Math.exp(-l); do { k++; p *= r(); } while (p > L && k < 9); return k - 1; }
  const goalsFor = (a, b, r) => poisson(Math.max(0.2, 0.35 + 2.6 * a - 1.5 * b), r);
  function record(c, gf, ga) {
    c.p++; c.gf += gf; c.ga += ga;
    if (gf > ga) { c.w++; c.pts += 3; } else if (gf === ga) { c.d++; c.pts += 1; } else c.l++;
  }
  const clubName = (s, c) => c.you ? (s.club || "Pitch Pal FC") : c.name;
  const table = (s, L = s.league) => L.clubs.map((c, i) => ({ ...c, i, name: clubName(s, c) }))
    .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name));

  // How the week went: share of scheduled tasks done (rest days don't count against you).
  function weekForm(s, endDay) {
    let done = 0, total = 0;
    for (let i = 0; i < 7; i++) { const h = s.history[addDays(endDay, -i)]; if (h && !h.rest) { done += h.done; total += h.total; } }
    return { rate: total ? done / total : 0.5, done, total };
  }
  function playMatch(s, endDay) {
    const L = s.league, r = rng(hashStr(endDay + "/" + L.season + "/" + L.round));
    const wf = weekForm(s, endDay);
    const you = 0.12 + 0.62 * wf.rate + 0.26 * (avg(s) / 100);
    let mine = null;
    for (const [a, b] of L.fixtures[L.round]) {
      const A = L.clubs[a], B = L.clubs[b];
      const sa = A.you ? you : A.rating, sb = B.you ? you : B.rating;
      const ga = goalsFor(sa, sb, r), gb = goalsFor(sb, sa, r);
      record(A, ga, gb); record(B, gb, ga);
      if (A.you || B.you) {
        const home = A.you, gf = home ? ga : gb, gag = home ? gb : ga, opp = home ? B : A;
        const goals = [...Array(gf).fill(true), ...Array(gag).fill(false)].map(us => ({ us, min: 1 + Math.floor(r() * 90) })).sort((x, y) => x.min - y.min);
        goals.forEach(g => { g.scorer = g.us ? (r() < 0.55 ? s.name : "a teammate") : opp.name; });
        mine = { day: endDay, season: L.season, round: L.round + 1, opp: opp.name, home, gf, ga: gag, goals, rate: wf.rate, seen: false };
      }
    }
    L.last = mine; L.round++;
    const res = mine.gf > mine.ga ? "won" : mine.gf === mine.ga ? "drew" : "lost";
    s.totals[res === "won" ? "wins" : res === "drew" ? "draws" : "losses"]++;
    addLog(s, endDay, `Match day ${mine.round}: ${s.club || "Pitch Pal FC"} ${mine.gf}-${mine.ga} ${mine.opp}. ${res === "won" ? "A win!" : res === "drew" ? "A draw." : "A loss."} (${Math.round(wf.rate * 100)}% of the week's training done)`);
    if (L.round >= 7) endSeason(s, endDay);
  }
  function endSeason(s, day) {
    const L = s.league, t = table(s), pos = t.findIndex(c => c.you) + 1, tier = L.tier;
    const promoted = pos <= 2 && tier < DIVISIONS.length - 1, relegated = pos >= 7 && tier > 0, champion = pos === 1;
    s.totals.seasons++;
    if (champion) s.totals.titles++;
    if (promoted) s.totals.promotions++;
    const next = promoted ? tier + 1 : relegated ? tier - 1 : tier;
    const summary = { season: L.season, division: DIVISIONS[tier].name, pos, pts: t[pos - 1].pts, promoted, relegated, champion, to: DIVISIONS[next].name, seen: false };
    addLog(s, day, `Season ${L.season} over: finished ${ordinal(pos)} in ${DIVISIONS[tier].name}.` + (promoted ? ` Promoted to ${DIVISIONS[next].name}!` : relegated ? ` Relegated to ${DIVISIONS[next].name}.` : ""));
    const past = [...(L.past || []), { season: L.season, division: DIVISIONS[tier].name, pos, pts: summary.pts }].slice(-20);
    s.league = newLeague(next, L.season + 1, { last: L.last, seasonEnd: summary, past });
  }
  const ordinal = n => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
  const nextFixture = s => {
    const L = s.league; if (L.round >= 7) return null;
    const pair = L.fixtures[L.round].find(([a, b]) => L.clubs[a].you || L.clubs[b].you);
    const home = L.clubs[pair[0]].you, opp = L.clubs[home ? pair[1] : pair[0]];
    return { opp: opp.name, home, round: L.round + 1, day: addDays(dayKey(weekStart(now(s))), 6) };
  };

  // ---------- derived ----------
  const avg = s => (s.stats.energy + s.stats.fitness + s.stats.morale) / 3;
  function division(s) {
    const i = s.league ? s.league.tier : xpTier(s);
    return { ...DIVISIONS[i], tier: i };
  }
  const attendance = s => Math.max(0.03, Math.min(1, avg(s) / 100 * 0.75 + Math.min(s.streak, 14) / 14 * 0.25));
  function mood(s) {
    const a = avg(s), low = Math.min(s.stats.energy, s.stats.fitness, s.stats.morale);
    if (isRest(s, dayKey(now(s)))) return { k: "steady", label: "Resting", color: "#eef2ff", q: `${s.name} is taking a rest day. Recovery is part of training.`, short: "Rest day..." };
    if (low <= 5 || a < 20) return { k: "injured", label: "Injured", color: "#ff6b6b", q: `${s.name} is on the treatment table. Finish today's tasks to start the recovery.`, short: "Ouch... I need you!" };
    if (a < 45) return { k: "struggling", label: "Out of form", color: "#ffb347", q: `${s.name} looks heavy-legged. The fans are drifting home.`, short: "So tired..." };
    if (a < 75) return { k: "steady", label: "Match fit", color: "#eef2ff", q: `${s.name} is ticking over nicely. A full session would lift the crowd.`, short: "Ready to train!" };
    return { k: "fire", label: "On fire", color: "#5fe08f", q: `${s.name} is juggling for the crowd. Keep the streak going.`, short: "I'm on fire!" };
  }

  function toggleTask(id, done) {
    update(s => {
      const t = s.tasks.find(x => x.id === id); if (!t || t.done === done) return;
      t.done = done;
      const sign = done ? 1 : -1;
      s.stats[t.stat] = clamp(s.stats[t.stat] + sign * DONE_BONUS);
      s.xp = Math.max(0, s.xp + sign);
      const due = todayTasks(s);
      if (done && due.length && due.every(x => x.done)) {
        s.cheerUntil = Date.now() + 6000;
        if (now(s).getHours() < 12) s.earlyBird = true;
      }
    });
  }

  // ---------- badges and unlocks ----------
  const BADGES = [
    { id: "first_touch", name: "First touch", icon: "ball", how: "Finish your first task.", test: s => s.xp >= 1 },
    { id: "full_day", name: "Full session", icon: "star", how: "Finish every task in a day.", test: s => s.totals.fullDays >= 1 || (todayTasks(s).length && todayTasks(s).every(t => t.done)) },
    { id: "streak3", name: "Hat-trick", icon: "flame", how: "Reach a 3-day streak.", test: s => s.best >= 3 },
    { id: "streak7", name: "Golden week", icon: "boot", how: "Reach a 7-day streak.", test: s => s.best >= 7, unlock: "Golden boots" },
    { id: "streak30", name: "Iron will", icon: "shield", how: "Reach a 30-day streak.", test: s => s.best >= 30 },
    { id: "tasks50", name: "Captain material", icon: "band", how: "Finish 50 tasks.", test: s => s.xp >= 50, unlock: "Captain's armband" },
    { id: "tasks200", name: "Club legend", icon: "medal", how: "Finish 200 tasks.", test: s => s.xp >= 200 },
    { id: "first_win", name: "First win", icon: "ball", how: "Win a Match Day.", test: s => s.totals.wins >= 1, unlock: "Floodlights" },
    { id: "wins5", name: "Five-star form", icon: "star", how: "Win 5 matches.", test: s => s.totals.wins >= 5, unlock: "Big screen" },
    { id: "promoted", name: "Going up!", icon: "arrow", how: "Win promotion.", test: s => s.totals.promotions >= 1 },
    { id: "champion", name: "Champions", icon: "trophy", how: "Finish top of a league.", test: s => s.totals.titles >= 1, unlock: "Crown and trophy" },
    { id: "season", name: "Full season", icon: "medal", how: "Play a whole season.", test: s => s.totals.seasons >= 1, unlock: "Gold version palette" },
    { id: "early", name: "Early bird", icon: "sun", how: "Finish all of a day's tasks before noon.", test: s => !!s.earlyBird },
    { id: "rest", name: "Recovery", icon: "moon", how: "Take a rest day.", test: s => Object.keys(s.rest || {}).length >= 1 },
    { id: "organised", name: "Organised", icon: "cal", how: "Connect your calendar.", test: s => !!(s.cal && s.cal.url) },
    { id: "bookworm", name: "Bookworm", icon: "book", how: "Read 10 passages in Daily reading.", test: s => (s.readCount || 0) >= 10 },
  ];
  const UNLOCKS = { goldBoots: "streak7", armband: "tasks50", crown: "champion", trophy: "champion", gold: "season", floodlights: "first_win", bigscreen: "wins5" };
  const unlocked = (s, key) => !!s.badges[UNLOCKS[key]];
  function awardBadges(s) {
    if (!s.badges || !s.totals) return;
    for (const b of BADGES) {
      if (s.badges[b.id]) continue;
      let ok = false; try { ok = b.test(s); } catch (e) {}
      if (ok) { s.badges[b.id] = dayKey(now(s)); s.toasts.push({ kind: "badge", id: b.id }); addLog(s, dayKey(now(s)), `Badge earned: ${b.name}${/[.!?]$/.test(b.name) ? "" : "."}` + (b.unlock ? ` Unlocked: ${b.unlock}.` : "")); }
    }
  }

  // ---------- reminders ----------
  // Two daily nudges, each shown once a day if tasks are still open:
  // "active" at midday (only while a Fitness task is open) and "evening" later on.
  // An empty time turns that nudge off.
  const remindTimes = s => ({
    active: s.activeAt === undefined ? "12:30" : s.activeAt,
    evening: s.remindAt === undefined ? "18:00" : s.remindAt,
  });
  const minutes = v => { if (!v) return Infinity; const [h, m] = v.split(":").map(Number); return h * 60 + m; };
  function reminderDue() {
    const s = load(), d = now(s), key = dayKey(d), mins = d.getHours() * 60 + d.getMinutes();
    const left = todayTasks(s).filter(t => !t.done);
    if (!left.length || inEventNow(s) || isRest(s, key)) return null;
    if (s.snoozeUntil) return Date.now() >= s.snoozeUntil ? (s.lastSlot || "evening") : null;
    const sent = s.sent || {}, at = remindTimes(s);
    if (sent.evening !== key && mins >= minutes(at.evening)) return "evening";
    if (sent.active !== key && mins >= minutes(at.active) && mins < minutes(at.evening) && left.some(t => t.stat === "fitness")) return "active";
    return null;
  }
  // show: the desktop app's popup. Without it, fall back to a system notification.
  function remind(show) {
    const slot = reminderDue();
    if (!slot) return;
    const s = update(x => { x.sent = { ...(x.sent || {}), [slot]: dayKey(now(x)) }; x.lastSlot = slot; x.snoozeUntil = 0; });
    if (show) return show();
    if (!("Notification" in window)) return;
    const left = todayTasks(s).filter(t => !t.done).length;
    const send = () => { try { new Notification(`${s.name} needs you`, { body: `${left} training task${left > 1 ? "s" : ""} left today.` }); } catch (e) {} };
    if (Notification.permission === "granted") send();
    else if (Notification.permission !== "denied") Notification.requestPermission().then(p => p === "granted" && send()).catch(() => {});
  }
  // Wording for the reminder: nudge toward exercise first, then any open task.
  function nudge(s) {
    const left = todayTasks(s).filter(t => !t.done), m = mood(s).k;
    const active = left.find(t => t.stat === "fitness");
    if (!left.length) return { title: "All done today!", text: `${s.name} is proud of you.` };
    if (m === "injured") return { title: `${s.name} is hurt!`, text: "Finishing a task today starts the recovery." };
    if (s.lastSlot === "evening") return { title: "Evening check-in!", text: `${left.length} task${left.length > 1 ? "s" : ""} left before midnight. Missed ones drain ${s.name}'s stats.` };
    if (active) return { title: "Time to get active!", text: `${s.name} wants to train with you. Start with "${active.name}".` };
    return { title: "Training time!", text: `${left.length} task${left.length > 1 ? "s" : ""} left today. Knock one out now.` };
  }

  // ---------- Google Calendar ----------
  // s.cal = { url, mode: "active" | "all" | "none", quiet, events, week, lastSync, error }
  const STAT_WORDS = {
    fitness: /\b(gym|work ?out|run|running|jog|practice|training|train|soccer|football|futbol|match|game|swim|bike|cycl|yoga|hike|walk|lift|sport|exercise|fitness|pilates|tennis|basketball|stretch|cardio|spin|climb)/i,
    energy: /\b(sleep|nap|rest|meditat|bed|doctor|dentist|check-?up)/i,
  };
  const statFor = title => STAT_WORDS.fitness.test(title) ? "fitness" : STAT_WORDS.energy.test(title) ? "energy" : "morale";
  const fmtTime = iso => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  // Keep today's calendar tasks in step with today's events.
  function mergeCalendarTasks(s) {
    const mode = s.cal.mode || "active";
    const wanted = (s.cal.events || []).filter(e => mode === "all" || (mode === "active" && statFor(e.title) === "fitness"));
    const ids = new Set(wanted.map(e => "cal-" + e.uid));
    s.tasks = s.tasks.filter(t => !t.cal || ids.has(t.id) || t.done);
    for (const e of wanted) {
      const id = "cal-" + e.uid;
      const name = e.allDay ? e.title : `${e.title} (${fmtTime(e.start)})`;
      const t = s.tasks.find(x => x.id === id);
      if (t) t.name = name;
      else s.tasks.push({ id, name, stat: statFor(e.title), done: false, cal: true });
    }
  }

  // First day of the week for this computer's region (Sunday in the US, Monday in most of Europe).
  function weekStart(d, shift = 0) {
    let first = 7;
    try { const loc = new Intl.Locale(navigator.language || "en-US"); const wi = loc.getWeekInfo ? loc.getWeekInfo() : loc.weekInfo; if (wi && wi.firstDay) first = wi.firstDay; } catch (e) {}
    const day = d.getDay() || 7, back = (day - first + 7) % 7;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back + shift * 7);
  }
  const cleanError = e => String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
  // Events for any week: shift 0 is this week, -1 last week, 1 next week.
  async function weekEvents(shift = 0) {
    const s = load(), start = weekStart(now(s), shift);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    const events = await window.desktop.fetchCalendar(s.cal.url, start.toISOString(), end.toISOString());
    return { start: start.toISOString(), events };
  }
  // One fetch covers the whole week; today's slice drives tasks and quiet time.
  async function syncCalendar() {
    const s = load();
    if (!s.cal || !s.cal.url) return { ok: false };
    if (!window.desktop || !window.desktop.fetchCalendar) return { ok: false, error: "Calendar sync works in the desktop app." };
    const d = now(s), from = new Date(d.getFullYear(), d.getMonth(), d.getDate()), to = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    try {
      const week = await weekEvents(0);
      const today = week.events.filter(e => new Date(e.end) > from && new Date(e.start) < to);
      update(x => { x.cal.week = week; x.cal.events = today; x.cal.lastSync = Date.now(); x.cal.error = ""; mergeCalendarTasks(x); });
      return { ok: true, count: today.length };
    } catch (e) {
      const msg = cleanError(e);
      update(x => { x.cal.error = msg; });
      return { ok: false, error: msg };
    }
  }

  // True while a timed calendar event is happening, so reminders wait.
  function inEventNow(s) {
    if (!s.cal || s.cal.quiet === false) return false;
    const t = Date.now();
    return (s.cal.events || []).some(e => !e.allDay && new Date(e.start) <= t && t < new Date(e.end));
  }

  // The "Skip a day" test button shifts the game's clock. The installed app always uses the real date.
  function clearTestOffset() {
    update(s => {
      if (!s.offset) return;
      s.offset = 0;
      const today = dayKey(new Date());
      if (s.lastDay > today) s.lastDay = today;
    });
  }

  // ---------- backups ----------
  const exportData = () => JSON.stringify({ app: "Pitch Pal", version: 1, savedAt: new Date().toISOString(), state: load() }, null, 1);
  function importData(text) {
    let d; try { d = JSON.parse(text); } catch (e) { throw new Error("That file isn't a Pitch Pal backup."); }
    const st = d && d.state;
    if (!st || !st.stats || !Array.isArray(st.tasks)) throw new Error("That file isn't a Pitch Pal backup.");
    mem = null; save(st); return load();
  }

  window.PP = {
    KEY, NAMES, COLORS, DIVISIONS, DAY_NAMES, BADGES, UNLOCKS, fresh, load, save, update, rollover, remind, reminderDue, remindTimes, nudge,
    clearTestOffset, toggleTask, scheduledOn, todayTasks, canRest, setRest, isRest, unlocked, awardBadges,
    syncCalendar, mergeCalendarTasks, inEventNow, statFor, fmtTime, weekStart, weekEvents, cleanError,
    table, nextFixture, weekForm, ordinal, exportData, importData,
    avg, division, attendance, mood, dayKey, parseKey, addDays, uid, now,
  };
})();
