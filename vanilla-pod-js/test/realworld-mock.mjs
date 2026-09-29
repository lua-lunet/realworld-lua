/**
 * Zero-dependency mock backend for the RealWorld Conduit frontend.
 * Full Conduit API surface, in-memory state only; a restart reseeds the
 * shared fixture (ticket 377 == ticket 378): 5 articles by 3 authors
 * (simbo, lilly, kimi) across 3 tags (vsr, ffi, validation), comments on
 * the first two articles, demo login simbo@example.com / password123.
 *
 * Contract notes (pinned by the official hurl compat suite):
 * - list responses (GET /api/articles, /api/articles/feed) omit the body
 *   field; the single-article response carries it;
 * - empty bio/image serialise as null, never as "" ;
 * - 401 {errors:{token:["is missing"|"is invalid"]}}, 403 {article|comment:["forbidden"]},
 *   404 {...:["not found"]}, 409 {username|email:["has already been taken"]},
 *   422 per-field ["can't be blank"] errors;
 * - deletes answer 204 with an empty body;
 * - lists are newest-first with an insertion-order tiebreak;
 * - PUT /api/user enforces a NIST 800-63B-shaped password policy (>= 8 chars).
 *
 * Avatars for the seed authors are inline SVG data-URIs (initials, distinct
 * fills) so the demo never rots on a dead image CDN again; newly registered
 * users have no image and the frontend falls back to its own data-URI.
 */
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const PORT = 13002;

/** Distinct inline-SVG initial avatars per seed author. */
export const AVATARS = {
  simbo:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' rx='6' fill='%233d5a80'/%3E%3Ctext x='24' y='31' font-family='sans-serif' font-size='20' fill='%23ffffff' text-anchor='middle'%3ES%3C/text%3E%3C/svg%3E",
  lilly:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' rx='6' fill='%23984e39'/%3E%3Ctext x='24' y='31' font-family='sans-serif' font-size='20' fill='%23ffffff' text-anchor='middle'%3EL%3C/text%3E%3C/svg%3E",
  kimi:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' rx='6' fill='%234a6d4f'/%3E%3Ctext x='24' y='31' font-family='sans-serif' font-size='20' fill='%23ffffff' text-anchor='middle'%3EK%3C/text%3E%3C/svg%3E",
};

/**
 * Fresh in-memory state. Seeded deterministically; nothing persists.
 */
