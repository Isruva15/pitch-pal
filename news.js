// Daily news: reads the sources' RSS feeds (through the desktop app, which can reach them),
// turns them into a simple list, and keeps the last result so the page opens instantly.
(function () {
  const KEY = "pitchpal.news";
  const SOURCES = [
    { id: "ap", name: "AP News", short: "AP", urls: [
      "https://flipboard.com/@associatedpress/top-stories-u7govdf1z.rss",
      "https://news.google.com/rss/search?q=when:24h+site:apnews.com&hl=en-US&gl=US&ceid=US:en",
    ] },
    { id: "npr", name: "NPR News", short: "NPR", urls: ["https://feeds.npr.org/1001/rss.xml"] },
    { id: "guardian", name: "Guardian Premier League", short: "GUARDIAN", urls: ["https://www.theguardian.com/football/premierleague/rss"] },
    { id: "bbc", name: "BBC Sport Football", short: "BBC", urls: ["https://feeds.bbci.co.uk/sport/football/rss.xml"] },
  ];
  const PER_SOURCE = 25, MAX_AGE = 30 * 60000;

  // Child elements by local name, ignoring namespace prefixes (media:, dc:, content:).
  const kids = (el, name) => [...el.children].filter(n => n.localName === name);
  // Element text including CDATA sections (some XML parsers leave CDATA out of textContent).
  const txt = el => el ? [...el.childNodes].map(n => n.nodeType === 4 ? n.nodeValue : n.textContent).join("") : "";
  const first = (el, ...names) => { for (const n of names) { const k = kids(el, n)[0]; if (k) return k; } return null; };
  const htmlText = html => {
    const d = new DOMParser().parseFromString("<!doctype html><html><body>" + String(html || "") + "</body></html>", "text/html");
    return (d.body.textContent || "").replace(/\s+/g, " ").trim();
  };
  const firstImg = html => {
    const m = /<img[^>]+src=["']([^"']+)["']/i.exec(String(html || "")); return m ? m[1] : "";
  };

  function parseFeed(xml, src) {
    const doc = new DOMParser().parseFromString(xml, "text/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("The feed couldn't be read.");
    const items = [...doc.getElementsByTagName("item"), ...doc.getElementsByTagName("entry")];
    return items.map(it => {
      let title = txt(first(it, "title"));
      title = htmlText(title).replace(/\s+[-|]\s+(AP News|Associated Press)$/i, "");
      const linkEl = kids(it, "link").find(l => !l.getAttribute("rel") || l.getAttribute("rel") === "alternate") || first(it, "link");
      const link = (linkEl && (linkEl.getAttribute("href") || txt(linkEl)) || "").trim();
      const dateEl = first(it, "pubDate", "published", "updated", "date");
      const date = dateEl ? new Date(txt(dateEl).trim()) : null;
      const descEl = first(it, "description", "summary", "encoded", "content");
      const descHtml = txt(descEl);
      let summary = htmlText(descHtml).replace(/Continue reading\.*$/i, "").trim();
      if (src.id === "ap" && /news\.google\.com/.test(link)) summary = ""; // Google's description only repeats the headline
      if (summary.toLowerCase().startsWith(title.toLowerCase().slice(0, 40))) summary = summary.slice(title.length).trim();
      if (summary.length > 240) summary = summary.slice(0, 237).replace(/\s+\S*$/, "") + "...";
      // Pick the widest image the feed offers.
      let img = "", best = -1;
      for (const m of [...kids(it, "content"), ...kids(it, "thumbnail")]) {
        const url = m.getAttribute("url"), type = m.getAttribute("type") || "", medium = m.getAttribute("medium") || "";
        if (!url || (type && !type.startsWith("image")) || (medium && medium !== "image")) continue;
        const w = parseInt(m.getAttribute("width")) || 0;
        if (w > best && (w <= 1200 || best < 0)) { best = w; img = url; }
      }
      for (const g of kids(it, "group")) for (const m of [...kids(g, "content"), ...kids(g, "thumbnail")]) if (!img && m.getAttribute("url")) img = m.getAttribute("url");
      const enc = kids(it, "enclosure").find(e => (e.getAttribute("type") || "").startsWith("image"));
      if (!img && enc) img = enc.getAttribute("url");
      if (!img) img = firstImg(descHtml) || firstImg(txt(first(it, "encoded")));
      return { src: src.id, title, link, date: date && !isNaN(date) ? date.toISOString() : "", summary, img };
    }).filter(a => a.title && /^https?:\/\//.test(a.link)).slice(0, PER_SOURCE);
  }

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

  async function fetchSource(src, getText) {
    let lastErr = null;
    for (const url of src.urls) {
      try {
        const items = parseFeed(await getText(url), src);
        if (items.length) return items;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("No stories right now.");
  }

  // Read every source; keep the previous stories for any source that fails this time.
  async function collect(getText, prev) {
    const results = await Promise.allSettled(SOURCES.map(src => fetchSource(src, getText)));
    const items = [], errors = {};
    results.forEach((r, i) => {
      const id = SOURCES[i].id;
      if (r.status === "fulfilled") items.push(...r.value);
      else {
        errors[id] = String(r.reason && r.reason.message || r.reason).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
        if (prev) items.push(...prev.items.filter(a => a.src === id));
      }
    });
    const seen = new Set();
    return {
      fetchedAt: Date.now(), errors,
      items: items.filter(a => !seen.has(a.link) && seen.add(a.link)).sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    };
  }

  // The PC app reads the feeds itself. The phone/web version reads news.json, which a
  // GitHub workflow rebuilds every hour next to the app (news sites block direct reads from web pages).
  async function refresh(force) {
    const prev = load();
    if (!force && prev && Date.now() - prev.fetchedAt < MAX_AGE) return prev;
    if (window.desktop && window.desktop.fetchFeed) {
      const data = await collect(url => window.desktop.fetchFeed(url), prev);
      save(data); return data;
    }
    if (!/^https?:$/.test(location.protocol)) return prev || { items: [], errors: {}, fetchedAt: 0, offline: true };
    try {
      const res = await fetch("news.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`error ${res.status}`);
      const data = await res.json();
      if (!data || !Array.isArray(data.items)) throw new Error("no stories");
      save(data); return data;
    } catch (e) {
      return prev || { items: [], errors: {}, fetchedAt: 0, offline: true };
    }
  }

  window.News = { SOURCES, parseFeed, collect, refresh, load };
})();
