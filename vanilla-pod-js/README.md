# vanilla-pod-js — RealWorld Conduit frontend

[RealWorld](https://github.com/gothinkster/realworld) Conduit — full feature
parity — written in the **vanilla-pod-js** convention: framework-free,
bundler-free, transpile-free browser JavaScript.

## What this is, and is not

- **No framework.** No React, no hooks, no VDOM. Light-DOM web components
  (custom elements) render the RealWorld theme markup directly.
- **No bundler.** The browser loads the exact `.mjs` files in this tree via
  native ES modules. No transpilation, no build step, no `.d.ts` files.
  Build steps before first paint: **zero**.
- **JSDoc type checking.** `tsc --noEmit` (module `node16`, strict) checks
  the whole tree; it never emits.
- **JTD schemas → generated validators.** The wire contract for article,
  comment, and user rows is RFC 8927 JSON Type Definition
  (`schemas/*.jtd.json`), compiled by `jtd-codegen` into dependency-free
  validator modules (`generated/`).
- **Fail-closed kernel.** Every API response passes through
  `src/kernel.mjs`: parse → validate (error-array, never throws) →
  `structuralFreeze` → typed envelope. The first invalid body throws with
  its `instancePath`/`schemaPath` diagnostics; unvalidated data is never
  yielded, never dropped, never coerced.
- **In-memory auth only.** The signed-in user (with token) lives in a frozen
  module store; nothing auth-shaped touches localStorage.
- **No dead CDNs.** Avatars are inline SVG data-URIs; the stylesheet is the
  canonical RealWorld theme served byte-identical from `main.css`
  (sha256 `f4b3d622…`).

## Features

Home (global feed / your feed tabs, tag filter, 10-per-page pagination),
sign in, sign up, settings (edit user), editor (create / edit article with
tag pills), article delete (author-only), article page (favourite toggle,
author follow toggle, comment add, delete own comment), profile pages
(authored + favourited articles).

## Run it

The frontend speaks the RealWorld API contract over relative `/api/...`, so
any static file server plus any RealWorld backend works.

With this repository's stack:

```sh
# from the repository root
./scripts/frontend-vanilla-pod.sh   # install this frontend into edge/public/
make start                          # lunet backend on :8081
./.lunet/v0.9.2/lunet-run edge/server.lua   # edge serves the frontend on :8083
```

Then open <http://localhost:8083/>. Seeded demo login:
`demo@example.com` / `demo-password` (see `scripts/seed.sh`).

For a production-shaped front, use nginx with gzip + cache headers — see
[`nginx.conf.example`](nginx.conf.example) (statics on a high port, `/api/`
proxied to the backend).

## Check gate

```sh
npm install                        # devDependencies only; zero runtime deps
./node_modules/.bin/tsc --noEmit   # types the whole tree, emits nothing
node --test test/                  # boundary + feature tests (in-process mock)
```

`test/realworld-mock.mjs` is a test-only, in-process RealWorld backend
used by `node --test`; it is never served and never ships to the browser.
The generated validators in `generated/` are committed, so the browser runs
plain files with no codegen step in the serve path.

## Attribution

- Theme (`main.css`): code & design from the
  [RealWorld](https://github.com/realworld-apps/realworld) demo (MIT);
  bundles Bootstrap v4 (MIT, © Twitter, Inc.). Original CDN defunct;
  vendored from a
  [Wayback Machine snapshot](https://web.archive.org/web/20250708043359/https://demo.productionready.io/main.css).
- Icons/fonts load from CDNs in the browser:
  [Ionicons](https://ionicons.com) (MIT), Google Fonts (SIL OFL 1.1).
- Built under the [prompt-cult](https://github.com/prompt-cult) `vanilla-pod-js`
  convention (JTD-validated frozen data, typed fetchers, light-DOM web
  components, zero runtime dependencies, no build step).

## Licence

[MIT](LICENSE) — same as the repository root.