export function createMockState() {
  const users = [
    { username: "simbo", email: "simbo@example.com", password: "password123", bio: "Writes about replication and systems software.", image: AVATARS.simbo },
    { username: "lilly", email: "lilly@example.com", password: "password123", bio: "Lua, FFI, and the strange corners of dynamic languages.", image: AVATARS.lilly },
    { username: "kimi", email: "kimi@example.com", password: "password123", bio: "Storage tinkerer.", image: AVATARS.kimi },
  ];

  const articleRows = [
    {
      slug: "vsr-how-tigerbeetle-makes-replication-boring",
      title: "VSR: how TigerBeetle makes replication boring",
      description: "Viewstamped replication, read slowly, until it stops being scary.",
      body: "TigerBeetle ships Viewstamped Replication because the protocol, not the hardware, carries the safety story.\n\nA client proposal, a leader ballot, a follower ack, a commit: VSR makes each step boring on purpose.\n\nRead it twice and the quorum math stops being exotic.",
      tagList: ["vsr"],
      createdAt: "2026-09-21T08:00:00.000Z",
      updatedAt: "2026-09-21T08:00:00.000Z",
      seedFavorites: 3,
      author: "simbo",
      seq: 0,
    },
    {
      slug: "luajit-ffi-calling-c-without-a-single-binding",
      title: "LuaJIT FFI: calling C without a single binding",
      description: "Declare the struct, call the function, skip the binding layer entirely.",
      body: "The LuaJIT FFI lets you declare a C type in Lua and call the library directly.\n\nNo header parsing, no generated glue, no swig.\n\nThe contract is yours to declare, which is exactly why it is fast and exactly why it bites.",
      tagList: ["ffi"],
      createdAt: "2026-09-23T10:30:00.000Z",
      updatedAt: "2026-09-23T10:30:00.000Z",
      seedFavorites: 0,
      author: "lilly",
      seq: 1,
    },
    {
      slug: "teal-tooling-types-for-lua-you-can-actually-adopt",
      title: "Teal tooling: types for Lua you can actually adopt",
      description: "A gradual type layer that fits the FFI world instead of fighting it.",
      body: "Teal gives Lua a type layer you can adopt one file at a time.\n\nWhere the FFI hands you raw pointers, Teal hands you declarations.\n\nAdopt it around the edges first.",
      tagList: ["ffi"],
      createdAt: "2026-09-24T14:15:00.000Z",
      updatedAt: "2026-09-24T14:15:00.000Z",
      seedFavorites: 1,
      author: "lilly",
      seq: 2,
    },
    {
      slug: "uvrr-replication-checked-against-the-vsr-write-up",
      title: "uVRR replication, checked against the VSR write-up",
      description: "A userspace replication core, tested the way the VSR paper suggests.",
      body: "uVRR keeps replication in userspace, where you can test it.\n\nPair it with the VSR write-up and the failure schedules line up.\n\nSame quorum story, smaller blast radius.",
      tagList: ["vsr"],
      createdAt: "2026-09-25T19:45:00.000Z",
      updatedAt: "2026-09-25T19:45:00.000Z",
      seedFavorites: 0,
      author: "kimi",
      seq: 3,
    },
    {
      slug: "jtd-validation-closed-rows-at-the-trust-boundary",
      title: "JTD validation: closed rows at the trust boundary",
      description: "RFC 8927 schemas, generated validators, and error arrays you can quote.",
      body: "JSON Type Definition is the schema you wish the wire had.\n\nGenerate the validator, validate before use, freeze after validation.\n\nThe error array is the whole report: instancePath and schemaPath, nothing else.",
      tagList: ["validation"],
      createdAt: "2026-09-26T11:20:00.000Z",
      updatedAt: "2026-09-26T11:20:00.000Z",
      seedFavorites: 2,
      author: "simbo",
      seq: 4,
    },
  ];

  return {
    users,
    /** @type {Map<string, string>} token -> username */
    tokens: new Map(),
    /** @type {Map<string, Set<string>>} username -> followed usernames */
    follows: new Map(),
    /** @type {Map<string, Set<string>>} slug -> usernames who favourited */
    favorites: new Map(),
    articles: articleRows,
    /** @type {Map<string, Array<{id: number, createdAt: string, updatedAt: string, body: string, author: string}>>} */
    comments: new Map([
      [
        "vsr-how-tigerbeetle-makes-replication-boring",
        [
          { id: 1, createdAt: "2026-09-22T09:10:00.000Z", updatedAt: "2026-09-22T09:10:00.000Z", body: "The quorum analogy finally made VSR click for me. Great write-up.", author: "lilly" },
          { id: 2, createdAt: "2026-09-22T15:40:00.000Z", updatedAt: "2026-09-22T15:40:00.000Z", body: "I replayed the replication math in a sandbox and got the same numbers.", author: "kimi" },
        ],
      ],
      [
        "luajit-ffi-calling-c-without-a-single-binding",
        [
          { id: 3, createdAt: "2026-09-24T08:05:00.000Z", updatedAt: "2026-09-24T08:05:00.000Z", body: "FFI with zero bindings is criminally under-taught. More like this, please.", author: "simbo" },
        ],
      ],
    ]),
    nextCommentId: 4,
    nextSeq: 5,
  };
}

/** @typedef {ReturnType<typeof createMockState>} MockState */

/**
 * JWT-shaped token (deterministic fixture, not a real credential).
 * @param {string} email
 * @param {string} username
 * @returns {string}
 */
