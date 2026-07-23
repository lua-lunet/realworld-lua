# ![RealWorld Example App](logo.png)

> Lua codebase containing real world examples (CRUD, auth, advanced patterns, etc) that adheres to the [RealWorld](https://github.com/realworld-apps/realworld) spec and API.

### [Demo](https://demo.realworld.build/)&nbsp;&nbsp;&nbsp;&nbsp;[RealWorld](https://github.com/realworld-apps/realworld)

Backend API built with **[lunet](https://github.com/lua-lunet/lunet)** (libuv + LuaJIT coroutine runtime) and **PostgreSQL**: CRUD, JWT auth, routing via a small hand-rolled router. Passes the RealWorld API compatibility suite (`specs/run-api-tests-hurl.sh`).

## How it works

```mermaid
sequenceDiagram
    participant Client
    participant Server as server.lua (lunet.socket)
    participant Lua as app/*.lua
    participant PostgreSQL

    Client->>Server: HTTP request (TCP)
    Server->>Lua: router.handle(ctx) — one lunet coroutine per connection; request JSON decoded by lunet.jsonic (Rust)
    Lua->>PostgreSQL: lunet.postgres (libuv thread pool, coroutine-safe)
    PostgreSQL-->>Lua: rows
    Lua-->>Server: response JSON encoded by dkjson (vendored with lunet.jsonic)
    Server-->>Client: HTTP response
```

- **lunet**: standalone libuv + LuaJIT runtime; `server.lua` runs its own accept loop with `lunet.socket`, one coroutine per connection
- **lunet.postgres**: PostgreSQL driver on libpq; queries run on libuv's thread pool so a slow query never blocks the event loop
- **lib/crypto.lua**: libsodium via LuaJIT FFI — Argon2id password hashing, HMAC-SHA256 JWT signing, base64url, CSPRNG
- **lunet.jsonic**: request JSON decoded by the Rust jsonic parser; response JSON encoded by the bundled dkjson (see [Attribution](#attribution))
- **lunet.lnt_shared**: sharded in-process dictionary with atomic counters — backs the request metrics on `/health` ([app/metrics.lua](app/metrics.lua))
- **Custom router** ([app/router.lua](app/router.lua)): routing table with `:param` extraction, driven by a per-request context ([lib/http_context.lua](lib/http_context.lua)) — safe under concurrent coroutines
- **Custom HTTP parsing** ([lib/http.lua](lib/http.lua)): request/response (de)serialization over raw sockets

## Project structure

```
├── Makefile               # init, start, stop, test, lint, clean
├── server.lua              # Entry point: lunet accept loop, dispatches to router
├── index.html               # Landing page
├── app/
│   ├── router.lua          # Routing table, JSON response handling
│   ├── routes.lua          # Route registration
│   ├── auth_routes.lua     # /api/users, /api/user
│   ├── article_routes.lua  # /api/articles, comments, favorites, tags
│   ├── profile_routes.lua  # /api/profiles
│   ├── web.lua             # Shared helpers (auth token resolution, responses)
│   ├── db.lua              # SQL queries via lunet.postgres
│   ├── jwt.lua             # HS256 JWT encode/decode, built on lib/crypto
│   ├── password.lua        # Argon2id hashing, built on lib/crypto
│   ├── metrics.lua         # Request counters via lunet.lnt_shared, exposed on /health
│   ├── config.lua          # Environment variable resolution
│   └── dotenv.lua          # .env file loader
├── lib/
│   ├── crypto.lua          # libsodium FFI: hashing, HMAC, base64, CSPRNG
│   ├── http.lua            # HTTP request parsing / response building
│   └── http_context.lua    # Per-request context passed into router.handle()
├── edge/                    # Optional add-on, not part of the backend demo:
│   ├── server.lua           #   second lunet instance serving a frontend + relaying /api
│   └── public/              #   prebuilt frontend assets (gitignored; fetched by make frontend)
├── scripts/
│   ├── deps.sh              # Fetches the lunet binary release into bin/
│   └── frontend.sh          # Fetches the prebuilt frontend into edge/public/
├── bin/                     # lunet binaries (gitignored; created by make deps)
├── sql/schema.sql          # PostgreSQL schema
├── specs/                  # RealWorld Hurl compatibility suite + OpenAPI spec
└── target/                 # Runtime files: pid, logs, local Postgres data dir (gitignored)
```

Runtime state (pid, logs) lives under `target/`; `make clean` empties it (and refuses while the server is up).

## Getting started

Requires PostgreSQL and [mise](https://mise.jdx.dev/) (provides hurl, lua-language-server).

```bash
cp .env.example .env   # PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, JWT_SECRET

make deps      # fetch lunet binaries into bin/ (seconds)
make init      # check dependencies, load sql/schema.sql
make start     # start the server on port 8081
make test      # run the RealWorld API compatibility suite (Hurl)
make load-test # read-dominated load test with hey, concurrency doubling 1 -> 64
make lint      # lua-language-server static analysis
make stop      # stop the server
make clean     # remove runtime files in target/
```

## Binary dependencies (`bin/`)

`make deps` extracts the tagged release archive (`v0.4.4`) from
[lunet releases](https://github.com/lua-lunet/lunet/releases) into `bin/`:

- `lunet-run` + `lunet.so`
- drivers `lunet/{postgres,mysql,httpc,sqlite3,paxe}.so`
- `lunet/lnt_shared.lua` + `lunet/liblnt_shared.{dylib,so}`
- `lunet/jsonic.lua` + `lunet/dkjson-encode-v2.10.lua` + `lunet/liblunet_jsonic.{dylib,so}`

Each loader resolves its compiled library relative to itself, and `lunet-run` resolves
drivers relative to its own location — the archive layout is kept as-is. `server.lua`
adds `./bin/?.lua` to `package.path` for the pure-Lua loaders.

Runtime shared libraries:

- **macOS**: `brew install luajit libuv libpq libsodium`
- **Debian/Ubuntu**: `apt install libluajit-5.1-2 libuv1 libpq5 libsodium23 libsqlite3-0`
  plus an unversioned `libsodium.so` symlink for FFI (created in the [Dockerfile](Dockerfile)).

## Docker

```bash
docker build -t realworld-lua .
docker run --rm -p 8081:8081 --env-file .env realworld-lua
```

The image targets `linux/amd64` (the only Linux archive lunet publishes).

## Optional extra: a frontend edge (not part of the demo)

`edge/` serves a prebuilt frontend from a second lunet instance
([edge/server.lua](edge/server.lua)) and relays `/api/*` to the backend on `:8081`:

```bash
make frontend       # fetch the frontend (first run), serve on :8083
make frontend-stop
```

Open <http://localhost:8083/>. The page calls the API same-origin via the relay.

- [scripts/frontend.sh](scripts/frontend.sh) fetches the pinned frontend (see
  [Attribution](#attribution)) and patches: API base → `/api`; dead theme-CDN link →
  vendored classic Conduit CSS.
- `edge/server.lua` mirrors the frontend's `nginx/default.conf`: extensionless/SPA
  fallbacks, one-pass SSI includes, `/api` relay. Demo-grade: single-shot reads, one
  connection per request.
- Hurl suite through the edge: `HOST=http://localhost:8083 bash specs/run-api-tests-hurl.sh`

## Attribution

The backend is licensed [MIT](LICENSE). Third-party material:

In `bin/` (all part of the lunet release archive):

- **dkjson** (`bin/lunet/dkjson-encode-v2.10.lua`) — JSON encode/decode for Lua by
  David Kolf, [MIT](http://dkolf.de/dkjson-lua). The encode half of `lunet.jsonic`.
- **jsonic** (`bin/lunet/jsonic.lua` + `bin/lunet/liblunet_jsonic.*`) — fast JSON parser
  ([jsonic](https://github.com/g1mv/jsonic), MIT/Apache-2.0) behind lunet's FFI binding;
  the decode half. License texts: [lunet `ext/jsonic/`](https://github.com/lua-lunet/lunet/tree/v0.4.4/ext/jsonic).

In `edge/public/` (optional, not committed):

- **[daodao-bot/realworld-html-js-simple](https://github.com/daodao-bot/realworld-html-js-simple)** —
  vanilla HTML/JS RealWorld frontend, pinned commit `cac2d502`, [Unlicense](https://unlicense.org);
  its `LICENSE` is fetched alongside. Two fetch-time patches applied as above.
- **Conduit demo theme** (`main.css`) — code & design from the
  [RealWorld](https://github.com/realworld-apps/realworld) demo (MIT); bundles Bootstrap v4
  (MIT, © Twitter, Inc.). Original CDN defunct; vendored from a
  [Wayback Machine snapshot](https://web.archive.org/web/20250708043359/https://demo.productionready.io/main.css).
- **Icons/fonts** load from CDNs in the browser: [Ionicons](https://ionicons.com) (MIT),
  Google Fonts (SIL OFL 1.1).

RealWorld name and API spec: [RealWorld](https://github.com/realworld-apps/realworld) (MIT).

## Load testing

`make load-test` runs [specs/run-load-tests.sh](specs/run-load-tests.sh) (requires
[hey](https://github.com/rakyll/hey)): read-heavy mix (~99% reads) at concurrency
doubling 1 → 64; fails on any HTTP 500. `server.lua` has no load shedding — under
sustained overload it queues rather than returning 503.

## License

[MIT](LICENSE) — third-party components under their own licenses, see [Attribution](#attribution).
