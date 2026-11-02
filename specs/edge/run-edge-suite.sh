#!/usr/bin/env bash
# Edge e2e driver: run this repo's edge variant for one edge product, then
# execute OUR full RealWorld hurl conformance suite (13 files / 173 requests)
# through that edge — the gate upstream's own rig does not run.
#
# Usage: specs/edge/run-edge-suite.sh <nginx|openresty|traefik|envoy>
#
# The image is built from the lunet-matched tag (see specs/edge/Dockerfile.base),
# so the app under test is the shipped, committed state. Postgres runs as a
# sibling container on a docker network; OUR sql/schema.sql is applied, NOT a
# vendored copy. Everything Luigi's suite needs comes from docker run env.
#
# Adapted from lua-lunet/lunet v0.18.2 ext/http/edge/run-conformance.sh (MIT);
# the test stage is replaced: instead of the upstream 8-check smoke, the gate
# is specs/run-api-tests-hurl.sh through the edge. Upstream's conformance.lua
# runs afterwards, informationally, for the edge-behaviour checks (413/431 AND
# drip-feed).
set -euo pipefail

cd "$(dirname "$0")"
EDGE_DIR="$PWD"
REPO_ROOT="$(cd ../.. && pwd)"
KIND="${1:?usage: run-edge-suite.sh <nginx|openresty|traefik|envoy>}"
case "$KIND" in
    nginx|openresty|traefik|envoy) ;;
    *) echo "unknown kind: $KIND" >&2; exit 2 ;;
esac

PGPASSWORD="${PGPASSWORD:-edge-secret}"
NET="lunet-edge-net"
PGHOST="edge-postgres"
HOST_PORT="${HOST_PORT:-28080}"
HURL_HOST="http://localhost:${HOST_PORT}"

echo "=== edge e2e: ${KIND} (base image from realworld-lua v0.18.2) ==="

# OpenResty publishes amd64 packages only: build the amd64 base first (the
# per-edge Dockerfile is pinned FROM --platform=linux/amd64 base:amd64), as
# upstream's driver does.
if [ "${KIND}" = "openresty" ]; then
    docker build --platform linux/amd64 -q -f "${EDGE_DIR}/Dockerfile.base" \
        -t lunet-edge-base:amd64 "${EDGE_DIR}"
fi
docker build -q -f "${EDGE_DIR}/Dockerfile.${KIND}" -t "lunet-edge-${KIND}" "${EDGE_DIR}"

docker network create "$NET" >/dev/null 2>&1 || true
docker rm -f "${PGHOST}" "edge-${KIND}" >/dev/null 2>&1 || true

docker run -d --name "${PGHOST}" --network "$NET" \
    -e POSTGRES_DB=realworld -e POSTGRES_USER=postgres \
    -e "POSTGRES_PASSWORD=${PGPASSWORD}" \
    postgres:16-alpine >/dev/null

for _ in $(seq 1 30); do
    if docker exec "${PGHOST}" pg_isready -U postgres >/dev/null 2>&1; then break; fi
    sleep 1
done

# OUR schema, from the repo root — not upstream's vendored copy.
docker exec -i "${PGHOST}" psql -v ON_ERROR_STOP=1 -U postgres -d realworld \
    < "${REPO_ROOT}/sql/schema.sql" >/dev/null

docker run -d --name "edge-${KIND}" --network "$NET" \
    -e PGHOST="$PGHOST" -e PGPORT=5432 -e PGDATABASE=realworld \
    -e PGUSER=postgres -e "PGPASSWORD=${PGPASSWORD}" \
    -e JWT_SECRET=edge-conformance-secret \
    -p "${HOST_PORT}:80" \
    "lunet-edge-${KIND}" >/dev/null

# The edge container boots the app then the edge; wait for health THROUGH
# the edge before the suite starts.
for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null "${HURL_HOST}/health" 2>/dev/null; then break; fi
    sleep 1
done

GATE_RC=0
echo "=== gate: our hurl suite through the ${KIND} edge (${HURL_HOST}) ==="
HOST="${HURL_HOST}" bash "${REPO_ROOT}/specs/run-api-tests-hurl.sh" || GATE_RC=$?

# Informational: the upstream 8-check edge-behaviour suite (413/431/drip).
BONUS_NOTE=""
edge_ip="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "edge-${KIND}")"
if docker run --rm --network "$NET" --entrypoint sh \
    -v "${EDGE_DIR}:/suite:ro" \
    -e PGHOST="$PGHOST" -e PGPASSWORD="$PGPASSWORD" \
    lunet-edge-base \
    -c 'cd /app && exec ./.lunet/*/lunet-run /suite/conformance.lua "$@"' \
    suite "http://edge-${KIND}" 80 "${edge_ip}" > "${REPO_ROOT}/.tmp/edge-conformance-${KIND}.txt" 2>&1; then
    BONUS_NOTE="upstream 8-check: pass"
else
    BONUS_NOTE="upstream 8-check: FAIL (see .tmp/edge-conformance-${KIND}.txt)"
fi

docker rm -f "${PGHOST}" "edge-${KIND}" >/dev/null
docker network rm "$NET" >/dev/null 2>&1 || true

echo "=== (${KIND}) gate rc=$GATE_RC; ${BONUS_NOTE} ==="
exit "$GATE_RC"