function tokenFor(email, username) {
  const enc = (/** @type {unknown} */ value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = enc({ alg: "HS256", typ: "JWT" });
  const payload = enc({ email, sub: username, iat: 1759000000 });
  return `${header}.${payload}.fixture-signature`;
}

/** @param {string | null | undefined} value @returns {string | null} */
function nullable(value) {
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * @param {MockState} state
 * @param {MockState["users"][number]} user
 * @param {string | null} viewer
 */
function profileRow(state, user, viewer) {
  return {
    username: user.username,
    bio: nullable(user.bio),
    image: nullable(user.image),
    following: viewer !== null && (state.follows.get(viewer)?.has(user.username) ?? false),
  };
}

/**
 * Wire shape of one article, projected for the viewer's token. List rows
 * omit the body field.
 * @param {MockState} state
 * @param {MockState["articles"][number]} row
 * @param {string | null} viewer
 * @param {{list?: boolean}} [options]
 */
function articleRow(state, row, viewer, options = {}) {
  const favoritesSet = state.favorites.get(row.slug);
  const author = state.users.find((u) => u.username === row.author);
  /** @type {Record<string, unknown>} */
  const out = {
    slug: row.slug,
    title: row.title,
    description: row.description,
    tagList: [...row.tagList],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    favorited: favoritesSet !== undefined && viewer !== null && favoritesSet.has(viewer),
    favoritesCount: row.seedFavorites + (favoritesSet ? favoritesSet.size : 0),
    author: author
      ? { username: author.username, bio: nullable(author.bio), image: nullable(author.image), following: viewer !== null && (state.follows.get(viewer)?.has(author.username) ?? false) }
      : { username: row.author, bio: null, image: null, following: false },
  };
  if (!options.list) out.body = row.body;
  return out;
}

/**
 * Newest first; insertion order breaks createdAt ties deterministically.
 * @param {MockState} state
 * @returns {MockState["articles"]}
 */
function sortedNewestFirst(state) {
  return state.articles
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      if (a.row.createdAt !== b.row.createdAt) return a.row.createdAt < b.row.createdAt ? 1 : -1;
      return b.index - a.index;
    })
    .map((entry) => entry.row);
}

/**
 * @param {string} title
 * @param {MockState} state
 * @returns {string}
 */
