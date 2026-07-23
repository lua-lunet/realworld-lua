#!/usr/bin/env bash
# Fetch lunet binary dependencies into bin/ — no xmake, no cargo, no toolchain.
#
# Downloads the tagged lunet release archive for this platform and extracts it
# into bin/. Since v0.4.4 the archive carries everything the app needs:
#   bin/lunet-run
#   bin/lunet.so
#   bin/lunet/{postgres,mysql,httpc,sqlite3,paxe}.so
#   bin/lunet/lnt_shared.lua + bin/lunet/liblnt_shared.{so,dylib}
#   bin/lunet/jsonic.lua + bin/lunet/dkjson-encode-v2.10.lua + bin/lunet/liblunet_jsonic.{so,dylib}
# The ext-module Lua loaders resolve their compiled library relative to their
# own directory, so the archive layout is kept exactly as published.
set -euo pipefail

LUNET_VERSION="${LUNET_VERSION:-v0.4.4}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/bin"

# LUNET_ASSET can be overridden (the Docker build uses this to target
# linux-amd64 regardless of the host platform).
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

command -v curl >/dev/null || { echo "ERROR: curl is required"; exit 1; }

echo "==> Fetching lunet $LUNET_VERSION release archive ($ASSET)"
mkdir -p "$BIN"
curl -fsSL "https://github.com/lua-lunet/lunet/releases/download/$LUNET_VERSION/$ASSET" \
  | tar -xzf - -C "$BIN"

echo "==> Done. Dependencies in bin/:"
ls -1 "$BIN" "$BIN/lunet"
