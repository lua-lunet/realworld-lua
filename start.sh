#!/usr/bin/env bash
set -euo pipefail

# Best-effort file-descriptor widening for benchmark/load parity.
ulimit -n 65535 2>/dev/null || true

export UV_THREADPOOL_SIZE=1

cd "$(dirname "$0")"

# Tag-agnostic: the one pinned tag lives in the Makefile.
LUNET_TAG="$(sed -n 's/^LUNET_TAG := //p' Makefile)"
if [ -z "$LUNET_TAG" ]; then
    echo "ERROR: LUNET_TAG not found in Makefile" >&2
    exit 1
fi
LUNET_RUN=".lunet/${LUNET_TAG}/lunet-run"

exec "$LUNET_RUN" "$@" server.lua
