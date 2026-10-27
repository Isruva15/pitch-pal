// Builds news.json for the phone/web version: fetches the four feeds on GitHub's servers,
// using the same parser as the app. Usage: node scripts/build-news.js <output file>
// Set FEED_FIXTURES=<folder> to read local sample feeds instead of the internet (for testing).
const fs = require("fs"), path = require("path");
const { DOMParser } = require("linkedom");

global.window = global;
global.DOMParser = DOMParser;
global.localStorage = { getItem: () => null, setItem: () => {} };
require(path.join(__dirname, "..", "news.js"));

const fixtures = process.env.FEED_FIXTURES;
async function getText(url) {
  if (fixtures) {
    const host = new URL(url).hostname;
    const file = path.join(fixtures, host + ".xml");
    if (!fs.existsSync(file)) throw new Error("no sample for " + host);
    return fs.readFileSync(file, "utf8");
  }
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PitchPalNews/1.0)", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`The feed answered with error ${res.status}.`);
  return res.text();
}

(async () => {
  const out = process.argv[2] || "news.json";
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(out, "utf8")); } catch (e) {}
  const data = await window.News.collect(getText, prev);
  fs.writeFileSync(out, JSON.stringify(data));
  const counts = {};
  data.items.forEach(a => counts[a.src] = (counts[a.src] || 0) + 1);
  console.log("stories:", JSON.stringify(counts), "errors:", JSON.stringify(data.errors));
})();
