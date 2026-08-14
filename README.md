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
- **Context adapter** ([lib/http_context.lua](lib/http_context.lua)): a small native Lua request/response table (`method`, `headers`, `status`, `write`); it replaces the earlier `ngx`-shaped compatibility layer rather than providing an OpenResty runtime.

## Ten-minute vertical slice

After completing [Getting started](#getting-started), read and run the two Hurl files as one
small journey: [`specs/hurl/auth.hurl`](specs/hurl/auth.hurl) registers a user and
logs in; [`specs/hurl/articles.hurl`](specs/hurl/articles.hurl) creates and lists
that user's article.

1. **Minutes 0–2 — register.** Hurl sends `POST /api/users`. `server.lua` reads one
   request, `app/router.lua` selects the auth handler, the handler decodes and
   validates JSON, `app/db.lua` issues parameterized SQL, and the router encodes the
   response that Hurl asserts.
2. **Minutes 2–4 — log in.** `POST /api/users/login` follows the same path, adding
   password verification and JWT creation; Hurl captures the token for the next
   request.
3. **Minutes 4–7 — create an article.** `POST /api/articles` authenticates the
   token, validates title/description/body/tags, then uses an explicit database
   transaction to create the article and its tags before serializing the article.
4. **Minutes 7–10 — list it.** `GET /api/articles` routes to the list handler,
   fetches rows from PostgreSQL, formats each article into the API shape, and lets
   Hurl check the resulting list. Follow those calls in the named files before
   moving on to another endpoint.

## Deliberate limitations and tradeoffs

- The HTTP parser supports a small HTTP/1.1 subset: one origin-form request per
  connection, CRLF headers, a single value per header field, and optional decimal
  `Content-Length`. It rejects `Transfer-Encoding`, including chunked bodies.
- Every response closes its connection. There are no persistent connections or
  request pipelining; this keeps socket handling visible but is not throughput
  oriented.
- PostgreSQL connections have a hard cap across idle, checked-out, and opening
  connections. At the cap, a request coroutine waits cooperatively for a release;
  that is bounded pool pressure, not a fast overload response.
- Transactions are explicit callback blocks that keep work on one checked-out
  connection and commit or roll back as a unit. Ordinary queries borrow and release
  a connection individually, so multi-step writes must opt in to a transaction.
- Article presentation intentionally makes extra queries per article for tags and,
  when authenticated, favourite/follow state. This exposes the shaping work but is
  an N+1 query pattern and will not scale well with large result pages.
- PostgreSQL is chosen to keep relational SQL, constraints, and transactions in
  view. It also means a local PostgreSQL service and credentials are required; this
  is not an embedded-database example.
- There is no load shedding. Under sustained overload the server and waiting
  database coroutines queue work rather than deliberately returning `503`.

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
│   ├── lunet_fetch_release_v0.9.2.lua # Fetches the lunet release into .lunet/
│   ├── frontend.sh          # Fetches the prebuilt frontend into edge/public/
│   └── bundle.sh            # Repacks release + app into a self-extracting .run
├── .lunet/                  # lunet binaries and types (gitignored; created by make deps)
├── dist/                    # Self-extracting app bundles (gitignored; make bundle)
├── sql/schema.sql          # PostgreSQL schema
├── specs/                  # RealWorld Hurl compatibility suite + OpenAPI spec
└── target/                 # Runtime files: pid, logs, local Postgres data dir (gitignored)
```

Runtime state (pid, logs) lives under `target/`; `make clean` empties it (and refuses while the server is up).

## Getting started

The disposable Compose path requires Docker and the PostgreSQL client (`psql`); [mise](https://mise.jdx.dev/) provides hurl and lua-language-server.

```bash
cp .env.example .env   # PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD, JWT_SECRET

make dev       # start disposable PostgreSQL, load sql/schema.sql, start the API
make seed      # create demo@example.com / demo-password and a demo article
make test      # run the RealWorld API compatibility suite (Hurl)
make load-test # read-dominated load test with hey, concurrency doubling 1 -> 64
make lint      # lua-language-server static analysis
make stop      # stop the server
make clean     # remove runtime files in target/
make bundle    # repack release + app into a self-extracting dist/*.run
```

`make db-down` removes the Compose container and its database volume. To use an existing PostgreSQL instance instead, skip `make db-up`, set its connection values in `.env`, then run `make init` and `make start`.

## API documentation

The local OpenAPI server is `http://localhost:8081/api`. Run `make api-docs` and open <http://localhost:8082/> to browse `specs/openapi.yml` in Swagger UI; run `make api-docs-stop` when finished.

## Binary dependencies (`.lunet/`)

`make deps` runs `scripts/lunet_fetch_release_v0.9.2.lua` to download and install the
tagged `v0.9.2` release from [lunet releases](https://github.com/lua-lunet/lunet/releases)
into `.lunet/v0.9.2/`. The fetcher verifies archive SHA-256 against release metadata,
installs atomically into a staging directory, and is idempotent:

- `lunet-run` + `lunet.so`
- drivers `lunet/{postgres,mysql,httpc,sqlite3,paxe}.so`
- `lunet/{lnt_shared,jsonic,paxe,postgres_tx,mysql_tx,sqlite3_tx}.lua` + C libraries
- `types/` LuaCATS annotations (`.luarc.json` references this directory to power `make lint`) and Teal `.d.tl` definitions

`lunet-run` prepends its own directory to `package.path` and `package.cpath`, so all
lunet modules resolve without app-side configuration. A host Lua interpreter (5.1+,
LuaJIT, or via `mise`) is required only to run the fetcher script.

Runtime shared libraries:

- **macOS**: `brew install luajit libuv libpq libsodium`
- **Debian/Ubuntu**: `apt install libluajit-5.1-2 libuv1 libpq5 libsodium23 libsqlite3-0`
  plus an unversioned `libsodium.so` symlink for FFI (created in the [Dockerfile](Dockerfile)).

## Docker

```bash
make docker-build
docker run --rm -p 8081:8081 --env-file .env realworld-lua
```

The image targets `linux/amd64` (upstream also publishes `linux-arm64` and `windows-amd64`).

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

In `.lunet/v0.9.2/` (all part of the lunet release archive):

- **dkjson** (`.lunet/v0.9.2/lunet/dkjson-encode-v2.10.lua`) — JSON encode/decode for Lua by
  David Kolf, [MIT](http://dkolf.de/dkjson-lua). The encode half of `lunet.jsonic`.
- **jsonic** (`.lunet/v0.9.2/lunet/jsonic.lua` + `.lunet/v0.9.2/lunet/liblunet_jsonic.*`) — fast JSON parser
  ([jsonic](https://github.com/g1mv/jsonic), MIT/Apache-2.0) behind lunet's FFI binding;
  the decode half. License texts: [lunet `ext/jsonic/`](https://github.com/lua-lunet/lunet/tree/v0.9.2/ext/jsonic).

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
