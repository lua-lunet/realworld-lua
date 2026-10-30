#!/usr/bin/env bash
set -euo pipefail

# Best-effort file-descriptor widening for benchmark/load parity.
ulimit -n 65535 2>/dev/null || true

export UV_THREADPOOL_SIZE=1

LUNET_TAG="v0.15.1"
LUNET_RUN=".lunet/${LUNET_TAG}/lunet-run"

cd "$(dirname "$0")"

exec "$LUNET_RUN" "$@" server.lua