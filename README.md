# canlander.org

A beginner-friendly guide to **Canadian Highlander**, the 100-card singleton Magic: The Gathering format. Built with [Eleventy](https://www.11ty.dev/) and hosted on Cloudflare.

The official rules and points list live at [canadianhighlander.ca](https://canadianhighlander.ca/). This site summarizes and links to them.

**Updating the site (points, decks, publishing):** see [MAINTAINING.md](MAINTAINING.md). Helper scripts are in `tools/`.

---

## Preview the site on your computer

You need **Node.js** once (free). On Windows:

1. Download the **LTS** installer from <https://nodejs.org/> and run it with the default options.
2. Open the `canlander` folder in VS Code, then open a terminal (**Terminal → New Terminal**).
3. Run, the first time only:

   ```
   npm install
   ```

4. Then, whenever you want to preview:

   ```
   npm start
   ```

5. Open <http://localhost:8080> in your browser. Edits to files refresh the page automatically. Press `Ctrl + C` in the terminal to stop.

## How publishing works

| You push to…   | What happens                                                             |
| -------------- | ------------------------------------------------------------------------ |
| `preview`      | Cloudflare builds a private **preview URL**. Check it before going live. |
| `main`         | Cloudflare builds and publishes to **canlander.org** (about a minute).   |

Suggested routine: make changes → check with `npm start` → push to `preview` → look at the preview URL → merge into `main`.

## Everyday edits

### Add or change a resource link

Edit `src/_data/resources.json`. Each link is one block:

```json
{
  "name": "Name shown on the site",
  "url": "https://example.com/",
  "category": "community",
  "featured": false,
  "description": "One or two sentences, written like you'd say it to a friend."
}
```

Categories: `official`, `community`, `learn`, `listen`, `decks`, `tools`, `play`.
`"featured": true` adds a "Start here" tag and puts it on the home page.

### Card images

Card images are hotlinked from Scryfall. Each card the site shows has an entry in `src/_data/cards.json` (name → Scryfall id, set, artist). To add a card, look it up on scryfall.com, copy the id from the card's API link, and add a line.

### The deck rotation

`src/_data/decks.json` is generated. Don't edit it by hand.

- **Pinned:** every public Canadian Highlander deck by Saltboi. One of these always leads the carousel.
- **Community:** the most recently updated public Canadian Highlander decks on Moxfield with more than 100 views (up to 16).

To refresh (about five minutes):

1. Open https://moxfield.com in your browser, open DevTools → Console, paste all of `scripts/moxfield-snapshot.js` and press Enter. Moxfield blocks bots, so this runs as you, in your browser.
2. When it prints "Done", the result is on your clipboard. Paste it over `scripts/moxfield-raw.json`.
3. Run `npm run decks`. Points spend is recalculated from `src/_data/points.json`; colours come from the mana symbols in each list.
4. Commit and push. Cloudflare rebuilds the site.

Settings (pinned authors, minimum views, how many decks) are at the top of the snapshot script. To fix a name, colours or archetype for one deck, add it to `scripts/deck-overrides.json`; those fixes survive every refresh.

### After a points update

1. Change `nextPointsUpdate` in `src/_data/site.json` (drives the home-page countdown).
2. Update the list and `asOf` / `asOfLabel` in `src/_data/points.json` (drives the price list, the Build page grid and the sandbox). Add any newly pointed card to `cards.json`.

## Project layout

```
src/
  _data/          site settings, resources, points sample
  _includes/      page layouts, header and footer
  assets/         CSS, JavaScript, self-hosted fonts
  static/         favicon, robots.txt, Cloudflare _headers
  index.njk       home page
  learn.njk       Learn page
  build.njk       Build guide (points grid + sandbox)
  decks.njk       Deck rotation
  play.njk        Online play (data in _data/play.json)
  story.njk       The format's history
  council.njk     The council (data in _data/council.json)
  resources.njk   Resources page
  about.njk       About page
eleventy.config.js
wrangler.jsonc    Cloudflare config (serves the built _site folder)
```

## Cloudflare build settings

- Build command: `npm run build`
- Output / assets directory: `_site`
- Deploy command (Workers): `npx wrangler deploy`
- Non-production branch deploy command (Workers): `npx wrangler versions upload`

---

Canlander.org is unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy. Not approved or endorsed by Wizards.
