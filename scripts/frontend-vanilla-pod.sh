#!/usr/bin/env bash
# Install the in-repo vanilla-pod-js RealWorld frontend (vanilla-pod-js/)
# into edge/public/ for the edge server to serve — same contract as
# frontend.sh, but no network fetch: the frontend lives in this repository.
#
# The frontend speaks the RealWorld API contract over relative /api/... and
# references its stylesheet and modules with root-relative paths (/main.css,
# /web/main.mjs), so no patch step is required. The served set is exactly the
# browser runtime: index.html, main.css, web/, src/, generated/. The test
# tree, schemas, tsconfig, and package.json are never installed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/vanilla-pod-js"
DEST="$ROOT/edge/public"

[ -d "$SRC" ] || { echo "ERROR: $SRC is missing."; exit 1; }
[ -f "$SRC/index.html" ] || { echo "ERROR: $SRC/index.html is missing."; exit 1; }

echo "==> Installing the vanilla-pod-js frontend into edge/public/"
rm -rf "$DEST"
mkdir -p "$DEST"
cp "$SRC/index.html" "$SRC/main.css" "$DEST/"
cp -R "$SRC/web" "$SRC/src" "$SRC/generated" "$DEST/"

echo "==> Done. Start the edge with: ./.lunet/v0.9.2/lunet-run edge/server.lua"