function slugFor(title, state) {
  const base = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "article";
  let slug = base;
  let n = 2;
  while (state.articles.some((a) => a.slug === slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

/**
 * @param {string | null} [value]
 * @returns {number}
 */
function positiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/**
 * @param {import("node:http").IncomingMessage} request
 * @returns {Promise<Record<string, unknown>>}
 */
function readBody(request) {
  return new Promise((resolve) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      try {
        const parsed = JSON.parse(raw || "{}");
        resolve(parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * @param {import("node:http").IncomingMessage} request
 * @param {MockState} state
 * @returns {string | null} username for the token, or null
 */
function viewerFor(request, state) {
  const header = request.headers["authorization"] || "";
  const match = /^Token (.+)$/i.exec(String(header));
  if (!match) return null;
  return state.tokens.get(match[1]) ?? null;
}

/**
 * 401 body per the official contract: distinguishes a missing Authorization
 * header from an unknown token.
 * @param {import("node:http").IncomingMessage} request
 */
function tokenError(request) {
  const header = request.headers["authorization"];
  return header
    ? { errors: { token: ["is invalid"] } }
    : { errors: { token: ["is missing"] } };
}

/**
 * @param {unknown} value
 * @returns {boolean} true when the value is a non-empty string
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value !== "";
}

/**
 * @param {MockState} state
 * @returns {import("node:http").RequestListener}
 */
export function createHandler(state) {
  /**
   * @param {import("node:http").IncomingMessage} request
   * @param {import("node:http").ServerResponse} response
   */
  return (request, response) => {
    void (async () => {
      const url = new URL(request.url || "/", `http://127.0.0.1:${PORT}`);
      const method = request.method || "GET";
      /** @type {(status: number, body?: unknown) => void} */
      const send = (status, body = undefined) => {
        if (status === 204) {
          response.writeHead(204, {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
            "access-control-allow-headers": "content-type, authorization",
          });
          response.end();
          return;
        }
        const payload = JSON.stringify(body);
        response.writeHead(status, {
          "content-type": "application/json; charset=utf-8",
          "content-length": Buffer.byteLength(payload),
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
          "access-control-allow-headers": "content-type, authorization",
        });
        response.end(payload);
      };
      if (method === "OPTIONS") {
        send(204);
        return;
      }

      const viewer = viewerFor(request, state);

      // --- tags ---------------------------------------------------------
      if (method === "GET" && url.pathname === "/api/tags") {
        send(200, { tags: [...new Set(state.articles.flatMap((a) => a.tagList))] });
        return;
      }

      // --- auth ----------------------------------------------------------
      if (method === "POST" && url.pathname === "/api/users/login") {
        const body = await readBody(request);
        const credentials = /** @type {Record<string, unknown>} */ (body.user || {});
        const email = typeof credentials.email === "string" ? credentials.email : "";
        const password = typeof credentials.password === "string" ? credentials.password : "";
        if (email === "") {
          send(422, { errors: { email: ["can't be blank"] } });
          return;
        }
        if (password === "") {
          send(422, { errors: { password: ["can't be blank"] } });
          return;
        }
        const user = state.users.find((u) => u.email === email && u.password === password);
        if (!user) {
          send(401, { errors: { credentials: ["invalid"] } });
          return;
        }
        const token = tokenFor(user.email, user.username);
        state.tokens.set(token, user.username);
        send(200, { user: { email: user.email, token, username: user.username, bio: nullable(user.bio), image: nullable(user.image) } });
        return;
      }

      if (method === "POST" && url.pathname === "/api/users") {
        const body = await readBody(request);
        const input = /** @type {Record<string, unknown>} */ (body.user || {});
        const username = typeof input.username === "string" ? input.username.trim() : "";
        const email = typeof input.email === "string" ? input.email.trim() : "";
        const password = typeof input.password === "string" ? input.password : "";
        /** @type {Record<string, string[]>} */
        const fieldErrors = {};
        if (!isNonEmptyString(username)) fieldErrors.username = ["can't be blank"];
        if (!isNonEmptyString(email)) fieldErrors.email = ["can't be blank"];
        if (!isNonEmptyString(password)) fieldErrors.password = ["can't be blank"];
        if (isNonEmptyString(username) && state.users.some((u) => u.username === username)) {
          fieldErrors.username = ["has already been taken"];
        }
        if (isNonEmptyString(email) && state.users.some((u) => u.email === email)) {
          fieldErrors.email = ["has already been taken"];
        }
        if (Object.keys(fieldErrors).length > 0) {
          const conflict = Object.values(fieldErrors).flat().includes("has already been taken");
          send(conflict ? 409 : 422, { errors: fieldErrors });
          return;
        }
        const user = { username, email, password, bio: "", image: "" };
        state.users.push(user);
        const token = tokenFor(email, username);
        state.tokens.set(token, username);
        send(201, { user: { email, token, username, bio: null, image: null } });
        return;
      }

      if (url.pathname === "/api/user") {
        if (viewer === null) {
          send(401, tokenError(request));
          return;
        }
        const user = state.users.find((u) => u.username === viewer);
        if (!user) {
          send(401, tokenError(request));
          return;
        }
        if (method === "GET") {
          const token = tokenFor(user.email, user.username);
          state.tokens.set(token, user.username);
          send(200, { user: { email: user.email, token, username: user.username, bio: nullable(user.bio), image: nullable(user.image) } });
          return;
        }
        if (method === "PUT") {
          const body = await readBody(request);
          const input = /** @type {Record<string, unknown>} */ (body.user || {});
          /** @type {Record<string, string[]>} */
          const fieldErrors = {};
          if ("email" in input) {
            if (!isNonEmptyString(typeof input.email === "string" ? input.email.trim() : null)) {
              fieldErrors.email = ["can't be blank"];
            } else if (state.users.some((u) => u.email === input.email && u.username !== viewer)) {
              fieldErrors.email = ["has already been taken"];
            }
          }
          if ("username" in input) {
            if (!isNonEmptyString(typeof input.username === "string" ? input.username.trim() : null)) {
              fieldErrors.username = ["can't be blank"];
            } else if (state.users.some((u) => u.username === input.username && u.username !== viewer)) {
              fieldErrors.username = ["has already been taken"];
            }
          }
          if ("password" in input) {
            if (!isNonEmptyString(input.password)) fieldErrors.password = ["can't be blank"];
            else if (/** @type {string} */ (input.password).length < 8) fieldErrors.password = ["must be at least 8 characters"];
          }
          if (Object.keys(fieldErrors).length > 0) {
            send(422, { errors: fieldErrors });
            return;
          }
          if (typeof input.email === "string") user.email = input.email.trim();
          if (typeof input.username === "string" && input.username.trim() !== "") {
            const renamed = input.username.trim();
            for (const [token, owner] of state.tokens) if (owner === viewer) state.tokens.set(token, renamed);
            for (const set of state.follows.values()) {
              if (set.has(viewer)) {
                set.delete(viewer);
                set.add(renamed);
              }
            }
            for (const set of state.favorites.values()) {
              if (set.has(viewer)) {
                set.delete(viewer);
                set.add(renamed);
              }
            }
            for (const row of state.articles) if (row.author === viewer) row.author = renamed;
            for (const list of state.comments.values()) for (const c of list) if (c.author === viewer) c.author = renamed;
            user.username = renamed;
          }
          if (typeof input.bio === "string") user.bio = input.bio;
          else if ("bio" in input && input.bio === null) user.bio = "";
          if (typeof input.image === "string") user.image = input.image;
          else if ("image" in input && input.image === null) user.image = "";
          if (typeof input.password === "string" && input.password.length >= 8) user.password = input.password;
          const freshToken = tokenFor(user.email, user.username);
          state.tokens.set(freshToken, user.username);
          send(200, { user: { email: user.email, token: freshToken, username: user.username, bio: nullable(user.bio), image: nullable(user.image) } });
          return;
        }
      }

      // --- feed ----------------------------------------------------------
      if (method === "GET" && url.pathname === "/api/articles/feed") {
        if (viewer === null) {
          send(401, tokenError(request));
          return;
        }
        const followed = state.follows.get(viewer) ?? new Set();
        const limit = positiveInt(url.searchParams.get("limit")) || 20;
        const offset = positiveInt(url.searchParams.get("offset")) || 0;
        const feed = sortedNewestFirst(state).filter((a) => followed.has(a.author));
        send(200, {
          articles: feed.slice(offset, offset + limit).map((row) => articleRow(state, row, viewer, { list: true })),
          articlesCount: feed.length,
        });
        return;
      }

      // --- articles collection --------------------------------------------
      if (method === "GET" && url.pathname === "/api/articles") {
        const tag = url.searchParams.get("tag") || "";
        const author = url.searchParams.get("author") || "";
        const favorited = url.searchParams.get("favorited") || "";
        const limit = positiveInt(url.searchParams.get("limit")) || 20;
        const offset = positiveInt(url.searchParams.get("offset")) || 0;
        let filtered = sortedNewestFirst(state);
        if (tag !== "") filtered = filtered.filter((a) => a.tagList.includes(tag));
        if (author !== "") filtered = filtered.filter((a) => a.author === author);
        if (favorited !== "") {
          filtered = filtered.filter((a) => (state.favorites.get(a.slug) ?? new Set()).has(favorited));
        }
        send(200, {
          articles: filtered.slice(offset, offset + limit).map((row) => articleRow(state, row, viewer, { list: true })),
          articlesCount: filtered.length,
        });
        return;
      }

      if (method === "POST" && url.pathname === "/api/articles") {
        if (viewer === null) {
          send(401, tokenError(request));
          return;
        }
        const body = await readBody(request);
        const input = /** @type {Record<string, unknown>} */ (body.article || {});
        const title = typeof input.title === "string" ? input.title.trim() : "";
        const description = typeof input.description === "string" ? input.description.trim() : "";
        const text = typeof input.body === "string" ? input.body : "";
        /** @type {string[]} */
        const tagList = Array.isArray(input.tagList) ? input.tagList.filter((t) => typeof t === "string" && t !== "") : [];
        /** @type {Record<string, string[]>} */
        const fieldErrors = {};
        if (!isNonEmptyString(title)) fieldErrors.title = ["can't be blank"];
        if (!isNonEmptyString(description)) fieldErrors.description = ["can't be blank"];
        if (!isNonEmptyString(text)) fieldErrors.body = ["can't be blank"];
        if (Object.keys(fieldErrors).length > 0) {
          send(422, { errors: fieldErrors });
          return;
        }
        const now = new Date().toISOString();
        const row = {
          slug: slugFor(title, state),
          title,
          description,
          body: text,
          tagList,
          createdAt: now,
          updatedAt: now,
          seedFavorites: 0,
          author: viewer,
          seq: state.nextSeq,
        };
        state.nextSeq += 1;
        state.articles.push(row);
        send(201, { article: articleRow(state, row, viewer) });
        return;
      }

      // --- single article + favourite + comments ---------------------------
      const articleMatch = /^\/api\/articles\/([^/]+)(?:\/(comments|favorite))?(?:\/(\d+))?$/.exec(url.pathname);
      if (articleMatch) {
        const slug = decodeURIComponent(articleMatch[1]);
        const sub = articleMatch[2];
        const row = state.articles.find((a) => a.slug === slug);

        if (sub === undefined) {
          if (method === "GET") {
            if (!row) {
              send(404, { errors: { article: ["not found"] } });
              return;
            }
            send(200, { article: articleRow(state, row, viewer) });
            return;
          }
          if (method === "PUT" || method === "DELETE") {
            if (viewer === null) {
              send(401, tokenError(request));
              return;
            }
            if (!row) {
              send(404, { errors: { article: ["not found"] } });
              return;
            }
            if (row.author !== viewer) {
              send(403, { errors: { article: ["forbidden"] } });
              return;
            }
            if (method === "PUT") {
              const body = await readBody(request);
              const input = /** @type {Record<string, unknown>} */ (body.article || {});
              if ("tagList" in input && !Array.isArray(input.tagList)) {
                send(422, { errors: { tagList: ["can't be blank"] } });
                return;
              }
              if (typeof input.title === "string" && input.title.trim() !== "") row.title = input.title.trim();
              if (typeof input.description === "string" && input.description.trim() !== "") row.description = input.description.trim();
              if (typeof input.body === "string" && input.body !== "") row.body = input.body;
              if (Array.isArray(input.tagList)) row.tagList = input.tagList.filter((t) => typeof t === "string" && t !== "");
              row.updatedAt = new Date(Math.max(Date.now(), Date.parse(row.createdAt) + 1)).toISOString();
              send(200, { article: articleRow(state, row, viewer) });
              return;
            }
            state.articles = state.articles.filter((a) => a.slug !== slug);
            state.comments.delete(slug);
            state.favorites.delete(slug);
            send(204);
            return;
          }
        }

        if (sub === "favorite") {
          if (viewer === null) {
            send(401, tokenError(request));
            return;
          }
          if (!row) {
            send(404, { errors: { article: ["not found"] } });
            return;
          }
          let set = state.favorites.get(slug);
          if (set === undefined) {
            set = new Set();
            state.favorites.set(slug, set);
          }
          if (method === "POST") set.add(viewer);
          else if (method === "DELETE") set.delete(viewer);
          else {
            send(404, { errors: { route: ["not found"] } });
            return;
          }
          send(200, { article: articleRow(state, row, viewer) });
          return;
        }

        if (sub === "comments") {
          if (method === "GET") {
            if (!state.comments.has(slug) && !row) {
              send(404, { errors: { article: ["not found"] } });
              return;
            }
            const list = state.comments.get(slug) ?? [];
            send(200, {
              comments: list.map((c) => {
                const author = state.users.find((u) => u.username === c.author);
                return {
                  id: c.id,
                  createdAt: c.createdAt,
                  updatedAt: c.updatedAt,
                  body: c.body,
                  author: author
                    ? { username: author.username, bio: nullable(author.bio), image: nullable(author.image), following: viewer !== null && (state.follows.get(viewer)?.has(author.username) ?? false) }
                    : { username: c.author, bio: null, image: null, following: false },
                };
              }),
            });
            return;
          }
          if (method === "POST") {
            if (viewer === null) {
              send(401, tokenError(request));
              return;
            }
            if (!row) {
              send(404, { errors: { article: ["not found"] } });
              return;
            }
            const body = await readBody(request);
            const input = /** @type {Record<string, unknown>} */ (body.comment || {});
            const text = typeof input.body === "string" ? input.body.trim() : "";
            if (text === "") {
              send(422, { errors: { body: ["can't be blank"] } });
              return;
            }
            const now = new Date().toISOString();
            const comment = { id: state.nextCommentId, createdAt: now, updatedAt: now, body: text, author: viewer };
            state.nextCommentId += 1;
            const list = state.comments.get(slug) ?? [];
            list.push(comment);
            state.comments.set(slug, list);
            const author = state.users.find((u) => u.username === viewer);
            send(201, {
              comment: {
                id: comment.id,
                createdAt: comment.createdAt,
                updatedAt: comment.updatedAt,
                body: comment.body,
                author: author
                  ? { username: author.username, bio: nullable(author.bio), image: nullable(author.image), following: state.follows.get(viewer)?.has(author.username) ?? false }
                  : { username: viewer, bio: null, image: null, following: false },
              },
            });
            return;
          }
          if (method === "DELETE") {
            if (viewer === null) {
              send(401, tokenError(request));
              return;
            }
            if (!row && !state.comments.has(slug)) {
              send(404, { errors: { article: ["not found"] } });
              return;
            }
            const id = Number(articleMatch[3]);
            const list = state.comments.get(slug) ?? [];
            const comment = list.find((c) => c.id === id);
            if (comment === undefined) {
              send(404, { errors: { comment: ["not found"] } });
              return;
            }
            if (comment.author !== viewer) {
              send(403, { errors: { comment: ["forbidden"] } });
              return;
            }
            state.comments.set(slug, list.filter((c) => c.id !== id));
            send(204);
            return;
          }
        }
      }

      // --- profiles ---------------------------------------------------------
      const profileMatch = /^\/api\/profiles\/([^/]+)(?:\/follow)?$/.exec(url.pathname);
      if (profileMatch) {
        const username = decodeURIComponent(profileMatch[1]);
        const wantsFollow = url.pathname.endsWith("/follow");
        const user = state.users.find((u) => u.username === username);
        if (wantsFollow) {
          if (viewer === null) {
            send(401, tokenError(request));
            return;
          }
          if (!user) {
            send(404, { errors: { profile: ["not found"] } });
            return;
          }
          if (method === "POST" || method === "DELETE") {
            let set = state.follows.get(viewer);
            if (set === undefined) {
              set = new Set();
              state.follows.set(viewer, set);
            }
            if (method === "POST") set.add(username);
            else set.delete(username);
            send(200, { profile: profileRow(state, user, viewer) });
            return;
          }
        }
        if (method === "GET") {
          if (!user) {
            send(404, { errors: { profile: ["not found"] } });
            return;
          }
          send(200, { profile: profileRow(state, user, viewer) });
          return;
        }
      }

      send(404, { errors: { route: ["not found"] } });
    })().catch((error) => {
      const payload = JSON.stringify({ errors: { body: [String((error && error.message) || error)] } });
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(payload);
    });
  };
}

const isMain = (() => {
  try {
    return process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
  } catch {
    return false;
  }
})();

if (isMain) {
  const server = createServer(createHandler(createMockState()));
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`realworld-mock listening on http://127.0.0.1:${PORT}`);
  });
}
