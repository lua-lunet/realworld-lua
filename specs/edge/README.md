# Edge e2e suites

Docker rigs that put the pinned RealWorld app behind a real edge proxy and run
**this repo's full hurl conformance suite** (13 files / 173 requests) through
that edge — the gate the upstream worked examples leave open (lunet's
`ext/http/edge` conformance rig runs an 8-check smoke only, and is not wired
into any CI).

Source of the vendored Dockerfiles, edge configs, entrypoint and 8-check
conformance rig: `lua-lunet/lunet` tag `v0.18.2`, `ext/http/edge/` (MIT).

## What each suite proves

| Edge | Proves |
|------|--------|
| nginx | Full-request buffering taken as nginx's default; caps pinned 4×8 KiB / 1 MiB so the edge answers 413/400/414 first |
| OpenResty | Same nginx lineage directives, amd64-only packaging (built from the amd64 base image) |
| Traefik | Streams by default — full-request buffering is installed explicitly via the `buffering` middleware (`maxRequestBodyBytes: 1 MiB`) |
| Envoy | Streams by default — buffering installed explicitly via the buffer filter |

All four: the app is pinned to the lunet-matched tag in
`specs/edge/Dockerfile.base` and clone-committed at build time (the shipped
state is what is tested), Postgres 16 runs as a sibling container, **this
repo's `sql/schema.sql`** is applied, and the edge is the only
compound-reachable listener (the app binds loopback inside the container).

## Run one

```bash
specs/edge/run-edge-suite.sh nginx      # | openresty | traefik | envoy
```

Driver stages: build the base image (app at the pinned tag, `scripts/`
release fetcher digest-verifies the lunet runtime) → build the edge variant →
Postgres container + schema → boot app-then-edge via `entrypoint-edge.sh` →
**gate: `HOST=http://localhost:28080 specs/run-api-tests-hurl.sh`** →
informational: the vendored 8-check conformance (`413 / 400|414|431 / drip`)
→ teardown. Tee'd logs and the conformance output land in `.tmp/`.
