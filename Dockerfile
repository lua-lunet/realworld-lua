# syntax=docker/dockerfile:1
#
# Pure binary-dependency build: no xmake, no cargo, no toolchain.
#
# Stage 1 runs the official fetcher (Lua 5.1 script), which downloads,
# digest-verifies and installs the tagged lunet release into .lunet/v0.9.2/.
# Stage 2 carries only the installed runtime and the app.
#
# Upstream publishes linux-amd64 and linux-arm64 archives (since v0.6.1); the
# image stays pinned to linux/amd64 for parity with CI (on Apple Silicon,
# Docker builds it under emulation).
FROM --platform=linux/amd64 debian:trixie-slim AS deps

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        lua5.1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY scripts/lunet_fetch_release_v0.9.2.lua scripts/
RUN lua5.1 scripts/lunet_fetch_release_v0.9.2.lua

# Runtime: only the shared libraries the vendored .so files link against
FROM --platform=linux/amd64 debian:trixie-slim

ENV DEBIAN_FRONTEND=noninteractive

# libsodium needs an unversioned symlink because lib/crypto.lua FFI-loads it
# (ffi.load("sodium")) for Argon2id/HMAC — apt's libsodium23 ships only the
# versioned libsodium.so.23. This is unrelated to PAXE, which this app does
# not use.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        libsodium23 \
        libuv1 \
        libsqlite3-0 \
        libluajit-5.1-2 \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && sodium_lib="$(ldconfig -p | grep -m1 libsodium.so | awk '{print $NF}')" \
    && ln -s "$sodium_lib" "$(dirname "$sodium_lib")/libsodium.so"

WORKDIR /app

COPY . .
# After the app copy so the linux runtime fetched in stage 1 wins over any
# host-local .lunet install (e.g. a macOS archive from `make deps`).
COPY --from=deps /app/.lunet ./.lunet

RUN mkdir -p target

# Database config is supplied at run time: docker run --env-file .env
# 0.0.0.0 so the container's port mapping can reach the server (server.lua
# defaults to 127.0.0.1, correct for bare-metal local dev but not for a
# container's isolated network namespace). lunet-run refuses to bind
# non-loopback addresses unless told the container boundary is the intended
# security perimeter.
ENV LUNET_HOST=0.0.0.0
EXPOSE 8081

CMD ["./.lunet/v0.9.2/lunet-run", "--dangerously-skip-loopback-restriction", "server.lua"]
