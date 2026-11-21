// Turns a Moxfield snapshot (scripts/moxfield-raw.json, made by
// scripts/moxfield-snapshot.js) into src/_data/decks.json.
//
//   npm run decks
//
// • Points spend is recalculated from src/_data/points.json, so it always
//   matches the list the site shows.
// • Colours come from the mana symbols on the deck page (2+ pips of a colour).
// • Archetype, colours or a display name can be fixed by hand in
//   scripts/deck-overrides.json:  { "<deck id>": { "archetype": "Tempo" } }
//   (also "coverCard": any card name in src/_data/cards.json)
//   Hand edits already in decks.json are kept for decks that are still there.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (p, fallback) => (existsSync(new URL(p, root)) ? JSON.parse(readFileSync(new URL(p, root), "utf8")) : fallback);

const raw = read("scripts/moxfield-raw.json", null);
if (!raw) { console.error("No scripts/moxfield-raw.json yet. Run scripts/moxfield-snapshot.js in your browser first."); process.exit(1); }
const points = Object.fromEntries(read("src/_data/points.json").list.map((c) => [c.name, c.points]));
const prevFile = read("src/_data/decks.json", { decks: [], authors: {} });
const previous = Object.fromEntries((prevFile.decks || []).map((d) => [d.id, d]));
previous.__authors = prevFile.authors || {};
const overrides = read("scripts/deck-overrides.json", {});
// Deck tiles use Scryfall art from src/_data/cards.json (never Moxfield covers),
// so we control exactly which printings appear. Universes Beyond cards are skipped.
const CARDS = read("src/_data/cards.json", {});
const artOk = (name) => !!CARDS[name];
const ARCHETYPE_ART = {
  "Death & Taxes": "Thalia, Guardian of Thraben", "Aggro-prison": "Thalia, Guardian of Thraben",
  Aggro: "Ragavan, Nimble Pilferer", Tempo: "Force of Will", Control: "Force of Will",
  Combo: "Time Vault", "Artifact combo": "Time Vault", Artifacts: "Paradox Engine", "Artifact aggro": "Paradox Engine",
  Reanimator: "Griselbrand", "Creature combo": "Natural Order", Ramp: "Natural Order",
  Blink: "Snapcaster Mage", Midrange: "Fable of the Mirror-Breaker",
};
const usedCovers = new Set();
const pickCover = (pointed, archetype) => {
  const options = pointed.filter(artOk);
  const pick = options.find((c) => !usedCovers.has(c)) || options[0] || ARCHETYPE_ART[archetype] || "Fable of the Mirror-Breaker";
  usedCovers.add(pick);
  return pick;
};
const snapshot = raw.snapshot;

const cleanName = (name) => {
  let n = name.replace(/\s*\|\s*moxfield.*$/i, "");
  while (/\s*[-–]\s*(canlander|canadian highlander)\s*$/i.test(n)) n = n.replace(/\s*[-–]\s*(canlander|canadian highlander)\s*$/i, "");
  n = n.replace(/^canadian highlander\s*[:\-–]\s*/i, "").trim();
  const i = n.indexOf(": ");
  const TAG = "(aggro|combo|control|midrange|creature midrange|stax|tempo|synergy deck|ramp|prison|burn|tribal|value)";
  if (i > 0 && new RegExp(`^${TAG}([ ,]+${TAG})*$`, "i").test(n.slice(i + 2).trim())) n = n.slice(0, i); // drop Moxfield tag lists
  return n.replace(/\s+/g, " ");
};

const daysAgo = (text) => {
  const m = text.match(/(an?|\d+)\s+(minute|hour|day|month|year)s?/i);
  if (!m) return 0;
  const n = /^an?$/i.test(m[1]) ? 1 : parseInt(m[1], 10);
  return { minute: 0, hour: n / 24, day: n, month: n * 30, year: n * 365 }[m[2].toLowerCase()] || 0;
};
const dateFrom = (text) => {
  const d = new Date(snapshot + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - Math.floor(daysAgo(text)));
  return d.toISOString().slice(0, 10);
};

// A colour counts if it's at least 7% of the coloured pips (filters out stray hybrid/Phyrexian symbols).
const colorsFrom = (pips = {}) => {
  const total = Object.values(pips).reduce((a, b) => a + b, 0);
  return ["w", "u", "b", "r", "g"].filter((k) => (pips[k] || 0) >= Math.max(2, total * 0.07)).join("").toUpperCase() || "C";
};

