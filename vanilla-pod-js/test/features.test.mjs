/**
 * Feature tests against the in-memory mock backend on an ephemeral port,
 * plus unit tests for the new envelope validators, the pagination helpers,
 * and the favourite/follow/follow-feed/pagination contracts. No DOM.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHandler, createMockState } from "./realworld-mock.mjs";
import { pageItems, pageOffset, totalPages } from "../web/pagination.mjs";
import {
  validateCommentResponse,
  validateProfileResponse,
} from "../web/validators.mjs";

/** @type {import("node:http").Server} */
let server;
/** @type {string} */
let base;

before(async () => {
  server = createServer(createHandler(createMockState()));
  server.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  base = `http://127.0.0.1:${address.port}`;
});

after(() => {
  server.close();
});

/**
 * @param {string} path
 * @param {{method?: string, token?: string, body?: unknown}} [options]
 * @returns {Promise<{status: number, json: any}>}
 */
async function call(path, options = {}) {
  /** @type {Record<string, string>} */
  const headers = {};
  if (options.token) headers["authorization"] = `Token ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { status: response.status, json: text === "" ? null : JSON.parse(text) };
}

/** @returns {Promise<string>} simbo's token */
async function loginSimbo() {
  const { json } = await call("/api/users/login", {
    method: "POST",
    body: { user: { email: "simbo@example.com", password: "password123" } },
  });
  assert.equal(typeof json.user.token, "string");
  return json.user.token;
}

test("register happy path returns a tokened user and GET /api/user reflects it", async () => {
  const { status, json } = await call("/api/users", {
    method: "POST",
    body: { user: { username: "newbie", email: "newbie@example.com", password: "hunter22" } },
  });
  assert.equal(status, 201);
  assert.equal(json.user.username, "newbie");
  assert.equal(typeof json.user.token, "string");
  assert.equal(json.user.bio, null);
  assert.equal(json.user.image, null);
  const me = await call("/api/user", { token: json.user.token });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.email, "newbie@example.com");
  assert.equal(me.json.user.bio, null);
});

test("register rejects duplicate email with 409", async () => {
  const { status, json } = await call("/api/users", {
    method: "POST",
    body: { user: { username: "someone-else", email: "simbo@example.com", password: "x" } },
  });
  assert.equal(status, 409);
  assert.ok(json.errors.email.some((/** @type {string} */ m) => m.includes("taken")));
});

test("register rejects missing fields with 422", async () => {
  const { status, json } = await call("/api/users", {
    method: "POST",
    body: { user: { username: "", email: "", password: "" } },
  });
  assert.equal(status, 422);
  assert.ok("username" in json.errors && "email" in json.errors && "password" in json.errors);
});

test("settings update via PUT /api/user then GET /api/user reflects it", async () => {
  const token = await loginSimbo();
  const updated = await call("/api/user", {
    method: "PUT",
    token,
    body: { user: { bio: "Updated bio from the settings test." } },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.user.bio, "Updated bio from the settings test.");
  const me = await call("/api/user", { token });
  assert.equal(me.json.user.bio, "Updated bio from the settings test.");
});

test("favourite toggle updates favoritesCount and favorited per viewer", async () => {
  const token = await loginSimbo();
  const slug = "luajit-ffi-calling-c-without-a-single-binding";
  const before = await call(`/api/articles/${slug}`, { token });
  assert.equal(before.json.article.favorited, false);
  const on = await call(`/api/articles/${slug}/favorite`, { method: "POST", token });
  assert.equal(on.status, 200);
  assert.equal(on.json.article.favorited, true);
  assert.equal(on.json.article.favoritesCount, before.json.article.favoritesCount + 1);
  const off = await call(`/api/articles/${slug}/favorite`, { method: "DELETE", token });
  assert.equal(off.json.article.favorited, false);
  assert.equal(off.json.article.favoritesCount, before.json.article.favoritesCount);
});

test("favourite requires auth", async () => {
  const { status } = await call("/api/articles/luajit-ffi-calling-c-without-a-single-binding/favorite", { method: "POST" });
  assert.equal(status, 401);
});

test("follow toggle updates the profile flag and the feed follows the authors", async () => {
  const token = await loginSimbo();
  // simbo follows nobody initially, so the feed is empty
  const emptyFeed = await call("/api/articles/feed", { token });
  assert.equal(emptyFeed.json.articlesCount, 0);
  const follow = await call("/api/profiles/lilly/follow", { method: "POST", token });
  assert.equal(follow.status, 200);
  assert.equal(follow.json.profile.following, true);
  const feed = await call("/api/articles/feed", { token });
  assert.equal(feed.json.articlesCount, 2); // lilly's two articles
  assert.ok(feed.json.articles.every((/** @type {{author: {username: string}}} */ a) => a.author.username === "lilly"));
  const unfollow = await call("/api/profiles/lilly/follow", { method: "DELETE", token });
  assert.equal(unfollow.json.profile.following, false);
  const feedAgain = await call("/api/articles/feed", { token });
  assert.equal(feedAgain.json.articlesCount, 0);
});

test("feed without a token is 401", async () => {
  const { status, json } = await call("/api/articles/feed");
  assert.equal(status, 401);
  assert.ok("errors" in json);
});

test("article create, edit, and delete round-trip", async () => {
  const token = await loginSimbo();
  const created = await call("/api/articles", {
    method: "POST",
    token,
    body: {
      article: {
        title: "Pager math for mortals",
        description: "limit and offset, nothing more.",
        body: "Page one.\n\nPage two.",
        tagList: ["pagination"],
      },
    },
  });
  assert.equal(created.status, 201);
  const slug = created.json.article.slug;
  assert.equal(slug, "pager-math-for-mortals");
  const listed = await call("/api/articles?limit=50");
  assert.ok(listed.json.articles.some((/** @type {{slug: string}} */ a) => a.slug === slug));
  const edited = await call(`/api/articles/${slug}`, {
    method: "PUT",
    token,
    body: { article: { title: "Pager math, revised" } },
  });
  assert.equal(edited.json.article.title, "Pager math, revised");
  const gone = await call(`/api/articles/${slug}`, { method: "DELETE", token });
  assert.equal(gone.status, 204);
  const after = await call(`/api/articles/${slug}`);
  assert.equal(after.status, 404);
});

test("article edit and delete are author-only", async () => {
  const other = await call("/api/users", {
    method: "POST",
    body: { user: { username: "rival", email: "rival@example.com", password: "x" } },
  });
  const { status: putStatus } = await call("/api/articles/jtd-validation-closed-rows-at-the-trust-boundary", {
    method: "PUT",
    token: other.json.user.token,
    body: { article: { title: "hijack" } },
  });
  assert.equal(putStatus, 403);
  const { status: deleteStatus } = await call("/api/articles/jtd-validation-closed-rows-at-the-trust-boundary", {
    method: "DELETE",
    token: other.json.user.token,
  });
  assert.equal(deleteStatus, 403);
});

test("unknown slug is 404 with an errors body", async () => {
  const { status, json } = await call("/api/articles/no-such-article");
  assert.equal(status, 404);
  assert.ok("errors" in json);
});

test("comment add and delete round-trip, and delete is owner-only", async () => {
  const token = await loginSimbo();
  const slug = "jtd-validation-closed-rows-at-the-trust-boundary";
  const added = await call(`/api/articles/${slug}/comments`, {
    method: "POST",
    token,
    body: { comment: { body: "Freeze at the perimeter, always." } },
  });
  assert.equal(added.status, 201);
  assert.equal(added.json.comment.body, "Freeze at the perimeter, always.");
  const id = added.json.comment.id;
  const list = await call(`/api/articles/${slug}/comments`);
  assert.ok(list.json.comments.some((/** @type {{id: number}} */ c) => c.id === id));
  const deleted = await call(`/api/articles/${slug}/comments/${id}`, { method: "DELETE", token });
  assert.equal(deleted.status, 204);
  const listAgain = await call(`/api/articles/${slug}/comments`);
  assert.ok(!listAgain.json.comments.some((/** @type {{id: number}} */ c) => c.id === id));
  // kimi's seeded comment id 1 on this slug? no — id 1 is lilly on the VSR slug.
  const notOwner = await call("/api/articles/vsr-how-tigerbeetle-makes-replication-boring/comments/1", {
    method: "DELETE",
    token,
  });
  assert.equal(notOwner.status, 403);
});

test("comment without a body is 422", async () => {
  const token = await loginSimbo();
  const { status } = await call("/api/articles/jtd-validation-closed-rows-at-the-trust-boundary/comments", {
    method: "POST",
    token,
    body: { comment: { body: "" } },
  });
  assert.equal(status, 422);
});

test("mock pagination: 5 seeded articles page 2-per-page correctly", async () => {
  const page1 = await call("/api/articles?limit=2&offset=0");
  assert.equal(page1.json.articlesCount, 5);
  assert.equal(page1.json.articles.length, 2);
  const page2 = await call("/api/articles?limit=2&offset=2");
  assert.equal(page2.json.articles.length, 2);
  const page3 = await call("/api/articles?limit=2&offset=4");
  assert.equal(page3.json.articles.length, 1);
  const beyond = await call("/api/articles?limit=2&offset=6");
  assert.equal(beyond.json.articles.length, 0);
  // no page overlaps and all slugs are covered exactly once
  const slugs = [...page1.json.articles, ...page2.json.articles, ...page3.json.articles].map(
    (/** @type {{slug: string}} */ a) => a.slug,
  );
  assert.equal(new Set(slugs).size, 5);
});

test("mock pagination honours the tag filter inside paging", async () => {
  const ffi = await call("/api/articles?tag=ffi&limit=1&offset=1");
  assert.equal(ffi.json.articlesCount, 2);
  assert.equal(ffi.json.articles.length, 1);
});

test("totalPages: at least one page, ceiling division", () => {
  assert.equal(totalPages(0, 10), 1);
  assert.equal(totalPages(5, 10), 1);
  assert.equal(totalPages(10, 10), 1);
  assert.equal(totalPages(11, 10), 2);
  assert.equal(totalPages(25, 10), 3);
});

test("pageItems: lists every page in order, clamped to at least one", () => {
  assert.deepEqual(pageItems(3, 1), [1, 2, 3]);
  assert.deepEqual(pageItems(5, 3), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageItems(0, 1), [1]);
});

test("pageOffset: 1-based page to 0-based offset", () => {
  assert.equal(pageOffset(1, 10), 0);
  assert.equal(pageOffset(2, 10), 10);
  assert.equal(pageOffset(3, 10), 20);
});

test("profile envelope validator accepts a good profile and rejects a bad one", () => {
  assert.deepEqual(
    validateProfileResponse({ profile: { username: "lilly", bio: "bio", image: "", following: false } }),
    [],
  );
  const errors = validateProfileResponse({ profile: { username: 42, following: "yes" } });
  assert.ok(errors.some((e) => e.instancePath === "/profile/username"));
  assert.ok(errors.some((e) => e.instancePath === "/profile/following"));
});

test("comment envelope validator accepts a good comment and rejects a bad one", () => {
  const good = {
    comment: {
      id: 7,
      createdAt: "2026-09-28T10:00:00.000Z",
      updatedAt: "2026-09-28T10:00:00.000Z",
      body: "hi",
      author: { username: "kimi", following: false },
    },
  };
  assert.deepEqual(validateCommentResponse(good), []);
  const errors = validateCommentResponse({ comment: { ...good.comment, id: "seven" } });
  assert.ok(errors.some((e) => e.instancePath === "/comment/id"));
});
