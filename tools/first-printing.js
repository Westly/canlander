/*
 * canlander.org: find each card's FIRST printing on Scryfall and print cards.json lines.
 * Run in any browser tab (Scryfall's API allows cross-origin requests).
 *
 *   await firstPrinting(["Card One", "Card Two"])
 *
 * Rule: the site always shows a card's first printing. Universes Beyond is fine when
 * that's the first or only printing. Promos are skipped unless the promo IS the first
 * printing (e.g. Mana Crypt, 1995 HarperPrism book promo: pass {allowPromo: ["Mana Crypt"]}).
 */
window.firstPrinting = async (names, { allowPromo = ["Mana Crypt"] } = {}) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const get = async (url) => {
    for (let i = 0; i < 5; i++) {
      try { const r = await fetch(url); if (r.ok) return r.json(); if (r.status === 404) return null; } catch {}
      await sleep(800 * (i + 1));
    }
    throw new Error("Scryfall failed: " + url);
  };
  const lines = [];
  for (const name of names) {
    const promo = allowPromo.includes(name) ? "" : " -is:promo";
    const q = `!"${name}" game:paper${promo}`;
    let r = await get("https://api.scryfall.com/cards/search?unique=prints&order=released&dir=asc&q=" + encodeURIComponent(q));
    if (!r) r = await get("https://api.scryfall.com/cards/search?unique=prints&order=released&dir=asc&q=" + encodeURIComponent(`!"${name}"`));
    if (!r) { lines.push(`// NOT FOUND: ${name}`); continue; }
    const c = r.data[0];
    const entry = { set: c.set, id: c.id, artist: c.artist, year: Number(c.released_at.slice(0, 4)) };
    lines.push(` ${JSON.stringify(name)}: ${JSON.stringify(entry).replace(/":/g, '": ').replace(/,"/g, ', "')},`);
    await sleep(120);
  }
  return lines.join("\n");
};
"firstPrinting loaded";
