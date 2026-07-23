#!/usr/bin/env bash
# Fetch lunet binary dependencies into bin/ — no xmake/from-source build.
#
#   1. Download the tagged lunet release archive for this platform and extract
#      it into bin/ (lunet-run, lunet.so, lunet/*.so drivers).
#   2. Build the ext/ modules that are NOT shipped in the release archive
#      (lnt_shared, jsonic — both standalone Rust crates) with cargo, and
#      co-locate each .lua loader + compiled library in bin/lunet/.
#
# Layout produced (consumed by server.lua):
#   bin/lunet-run
#   bin/lunet.so
#   bin/lunet/{postgres,mysql,httpc,sqlite3,paxe}.so
#   bin/lunet/lnt_shared.lua + bin/lunet/liblnt_shared.{so,dylib}
#   bin/lunet/jsonic.lua + bin/lunet/dkjson-encode-v2.10.lua + bin/lunet/liblunet_jsonic.{so,dylib}
set -euo pipefail

LUNET_VERSION="${LUNET_VERSION:-v0.4.3}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin"
WORK="$ROOT/.tmp/lunet-src"

# LUNET_ASSET / LUNET_LIBSUFFIX can be overridden (the Docker build uses this
# to target linux-amd64 regardless of the host platform).
if [ -z "${LUNET_ASSET:-}" ]; then
  case "$(uname -s)-$(uname -m)" in
    Darwin-*)        ASSET="lunet-macos.tar.gz" ;;
    Linux-x86_64)    ASSET="lunet-linux-amd64.tar.gz" ;;
    Linux-aarch64)   echo "ERROR: no lunet release archive for linux/arm64 (see https://github.com/lua-lunet/lunet/releases)"; exit 1 ;;
    *)               echo "ERROR: unsupported platform $(uname -s)-$(uname -m)"; exit 1 ;;
  esac
else
  ASSET="$LUNET_ASSET"
fi

command -v curl  >/dev/null || { echo "ERROR: curl is required"; exit 1; }
command -v cargo >/dev/null || { echo "ERROR: cargo (Rust) is required to build the ext/ modules not shipped in the release archive"; exit 1; }
command -v git   >/dev/null || { echo "ERROR: git is required"; exit 1; }

echo "==> Fetching lunet $LUNET_VERSION release archive ($ASSET)"
mkdir -p "$BIN"
curl -fsSL "https://github.com/lua-lunet/lunet/releases/download/$LUNET_VERSION/$ASSET" \
  | tar -xzf - -C "$BIN"

echo "==> Building ext/ modules not shipped in the archive (lnt_shared, jsonic)"
rm -rf "$WORK"
git clone --quiet -c advice.detachedHead=false --depth 1 --branch "$LUNET_VERSION" https://github.com/lua-lunet/lunet "$WORK"

for ext in lnt_shared jsonic; do
  (cd "$WORK/ext/$ext" && cargo build --quiet --release)
done

if [ -z "${LUNET_LIBSUFFIX:-}" ]; then
  case "$(uname -s)" in
    Darwin) LIBSUFFIX="dylib" ;;
    *)      LIBSUFFIX="so" ;;
  esac
else
  LIBSUFFIX="$LUNET_LIBSUFFIX"
fi

# The Lua loaders resolve their compiled library relative to their own
# directory, so each pair must stay co-located in bin/lunet/.
cp "$WORK/ext/lnt_shared/lnt_shared.lua" "$BIN/lunet/"
cp "$WORK/ext/lnt_shared/target/release/liblnt_shared.$LIBSUFFIX" "$BIN/lunet/"
cp "$WORK/ext/jsonic/jsonic.lua" "$WORK/ext/jsonic/dkjson-encode-v2.10.lua" "$BIN/lunet/"
cp "$WORK/ext/jsonic/target/release/liblunet_jsonic.$LIBSUFFIX" "$BIN/lunet/"

rm -rf "$WORK"
echo "==> Done. Dependencies in bin/:"
ls -1 "$BIN" "$BIN/lunet"
