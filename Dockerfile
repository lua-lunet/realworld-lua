# syntax=docker/dockerfile:1
#
# Pure binary-dependency build: no xmake, no from-source lunet build.
#
# Stage 1 fetches the tagged lunet release archive (lunet-run + lunet.so +
# drivers) and cargo-builds the two ext/ modules that are not shipped in the
# archive (lnt_shared, jsonic) — the same steps `make deps` runs locally.
# Stage 2 carries only runtime shared libraries and the app.
#
# The release only publishes a linux-amd64 archive, so the image is pinned to
# that platform (on Apple Silicon, Docker builds it under emulation; CI on
# amd64 is native).
FROM --platform=linux/amd64 debian:trixie-slim AS deps

ENV DEBIAN_FRONTEND=noninteractive
ARG LUNET_VERSION=v0.4.3

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        cargo \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY scripts/deps.sh scripts/deps.sh
RUN LUNET_VERSION="$LUNET_VERSION" \
    LUNET_ASSET=lunet-linux-amd64.tar.gz \
    LUNET_LIBSUFFIX=so \
    ./scripts/deps.sh

# Runtime: only the shared libraries the vendored .so files link against
FROM --platform=linux/amd64 debian:trixie-slim

ENV DEBIAN_FRONTEND=noninteractive

# libsodium needs an unversioned symlink for FFI loads (ffi.load("sodium")):
# apt's libsodium23 ships only the versioned libsodium.so.23.
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

COPY --from=deps /app/bin ./bin
COPY . .

RUN mkdir -p target

# Database config is supplied at run time: docker run --env-file .env
# 0.0.0.0 so the container's port mapping can reach the server (server.lua
# defaults to 127.0.0.1, correct for bare-metal local dev but not for a
# container's isolated network namespace). lunet-run refuses to bind
# non-loopback addresses unless told the container boundary is the intended
# security perimeter.
ENV LUNET_HOST=0.0.0.0
EXPOSE 8081

CMD ["./bin/lunet-run", "--dangerously-skip-loopback-restriction", "server.lua"]
