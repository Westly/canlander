/*
 * Moxfield deck snapshot for canlander.org
 * ----------------------------------------
 * Moxfield sits behind Cloudflare bot protection, so this runs in YOUR browser,
 * as you, reading the same pages you'd click through by hand.
 *
 * 1. Open https://moxfield.com in a normal browser tab (signed in or not).
 * 2. Open DevTools → Console, paste this whole file, press Enter.
 * 3. Wait (5–10 seconds per deck). A progress line prints for each one.
 * 4. When it finishes, the result is copied to your clipboard. Paste it into
 *    scripts/moxfield-raw.json, then run:  npm run decks
 *
 * What it collects
 *   • Pinned authors (Saltboi): every public Canadian Highlander deck.
 *   • Community: the most recently updated public Canadian Highlander decks
 *     with more than MIN_VIEWS views, up to MAX_COMMUNITY decks.
 */
(async () => {
  const PINNED_AUTHORS = ["Saltboi"];
  const MIN_VIEWS = 100;
  const MAX_COMMUNITY = 16;
  const SEARCH_PAGES = 5; // 64 decks per page, newest first
  const WAIT = 9000; // ms to let a search page render inside the hidden frame

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (...a) => console.log("%c[canlander]", "color:#c9a45c", ...a);

  const searchUrl = (author = "") => {
    const q = {
      format: "highlanderCanadian", authorUserNames: author, sortColumn: "updated",
      sortDirection: "descending", pageNumber: 1, pageSize: 64, view: "public",
    };
    return "/decks/public?q=" + encodeURIComponent(btoa(JSON.stringify(q)));
  };

  // One hidden, same-origin frame we point at each page in turn.
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;left:-4000px;top:0;width:1280px;height:1000px;";
  document.body.appendChild(frame);
  const open = async (url, wait = WAIT) => {
    frame.src = url;
    await sleep(wait);
    return frame.contentDocument;
  };

  const readTiles = (doc, into) => {
    doc.querySelectorAll("[role=article]").forEach((a) => {
      const link = a.querySelector('a[href^="/decks/"]');
      if (!link) return;
      const id = link.getAttribute("href").split("/")[2];
      const count = (label) => {
        const s = [...a.querySelectorAll(".visually-hidden")].find((x) => x.textContent.includes(label));
        return s ? parseInt(s.parentElement.textContent.replace(label, "").replace(/[^\d]/g, ""), 10) || 0 : 0;
      };
      const art = a.querySelector('[style*="art_crop"]');
      const user = a.querySelector('a[href^="/users/"]');
      into[id] = {
        id,
        name: a.innerText.split("\n").map((l) => l.trim()).find((l) => l && l !== "New") || "",
        cover: art ? (art.style.backgroundImage.match(/url\("([^"]+)"/) || [])[1] : null,
        views: count("View Count is"),
        author: user ? user.textContent.trim() : null,
      };
    });
  };

  const scan = async (url, pages) => {
    const found = {};
    const doc = await open(url);
    for (let p = 0; p < pages; p++) {
      for (let i = 0; i < 40; i++) {
        readTiles(doc, found);
        frame.contentWindow.scrollBy(0, 600);
        await sleep(200);
      }
      readTiles(doc, found);
      const more = [...doc.querySelectorAll("button")].find((b) => b.textContent.trim() === "View More");
      if (!more || p === pages - 1) break;
      more.click();
      await sleep(3000);
    }
    return Object.values(found);
  };

  const readDeck = async (id) => {
    let doc = await open("/decks/" + id, 4000);
    // Wait for the list to finish rendering (slow decks can take 20s+).
    for (let t = 0; t < 12 && !(doc.body.innerText.includes(" main deck") && doc.getElementById("lastupdated")); t++) {
      await sleep(2000);
      doc = frame.contentDocument;
    }
    const text = doc.body.innerText;
    const name = (doc.title.split(" // ")[0] || "").trim();
    const avatar = [...doc.querySelectorAll("img")].map((i) => i.src).find((s) => /\/profile\//.test(s)) || null;
    const pts = parseInt((text.match(/\n(\d+)\s*(?:PTS|POINTS)\n/) || [])[1], 10);
    const lands = parseInt((text.match(/\nLands\n\((\d+)\)/) || [])[1], 10);
    const updated = (doc.getElementById("lastupdated") || {}).textContent || "";
    const start = text.indexOf("View Options"), end = text.indexOf(" main deck");
    const cards = text.slice(start, end).split("\n")
      .filter((l) => l && !/^\d+$/.test(l) && !/^\(\d+\)$/.test(l) && !/^\$/.test(l) && !/^– \$/.test(l) && !/^\+ \d+ other/.test(l));
    const pips = {};
    doc.querySelectorAll(".mana-cost:not([aria-label])").forEach((m) => {
      (m.className.match(/mana-[wubrg][wubrgp]?\b/g) || []).forEach((cls) =>
        cls.slice(5).split("").forEach((k) => { if ("wubrg".includes(k)) pips[k] = (pips[k] || 0) + 1; }));
    });
    return { name, avatar, pts, lands, updatedText: updated.replace("Last updated ", ""), cards, pips };
  };

  const pool = [];
  for (const author of PINNED_AUTHORS) {
    log("Scanning", author, "…");
    (await scan(searchUrl(author), 3)).forEach((d) => pool.push({ ...d, pinned: true, author }));
  }
  log("Scanning recent community decks…");
  const recent = (await scan(searchUrl(), SEARCH_PAGES))
    .filter((d) => d.views > MIN_VIEWS && !PINNED_AUTHORS.includes(d.author))
    .slice(0, MAX_COMMUNITY);
  recent.forEach((d) => pool.push({ ...d, pinned: false }));

  const out = [];
  for (const [i, d] of pool.entries()) {
    try {
      const deep = await readDeck(d.id);
      out.push({ ...d, ...deep, name: d.name || deep.name, url: "https://moxfield.com/decks/" + d.id });
      log(`${i + 1}/${pool.length}`, d.name || deep.name, "—", d.author);
    } catch (e) {
      log("skipped", d.id, e.message);
    }
  }
  frame.remove();

  const json = JSON.stringify({ snapshot: new Date().toISOString().slice(0, 10), decks: out }, null, 1);
  window.__canlanderSnapshot = json;
  try { copy(json); log(`Done: ${out.length} decks copied to clipboard. Paste into scripts/moxfield-raw.json and run npm run decks.`); }
  catch { console.log(json); log("Done. Copy the JSON printed above into scripts/moxfield-raw.json."); }
})();
