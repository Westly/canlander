#!/bin/sh
# Print {path: blobSha} for every tracked file, for syncCheck() in tools/github-push.js.
cd "$(dirname "$0")/.." && git ls-files -s | awk '{printf "%s\"%s\":\"%s\"", (NR>1?",":"{"), $4, $2} END {print "}"}'
