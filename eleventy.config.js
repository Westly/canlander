import { readFileSync } from "node:fs";

const CARDS = JSON.parse(readFileSync(new URL("./src/_data/cards.json", import.meta.url), "utf8"));

export default function (eleventyConfig) {
  // Scryfall card images (hotlinked from Scryfall's image CDN; ids live in src/_data/cards.json)
  const scry = (name, size = "normal") => {
    const c = CARDS[name];
    if (!c) throw new Error(`Card "${name}" is missing from src/_data/cards.json`);
    const ext = size === "png" ? "png" : "jpg";
    return `https://cards.scryfall.io/${size}/front/${c.id[0]}/${c.id[1]}/${c.id}.${ext}`;
  };
  eleventyConfig.addFilter("cardImg", scry);
  eleventyConfig.addFilter("cardMeta", (name) => CARDS[name] || {});
  eleventyConfig.addFilter("scryfallLink", (name) => `https://scryfall.com/search?q=${encodeURIComponent('!"' + name + '"')}`);
  eleventyConfig.addFilter("pointsGroups", (list) => {
    const groups = new Map();
    for (const c of list) {
      if (!groups.has(c.points)) groups.set(c.points, []);
      groups.get(c.points).push(c);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([points, cards]) => ({ points, cards }));
  });
  eleventyConfig.addFilter("firstOfKind", (posts, kind) => (posts || []).find((p) => p.data.kind === kind) || (posts || [])[0]);
  eleventyConfig.addFilter("pips", (colors) => String(colors || "").split(""));
  eleventyConfig.addFilter("relDate", (d) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  });

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/static": "/" });

  // News collection, newest first
  eleventyConfig.addCollection("news", (api) =>
    api.getFilteredByGlob("src/news/*.md").sort((a, b) => b.date - a.date)
  );

  // Dates
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const short = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  eleventyConfig.addFilter("longDate", (d) => {
    const dt = new Date(d);
    return `${months[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}`;
  });
  eleventyConfig.addFilter("shortDate", (d) => {
    const dt = new Date(d);
    return `${short[dt.getUTCMonth()]} ${String(dt.getUTCDate()).padStart(2, "0")}`;
  });
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("year", (d) => new Date(d).getUTCFullYear());

  // Helpers
  eleventyConfig.addFilter("domain", (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  });
  eleventyConfig.addFilter("pad", (n, len = 2) => String(n).padStart(len, "0"));
  eleventyConfig.addFilter("slug", (s) =>
    String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  );
  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("byCategory", (items, cat) => items.filter((i) => i.category === cat));
  eleventyConfig.addFilter("featured", (items) => items.filter((i) => i.featured));
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));

  eleventyConfig.addGlobalData("buildTime", () => new Date());

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"],
  };
}
