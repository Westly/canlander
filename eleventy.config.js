export default function (eleventyConfig) {
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
