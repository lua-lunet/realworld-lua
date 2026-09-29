/**
 * Boundary tests with fakes: generated validators reject bad payloads with
 * error pairs; envelope validators compose them with JSON Pointer prefixes;
 * the object kernel fails closed; the login path accepts the happy response.
 * No network, no DOM — fixtures are plain objects.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateArticleListResponse,
  validateArticleResponse,
  validateCommentsResponse,
  validateLoginResponse,
  validateTagsResponse,
  validateArticle,
  validateComment,
  validateUser,
} from "../web/validators.mjs";
import { objectKernel } from "../src/kernel.mjs";

/** @type {import("../web/validators.mjs").ArticleRow} */
const goodArticle = {
  slug: "vsr-how-tigerbeetle-makes-replication-boring",
  title: "VSR: how TigerBeetle makes replication boring",
  description: "Viewstamped replication, read slowly.",
  body: "Paragraph one.\n\nParagraph two.",
  tagList: ["vsr"],
  createdAt: "2026-09-21T08:00:00.000Z",
  updatedAt: "2026-09-21T08:00:00.000Z",
  favorited: false,
  favoritesCount: 3,
  author: { username: "simbo", following: false, bio: "bio", image: "" },
};

/** @type {import("../web/validators.mjs").CommentRow} */
const goodComment = {
  id: 1,
  createdAt: "2026-09-22T09:10:00.000Z",
  updatedAt: "2026-09-22T09:10:00.000Z",
  body: "The quorum analogy finally made VSR click for me.",
  author: { username: "lilly", following: false },
};

/** @type {import("../web/validators.mjs").UserRow} */
const goodUser = {
  email: "simbo@example.com",
  token: "eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6InNpbWJvQGV4YW1wbGUuY29tIn0.fixture-signature",
  username: "simbo",
  bio: "Writes about replication and systems software.",
  image: "",
};

const obs = { info() {}, warn() {} };

test("article validator accepts a good row with an empty error array", () => {
  assert.deepEqual(validateArticle(goodArticle), []);
});

test("article validator rejects a wrong-type field with error pairs", () => {
  const errors = validateArticle({ ...goodArticle, title: 42 });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].instancePath, "/title");
  assert.equal(errors[0].schemaPath, "/properties/title/type");
});

test("article validator rejects a missing required property", () => {
  const { slug, ...withoutSlug } = goodArticle;
  const errors = validateArticle(withoutSlug);
  assert.ok(errors.some((e) => e.instancePath === "" && e.schemaPath === "/properties/slug"));
});

test("article validator rejects an undeclared extra property", () => {
  const errors = validateArticle({ ...goodArticle, bogus: "nope" });
  assert.ok(errors.some((e) => e.instancePath === "/bogus"));
});

test("empty and absent optional fields: empty tagList and absent bio accepted", () => {
  const errors = validateArticle({
    ...goodArticle,
    tagList: [],
    author: { username: "kimi", following: false },
  });
  assert.deepEqual(errors, []);
});

test("comment validator rejects a bad author row", () => {
  const errors = validateComment({ ...goodComment, author: { following: false } });
  assert.ok(errors.some((e) => e.instancePath === "/author" && e.schemaPath === "/properties/author/properties/username"));
});

test("user validator rejects an absent token", () => {
  const { token, ...withoutToken } = goodUser;
  const errors = validateUser(withoutToken);
  assert.ok(errors.some((e) => e.instancePath === "" && e.schemaPath === "/properties/token"));
});

test("article-list envelope validator prefixes pointers into the envelope", () => {
  const errors = validateArticleListResponse({
    articles: [{ ...goodArticle, favoritesCount: "many" }],
    articlesCount: 1,
  });
  assert.ok(errors.some((e) => e.instancePath === "/articles/0/favoritesCount"));
  assert.ok(errors.some((e) => e.schemaPath.startsWith("/properties/articles/elements/properties/favoritesCount")));
});

test("article-list envelope validator rejects a missing articlesCount", () => {
  const errors = validateArticleListResponse({ articles: [goodArticle] });
  assert.ok(errors.some((e) => e.instancePath === "/articlesCount"));
});

test("single-article envelope validator accepts the fixture envelope", () => {
  assert.deepEqual(validateArticleResponse({ article: goodArticle }), []);
});

test("comments envelope validator accepts a comment list", () => {
  assert.deepEqual(validateCommentsResponse({ comments: [goodComment] }), []);
});

test("tags envelope validator rejects a non-string tag", () => {
  const errors = validateTagsResponse({ tags: ["vsr", 42] });
  assert.ok(errors.some((e) => e.instancePath === "/tags/1"));
});

test("login envelope validator accepts the happy-path user", () => {
  assert.deepEqual(validateLoginResponse({ user: goodUser }), []);
});

test("kernel accepts a valid envelope and returns it deeply frozen", async () => {
  const fakeFetch = async () => ({ article: goodArticle });
  const result = /** @type {Readonly<import("../web/validators.mjs").ArticleEnvelope>} */ (
    await objectKernel({ name: "article", validate: validateArticleResponse }, obs, fakeFetch, null, "unused")
  );
  assert.equal(result.article.title, goodArticle.title);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.article));
  assert.ok(Object.isFrozen(result.article.author));
});

test("kernel fails closed on an invalid API body", async () => {
  const badFetch = async () => ({ article: { ...goodArticle, title: 42 } });
  await assert.rejects(
    () => objectKernel({ name: "article", validate: validateArticleResponse }, obs, badFetch, null, "unused"),
    /validation failed/,
  );
});

test("kernel fails closed when the body is not an object", async () => {
  const arrayFetch = async () => [goodArticle];
  await assert.rejects(
    () => objectKernel({ name: "article", validate: validateArticleResponse }, obs, arrayFetch, null, "unused"),
    /not a JSON object/,
  );
});

test("kernel fail-closed diagnostics carry instancePath and schemaPath", async () => {
  const badFetch = async () => ({ user: { email: 42, token: "t", username: "s" } });
  await assert.rejects(
    () => objectKernel({ name: "login", validate: validateLoginResponse }, obs, badFetch, null, "unused"),
    (/** @type {Error} */ error) => error.message.includes("/user/email") && error.message.includes("/properties/user/properties/email/type"),
  );
});

test("login happy path through the kernel yields a frozen user with a token", async () => {
  const fakeFetch = async () => ({ user: goodUser });
  const envelope = /** @type {Readonly<import("../web/validators.mjs").LoginEnvelope>} */ (
    await objectKernel({ name: "login", validate: validateLoginResponse }, obs, fakeFetch, null, {
      user: { email: "simbo@example.com", password: "password123" },
    })
  );
  assert.equal(envelope.user.email, "simbo@example.com");
  assert.equal(envelope.user.token, goodUser.token);
  assert.ok(Object.isFrozen(envelope.user));
});
