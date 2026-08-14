#!/usr/bin/env bash
# Repack the lunet binary release + this app into one self-contained
# executable: dist/realworld-conduit-<os>-<arch>.run
#
# The .run file is a POSIX sh stub with a gzipped tarball appended. Running it
# extracts the payload to a mktemp dir and execs .lunet/<tag>/lunet-run
# server.lua — no installation, no xmake, no build step; the same lunet-run
# used for dev, just repacked. Runtime shared-library requirements are the
# same as for `make deps` (see README, "Binary dependencies").
set -euo pipefail

LUNET_TAG="v0.9.2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
PAYLOAD=(.lunet app lib server.lua index.html sql)

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
[ "$ARCH" = "x86_64" ] && ARCH="amd64"
[ "$ARCH" = "aarch64" ] && ARCH="arm64"
OUT="$DIST/realworld-conduit-$OS-$ARCH.run"

if [ ! -x "$ROOT/.lunet/$LUNET_TAG/lunet-run" ]; then
  if command -v lua >/dev/null 2>&1; then
    (cd "$ROOT" && lua scripts/lunet_fetch_release_v0.9.2.lua)
  elif mise exec -- command -v lua >/dev/null 2>&1; then
    (cd "$ROOT" && mise exec -- lua scripts/lunet_fetch_release_v0.9.2.lua)
  else
    echo "ERROR: lua is required (on PATH or via mise) to fetch the lunet release." >&2
    exit 1
  fi
fi

mkdir -p "$DIST"
rm -f "$OUT" "$OUT.payload"

echo "==> Packing payload"
tar -czf "$OUT.payload" -C "$ROOT" \
  --exclude='.lunet/*/*.md' \
  --exclude='.lunet/*/types' \
  --exclude='.lunet/*/.install-sha256' \
  "${PAYLOAD[@]}"

echo "==> Writing self-extracting stub to $OUT"
cat > "$OUT" <<'STUB'
#!/bin/sh
# Self-extracting lunet app bundle. Usage: ./this-file.run [args passed to server]
set -eu
ARCHIVE_LINE=$(awk '/^__ARCHIVE_BELOW__$/ { print NR + 1; exit 0; }' "$0")
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/realworld-conduit.XXXXXX")"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT INT TERM
tail -n +"$ARCHIVE_LINE" "$0" | tar -xzf - -C "$WORKDIR"
cd "$WORKDIR"
LUNET_HOST="${LUNET_HOST:-127.0.0.1}" LUNET_PORT="${LUNET_PORT:-8081}" \
  exec @LUNET_RUN@ server.lua "$@"
exit 1
__ARCHIVE_BELOW__
STUB
sed -i.bak "s|@LUNET_RUN@|./.lunet/$LUNET_TAG/lunet-run|" "$OUT"
rm -f "$OUT.bak"
cat "$OUT.payload" >> "$OUT"
rm -f "$OUT.payload"
chmod +x "$OUT"

echo "==> Done: $OUT ($(du -h "$OUT" | cut -f1))"
