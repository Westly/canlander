"""Turn the last workspace commit (HEAD~1..HEAD) into push chunks for tools/github-push.js.

Usage:  python3 tools/mkpush.py [base_ref]     (default base_ref = HEAD~1)
Writes /tmp/push/c0.json, c1.json ... Each item has the path, line ops (or the full
text for new files) and the expected git blob sha. Paste a chunk into the browser:
    await doChunk(<chunk JSON>)
Every result must be true before calling commitTo().
Binary files (png/jpg/woff2) are listed but skipped: push them with putB64().
Deleted files are listed: stage them with del(path).
"""
import subprocess, difflib, json, os, sys

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = sys.argv[1] if len(sys.argv) > 1 else "HEAD~1"
BIN = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".woff", ".woff2", ".ico")

def sh(*a):
    return subprocess.run(a, cwd=R, capture_output=True, text=True).stdout

rows = [l.split("\t") for l in sh("git", "diff", "--name-status", BASE, "HEAD").strip().split("\n") if l]
exp = {}
for l in sh("git", "ls-tree", "-r", "HEAD").strip().split("\n"):
    meta, path = l.split("\t")
    exp[path] = meta.split()[2]

items, binaries, deleted = [], [], []
for row in rows:
    st, path = row[0], row[-1]
    if st.startswith("D"):
        deleted.append(path); continue
    if path.lower().endswith(BIN):
        binaries.append(path); continue
    new = open(os.path.join(R, path), encoding="utf-8").read()
    if st.startswith("A") or st.startswith("R"):
        items.append({"p": path, "full": new, "sha": exp[path]})
    else:
        a = sh("git", "show", f"{BASE}:{path}").split("\n")
        b = new.split("\n")
        ops = [[i1, i2, b[j1:j2]] for tag, i1, i2, j1, j2 in
               difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes() if tag != "equal"]
        items.append({"p": path, "ops": ops, "sha": exp[path]})

os.makedirs("/tmp/push", exist_ok=True)
for f in os.listdir("/tmp/push"):
    os.remove(os.path.join("/tmp/push", f))
chunks, cur, size = [], [], 0
for it in items:
    s = len(json.dumps(it))
    if cur and size + s > 22000:
        chunks.append(cur); cur, size = [], 0
    cur.append(it); size += s
if cur:
    chunks.append(cur)
for i, c in enumerate(chunks):
    txt = json.dumps(c, ensure_ascii=False, separators=(",", ":"))
    open(f"/tmp/push/c{i}.json", "w", encoding="utf-8").write(txt)
    print(f"c{i}.json", len(txt), [x["p"] for x in c])
if binaries: print("binary (push with putB64):", binaries)
if deleted: print("deleted (stage with del):", deleted)
