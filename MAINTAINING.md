# Maintaining canlander.org

This is the runbook for updating the site. Claude follows it, and Westly can too. To kick one off, Westly only needs to say something like "update canlander for the December points change" or "refresh the decks".

## The setup

| Piece | Where |
| --- | --- |
| Code | GitHub `Westly/canlander`. `preview` is the review branch, `main` is live. |
| Hosting | Cloudflare Worker `canlander` (account `327c6ba6bdfc5b8422d025e639b65620`), Workers Builds on every push. |
| Live | https://canlander.org. www and http redirect to it (zone Redirect Rule "www to canlander.org" plus Always Use HTTPS). |
| Review | https://preview-canlander.westlywhite.workers.dev (noindex) |
| Westly's copy | `C:\Users\WesWhite\Documents\canlander` (mirror of the repo, plus business cards in `print/`) |
| Official source | https://canadianhighlander.ca/points-list/ and https://canadianhighlander.ca/articles/ |

**Golden rule:** push to `preview`, show Westly, and only promote to `main` when he says to publish.

## 1. Start a session (Claude)

Claude's cloud workspace can't reach GitHub, Scryfall or Moxfield. The built-in browser can, so pushes and lookups run there.

1. **Get the code into the workspace.**
   - Stage the repo files from Westly's folder. Leave out `node_modules`, `_site` and `print`. That's about 57 files, which takes two stage calls.
   - Copy them to `/home/claude/canlander`, then run `git init && git add -A && git commit -m baseline` and `npm install`.
2. **Open the push tab.**
   - Open `https://cdn.jsdelivr.net/npm/@fontsource-variable/fraunces@5.3.0/package.json` in the built-in browser. Any page with no CSP works.
   - Set `window.__TOK` (see Token below), then paste `tools/github-push.js` and `tools/first-printing.js` into the tab with the javascript tool.
3. **Check the copy is current.**
   - Run `tools/local-shas.sh` in the workspace, then `await syncCheck(<that JSON>)` in the tab.
   - `src/assets/og.jpg` always differs. That's harmless and known, so never push it.
   - Any other changed file means Westly's folder is stale. Fetch it with `await getFile(path)`, overwrite the local copy, and re-commit the baseline.

### Token

The push tab needs a fine-grained GitHub token with **Contents: read and write on `Westly/canlander` only**. The current one expires on 2026-12-21.

- If Westly gives a token in chat, use it.
- Otherwise, ask Westly for permission to create one at github.com/settings/personal-access-tokens/new in the built-in browser, where he's signed in. Use a 90-day expiry and that single repo and permission.
- The token lives only in `window.__TOK` in that tab. Never write it to a file, a commit, the project notes or the chat.

## 2. Make the change

The site has no news section, and Westly doesn't want one. Point people to the council's articles on canadianhighlander.ca instead. The home page ticker and the "From the council" links update themselves from `points.json` and `site.json`.

### A. Points update (quarterly; next one is 2026-12-01)

The council posts its changes on canadianhighlander.ca the day before they take effect.

1. Read the announcement and the official points list. Note every card that changed, was added or was removed, and any proposals that were voted down.
2. `src/_data/points.json`:
   - Update `list` (sorted by points descending, then by name).
   - Update `asOf` (the effective date) and `asOfLabel` (e.g. "Winter 2026 update").
3. `src/_data/site.json`: set `nextPointsUpdate` to the next announced date. If no date has been announced, use the usual quarterly rhythm (Mar 1, Jun 1, Sep 1, Dec 1) and check the announcement.
4. `src/_data/cards.json`:
   - Every card on the points list needs an entry. The build fails with `Card "X" is missing` if one is absent.
   - Run `await firstPrinting(["New Card", ...])` in the push tab and paste the lines it returns.
   - **Always use the card's first printing.** Universes Beyond art is fine when it's the first or only printing. Skip promos, except where the promo is the true first printing (Mana Crypt).
5. Search the pages for hard-coded mentions of the changed cards: `grep -rn "Card Name" src --include=*.njk --include=*.json`. Fix any copy that quotes the old value.
6. Re-run the deck spend. Either do a full refresh (B below) or run `npm run decks` on the existing snapshot, so every deck's spend uses the new points.

### B. Refresh the deck pool

1. Open https://moxfield.com in the built-in browser.
2. Paste `scripts/moxfield-snapshot.js` with the javascript tool. It runs in the background for 5 to 8 minutes, because each deck renders in a hidden frame.
3. Poll `window.__canlanderSnapshot` in short calls; each tool call times out at 45 seconds. When it's set, read it out (about 22 KB) and write it to `scripts/moxfield-raw.json`.
4. Run `npm run decks`. This writes `src/_data/decks.json`: all of Saltboi's decks plus up to 16 recent community decks with more than 100 views. Spend is recalculated from points.json, and the cover art is a pointed card from each deck.
5. Fix odd names, colours or archetypes in `scripts/deck-overrides.json`, keyed by Moxfield deck id, then run it again.

Never call Moxfield's API directly, and never use Westly's browser cookies or session tokens. Use DOM scraping in the built-in browser only.

### C. Other content

| Change | File |
| --- | --- |
| Resource links | `src/_data/resources.json` |
| Videos | `src/_data/videos.json` (YouTube id + title + creator) |
| Council members | `src/_data/council.json` |
| Places to play | `src/_data/play.json` |
| Quotes | `src/_data/quotes.json` |
| Page copy | `src/*.njk` |

Suggestions from visitors arrive as GitHub issues on the repo.

### Copy rules (from Westly)

- Positive only. The site exists to bring new players in.
- Sound like a real Canlander player. Use plain words and contractions. Avoid AI tics: dramatic fragments, "Not X. Y.", tricolons, self-congratulating meta lines, filler.
- Say "decks to get you started", not "decks to steal".
- Westly doesn't own the Discord. Link to it, but never ask people to send things there; use GitHub issues instead.
- Keep pages uncluttered. When in doubt, cut.

## 3. Check, push, publish

1. Run `npx @11ty/eleventy` locally. It must build with no errors. Spot-check the pages you changed, using the Playwright screenshots if needed.
2. Run `git add -A && git commit -m "<what changed>"`.
3. Run `python3 tools/mkpush.py`, which writes `/tmp/push/c*.json`. For each chunk, run `await doChunk(<chunk>)` in the tab. **Every result must be `true`**, which means the blob SHA matches the local file. If one doesn't, re-fetch that file and redo the step.
   - Binary files go up with `putB64(path, base64)`. Deleted files are staged with `del(path)`.
4. Run `await commitTo("preview", "<message>")`, then poll `await buildStatus()` until `completed / success`. That takes about a minute.
5. Check the preview URL, including images, using the browser page context there. Send Westly the link and a short summary.
6. When Westly says publish: run `await promote()`, wait for the production build, then confirm https://canlander.org shows the change.
7. Sync the changed files to Westly's folder with device_commit_files, and update the project notes (`claude/site-build-notes.md`) if anything durable changed.

## Business cards

The files are in `print/` in Westly's folder. They're 1050×600 px (1088×638 with bleed) at 300 dpi, made for Vistaprint. The front reads "canlander.org", "Magic's best singleton format." and has a QR code to https://canlander.org with "Scan to learn more". Always give Westly wording options before changing the catchphrase.