const ARCHETYPES = [
  [/d(eath)?\s*(&|and|n)\s*t(axes)?|\bdnt\b/i, "Death & Taxes"],
  [/blink/i, "Blink"],
  [/tinker|oath|reanimat|storm|combo|breach|scapeshift|lands/i, "Combo"],
  [/control|draw.go/i, "Control"],
  [/tempo|delver|murktide/i, "Tempo"],
  [/ramp|big|eldrazi|tron/i, "Ramp"],
  [/aggro|burn|zoo|sligh|red deck/i, "Aggro"],
  [/artifact|affinity|urza|workshop|student loan/i, "Artifacts"],
  [/midrange|monsters|jund|abzan|good stuff|goodstuff/i, "Midrange"],
];
const archetypeFor = (name, cards = []) => {
  for (const [re, label] of ARCHETYPES) if (re.test(name)) return label;
  if (cards.includes("Tinker") || cards.includes("Oath of Druids")) return "Combo";
  return "Midrange";
};

const authors = {};
const decks = raw.decks.map((d) => {
  const prev = previous[d.id] || {};
  const fix = overrides[d.id] || {};
  if (!d.cards || !d.cards.length) {
    // Page didn't render during the snapshot: keep what we had, if anything.
    if (!prev.id) { console.warn(`  skipped ${d.id} (no data)`); return null; }
    if (!authors[d.author] && previous.__authors?.[d.author]) authors[d.author] = previous.__authors[d.author];
    const { cover, ...rest } = prev;
    return { ...rest, views: d.views ?? prev.views, coverCard: artOk(prev.coverCard) ? prev.coverCard : pickCover([], prev.archetype), pinned: !!d.pinned };
  }
  const pointed = (d.cards || []).filter((c) => points[c]).sort((a, b) => points[b] - points[a] || a.localeCompare(b));
  const sum = pointed.reduce((s, c) => s + points[c], 0);
  const total = Number.isFinite(d.pts) ? d.pts : sum;
  const spend = pointed.map((c) => `${c} ${points[c]}`);
  if (total > sum) spend.push(`+${total - sum} more`);

  if (!authors[d.author]) {
    authors[d.author] = {
      url: `https://moxfield.com/users/${encodeURIComponent(d.author)}`,
      avatar: d.avatar ? d.avatar.replace(/\?s=\d+$/, "?s=96") : null,
    };
  }
  const name = fix.name || cleanName(d.name);
  const archetype = fix.archetype || prev.archetype || archetypeFor(name, d.cards);
  return {
    id: d.id,
    url: d.url || `https://moxfield.com/decks/${d.id}`,
    name,
    colors: fix.colors || (d.pips && Object.keys(d.pips).length ? colorsFrom(d.pips) : prev.colors) || "C",
    archetype,
    coverCard: fix.coverCard && artOk(fix.coverCard) ? fix.coverCard : pickCover(pointed, archetype),
    points: total,
    spend: spend.join(" · ") || "No pointed cards",
    lands: Number.isFinite(d.lands) ? d.lands : prev.lands,
    views: d.views,
    updated: dateFrom(d.updatedText || ""),
    author: d.author,
    pinned: !!d.pinned,
  };
});

decks.splice(0, decks.length, ...decks.filter(Boolean));
const byUpdated = (a, b) => b.updated.localeCompare(a.updated) || (b.views || 0) - (a.views || 0);
decks.sort((a, b) => Number(b.pinned) - Number(a.pinned) || byUpdated(a, b));

const out = {
  _note: "Generated by scripts/build-decks.mjs from a Moxfield snapshot. Pinned decks always lead the rotation. Don't hand-edit: use scripts/deck-overrides.json.",
  snapshot,
  rules: { minViews: 100, pinnedAuthors: [...new Set(decks.filter((d) => d.pinned).map((d) => d.author))] },
  authors,
  decks,
};
// One deck / author per line keeps diffs readable.
const lines = (obj) => Object.entries(obj).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n");
const text = `{
  "_note": ${JSON.stringify(out._note)},
  "snapshot": ${JSON.stringify(out.snapshot)},
  "rules": ${JSON.stringify(out.rules)},
  "authors": {
${lines(out.authors).replace(/^/gm, "  ")}
  },
  "decks": [
${out.decks.map((d) => "    " + JSON.stringify(d)).join(",\n")}
  ]
}
`;
writeFileSync(new URL("src/_data/decks.json", root), text);
console.log(`decks.json: ${decks.filter((d) => d.pinned).length} pinned + ${decks.filter((d) => !d.pinned).length} community decks (snapshot ${snapshot}).`);
