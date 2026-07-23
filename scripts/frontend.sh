#!/usr/bin/env bash
# Fetch the prebuilt vanilla HTML/JS RealWorld frontend into edge/public/.
#
# Source: https://github.com/daodao-bot/realworld-html-js-simple (Unlicense) —
# plain HTML pages + fetch()-based JS, no framework and no build step, written
# to be served by nginx doing statics + API proxying (see its
# nginx/default.conf, which edge/server.lua mirrors). Perfect demo fodder:
# clearly not production UI, exactly production-shaped traffic.
#
# One patch is applied at fetch time: the API base URL default in js/api.js is
# rewritten from the public hosted API to the same-origin /api, which the edge
# server proxies to the local backend.
set -euo pipefail

FRONTEND_REPO="daodao-bot/realworld-html-js-simple"
FRONTEND_REF="${FRONTEND_REF:-cac2d5027a80dfdd7b1637a272e585be9db4795e}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/edge/public"

command -v curl >/dev/null || { echo "ERROR: curl is required"; exit 1; }

if [ -f "$DEST/index.html" ]; then
  echo "Frontend already present in edge/public/ (delete it to re-fetch)."
  exit 0
fi

echo "==> Fetching $FRONTEND_REPO@$FRONTEND_REF"
mkdir -p "$DEST"
TARBALL="$(mktemp -t realworld-frontend.XXXXXX)"
trap 'rm -f "$TARBALL"' EXIT
curl -fsSL "https://codeload.github.com/$FRONTEND_REPO/tar.gz/$FRONTEND_REF" -o "$TARBALL"
tar -xzf "$TARBALL" -C "$DEST" --strip-components=2 "realworld-html-js-simple-$FRONTEND_REF/public"
# Carry the upstream license with the vendored content (see README, "Attribution")
tar -xzf "$TARBALL" -C "$DEST" --strip-components=1 "realworld-html-js-simple-$FRONTEND_REF/LICENSE"

echo "==> Pointing the frontend at the same-origin /api (proxied by the edge)"
API_JS="$DEST/js/api.js"
sed 's|https://api.realworld.io/api|/api|' "$API_JS" > "$API_JS.tmp" && mv "$API_JS.tmp" "$API_JS"

echo "==> Vendoring the classic RealWorld theme CSS. The original CDN host"
echo "    (demo.productionready.io) is dead and the current demo host ORB-blocks"
echo "    hotlinks, so fetch the archived original and serve it from the edge."
curl -fsSL --compressed --max-time 30 \
  "https://web.archive.org/web/20250708043359id_/https://demo.productionready.io/main.css" \
  -o "$DEST/main.css"
HEAD_HTML="$DEST/include/head.html"
sed 's|//demo.productionready.io/main.css|/main.css|' "$HEAD_HTML" > "$HEAD_HTML.tmp" && mv "$HEAD_HTML.tmp" "$HEAD_HTML"

echo "==> Done. Start the edge with: make frontend"
