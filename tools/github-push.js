/*
 * canlander.org: push changes to GitHub from a browser tab.
 * ----------------------------------------------------------
 * Claude's cloud workspace can't reach github.com, so changes are pushed with the
 * GitHub REST API from a github.com tab in the built-in browser
 * (e.g. https://github.com/settings/personal-access-tokens).
 *
 * Setup in the tab:
 *   1. window.__TOK = localStorage.getItem('canlander_pat')
 *      (fine-grained PAT, Contents read/write on Westly/canlander, saved in the
 *      built-in browser's github.com storage). Never write it to a file, a commit or the chat.
 *   2. Paste this whole file.
 *
 * Typical flow:
 *   await syncCheck(localShas)          // compare a {path: blobSha} map from the workspace
 *   await doChunk(items)                // items from tools/mkpush.py; every result must be true
 *   await commitTo("preview", "Message") // makes one commit from everything put() this session
 *   await buildStatus(sha)              // Cloudflare Workers Builds check run
 *   await promote()                     // fast-forward main to preview = publish (only when Westly says so)
 */
window.REPO = "Westly/canlander";
window.SH = window.SH || {};

window.gh = async (method, path, body) => {
  const r = await fetch("https://api.github.com/repos/" + REPO + path, {
    method,
    headers: { Authorization: "Bearer " + window.__TOK, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const t = await r.text();
  return { status: r.status, json: t ? JSON.parse(t) : null };
};

// Read a text file from a branch.
window.getFile = async (p, ref = "preview") => {
  const r = await gh("GET", "/contents/" + encodeURI(p) + "?ref=" + ref);
  const bin = atob(r.json.content.replace(/\n/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

// Apply line ops [[start, end, newLines], ...] (difflib opcodes against the old file).
window.applyLines = (old, ops) => {
  const a = old.split("\n");
  for (const [i1, i2, lines] of [...ops].sort((x, y) => y[0] - x[0])) a.splice(i1, i2 - i1, ...lines);
  return a.join("\n");
};

// Upload a text blob and stage it for the next commit.
window.put = async (p, s) => {
  const b = await gh("POST", "/git/blobs", { content: s, encoding: "utf-8" });
  window.SH[p] = b.json.sha;
  return b.json.sha;
};

// Upload a binary blob (base64 string) and stage it.
window.putB64 = async (p, b64) => {
  const b = await gh("POST", "/git/blobs", { content: b64, encoding: "base64" });
  window.SH[p] = b.json.sha;
  return b.json.sha;
};

// Stage a file for deletion in the next commit.
window.del = (p) => { window.SH[p] = null; };

// Apply a chunk from mkpush.py. Returns [[path, shaMatchesWorkspace]]. All must be true.
window.doChunk = async (items, ref = "preview") => {
  const out = [];
  for (const it of items) {
    const s = it.full !== undefined ? it.full : applyLines(await getFile(it.p, ref), it.ops);
    const sha = await put(it.p, s);
    out.push([it.p, sha === it.sha]);
  }
  return out;
};

// One commit on `branch` from everything staged in window.SH, then clear SH.
window.commitTo = async (branch, message) => {
  const head = (await gh("GET", "/git/ref/heads/" + branch)).json.object.sha;
  const pc = (await gh("GET", "/git/commits/" + head)).json;
  const tree = Object.entries(window.SH).map(([path, sha]) => ({ path, mode: "100644", type: "blob", sha }));
  const t = (await gh("POST", "/git/trees", { base_tree: pc.tree.sha, tree })).json;
  const c = (await gh("POST", "/git/commits", { message, tree: t.sha, parents: [head] })).json;
  const u = await gh("PATCH", "/git/refs/heads/" + branch, { sha: c.sha });
  if (u.status !== 200) throw new Error("ref update failed: " + JSON.stringify(u.json));
  window.SH = {};
  window.LAST = c.sha;
  return c.sha;
};

window.buildStatus = async (sha = window.LAST) =>
  (await gh("GET", "/commits/" + sha + "/check-runs")).json.check_runs.map((c) => [c.name, c.status, c.conclusion]);

// {path: blobSha} for a branch.
window.remoteTree = async (ref = "preview") => {
  const r = (await gh("GET", "/git/trees/" + ref + "?recursive=1")).json;
  return Object.fromEntries(r.tree.filter((e) => e.type === "blob").map((e) => [e.path, e.sha]));
};

// Compare the workspace (map from `git ls-files -s`) with a branch.
window.syncCheck = async (local, ref = "preview") => {
  const remote = await remoteTree(ref);
  const diff = { changed: [], onlyRemote: [], onlyLocal: [] };
  for (const [p, s] of Object.entries(remote)) {
    if (!(p in local)) diff.onlyRemote.push(p);
    else if (local[p] !== s) diff.changed.push(p);
  }
  for (const p of Object.keys(local)) if (!(p in remote)) diff.onlyLocal.push(p);
  return diff;
};

// Publish: fast-forward main to preview. Only when Westly approves.
window.promote = async () => {
  const pre = (await gh("GET", "/git/ref/heads/preview")).json.object.sha;
  const main = (await gh("GET", "/git/ref/heads/main")).json.object.sha;
  const cmp = (await gh("GET", "/compare/" + main + "..." + pre)).json;
  if (cmp.status !== "ahead" && cmp.status !== "identical") throw new Error("main is not behind preview: " + cmp.status);
  const u = await gh("PATCH", "/git/refs/heads/main", { sha: pre, force: false });
  return [u.status, pre, cmp.ahead_by];
};

"github-push helpers loaded";
