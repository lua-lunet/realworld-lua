/**
 * Typed API surface: each call runs the object kernel over one HTTP response
 * with the matching envelope validator. Fail-closed end to end.
 */
import { objectKernel } from "../src/kernel.mjs";
import {
  httpDeleteJson,
  httpGetJson,
  httpPostJson,
  httpPutJson,
} from "../src/http.mjs";
import {
  validateArticleListResponse,
  validateArticleResponse,
  validateCommentResponse,
  validateCommentsResponse,
  validateLoginResponse,
  validateProfileResponse,
  validateTagsResponse,
} from "./validators.mjs";

/** @typedef {import("./validators.mjs").ArticleListEnvelope} ArticleListEnvelope */
/** @typedef {import("./validators.mjs").ArticleEnvelope} ArticleEnvelope */
/** @typedef {import("./validators.mjs").CommentsEnvelope} CommentsEnvelope */
/** @typedef {import("./validators.mjs").CommentEnvelope} CommentEnvelope */
/** @typedef {import("./validators.mjs").LoginEnvelope} LoginEnvelope */
/** @typedef {import("./validators.mjs").ProfileEnvelope} ProfileEnvelope */
/** @typedef {import("./validators.mjs").TagsEnvelope} TagsEnvelope */

/** @type {import("../src/kernel.mjs").Observability} */
const obs = {
  info() {},
  warn(message) {
    console.warn(message);
  },
};

/**
 * @param {import("../src/kernel.mjs").KernelCtx | null} ctx
 * @returns {string}
 */
function tokenOf(ctx) {
  const token = ctx?.token;
  return typeof token === "string" ? token : "";
}

/**
 * @param {import("../src/kernel.mjs").KernelCtx | null} ctx
 * @returns {string}
 */
function slugOf(ctx) {
  const slug = ctx?.slug;
  return typeof slug === "string" ? slug : "";
}

/**
 * @typedef {object} ListQuery
 * @property {string} [tag]
 * @property {string} [author]
 * @property {string} [favorited]
 * @property {number} [limit]
 * @property {number} [offset]
 * @property {string} [token]
 */

/**
 * @param {ListQuery} query
 * @returns {string}
 */
function listQuery(query) {
  const params = new URLSearchParams();
  params.set("limit", String(query.limit ?? 10));
  params.set("offset", String(query.offset ?? 0));
  if (query.tag) params.set("tag", query.tag);
  if (query.author) params.set("author", query.author);
  if (query.favorited) params.set("favorited", query.favorited);
  return params.toString();
}

/**
 * @param {ListQuery} [query]
 * @returns {Promise<Readonly<ArticleListEnvelope>>}
 */
export async function fetchArticleList(query = {}) {
  const qs = listQuery(query);
  return /** @type {Readonly<ArticleListEnvelope>} */ (
    await objectKernel({ name: "article-list", validate: validateArticleListResponse }, obs, (config, ctx, url) => httpGetJson(/** @type {string} */ (url), tokenOf(ctx)), { token: query.token ?? "" }, `/api/articles?${qs}`)
  );
}

/**
 * Authenticated feed: articles by followed authors.
 * @param {string} token
 * @param {{limit?: number, offset?: number}} [pages]
 * @returns {Promise<Readonly<ArticleListEnvelope>>}
 */
export async function fetchFeed(token, pages = {}) {
  const qs = `limit=${pages.limit ?? 10}&offset=${pages.offset ?? 0}`;
  return /** @type {Readonly<ArticleListEnvelope>} */ (
    await objectKernel({ name: "feed", validate: validateArticleListResponse }, obs, (config, ctx, url) => httpGetJson(/** @type {string} */ (url), tokenOf(ctx)), { token }, `/api/articles/feed?${qs}`)
  );
}

/**
 * @param {string} slug
 * @param {string} [token]
 * @returns {Promise<Readonly<ArticleEnvelope>>}
 */
export async function fetchArticle(slug, token = "") {
  return /** @type {Readonly<ArticleEnvelope>} */ (
    await objectKernel({ name: "article", validate: validateArticleResponse }, obs, (config, ctx, url) => httpGetJson(/** @type {string} */ (url), tokenOf(ctx)), { token }, `/api/articles/${encodeURIComponent(slug)}`)
  );
}

/**
 * @param {string} slug
 * @param {string} [token]
 * @returns {Promise<Readonly<CommentsEnvelope>>}
 */
export async function fetchComments(slug, token = "") {
  return /** @type {Readonly<CommentsEnvelope>} */ (
    await objectKernel({ name: "comments", validate: validateCommentsResponse }, obs, (config, ctx, url) => httpGetJson(/** @type {string} */ (url), tokenOf(ctx)), { token }, `/api/articles/${encodeURIComponent(slug)}/comments`)
  );
}

/** @returns {Promise<Readonly<TagsEnvelope>>} */
export async function fetchTags() {
  return /** @type {Readonly<TagsEnvelope>} */ (
    await objectKernel({ name: "tags", validate: validateTagsResponse }, obs, (config, ctx, url) => httpGetJson(/** @type {string} */ (url)), null, "/api/tags")
  );
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Readonly<LoginEnvelope>>}
 */
export async function login(email, password) {
  return /** @type {Readonly<LoginEnvelope>} */ (
    await objectKernel({ name: "login", validate: validateLoginResponse }, obs, (config, ctx, input) => httpPostJson("/api/users/login", input), null, {
      user: { email, password },
    })
  );
}

/**
 * @param {string} username
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Readonly<LoginEnvelope>>}
 */
export async function register(username, email, password) {
  return /** @type {Readonly<LoginEnvelope>} */ (
    await objectKernel({ name: "register", validate: validateLoginResponse }, obs, (config, ctx, input) => httpPostJson("/api/users", input), null, {
      user: { username, email, password },
    })
  );
}

/**
 * @param {string} token
 * @returns {Promise<Readonly<LoginEnvelope>>}
 */
export async function fetchCurrentUser(token) {
  return /** @type {Readonly<LoginEnvelope>} */ (
    await objectKernel({ name: "current-user", validate: validateLoginResponse }, obs, (config, ctx, url) => httpGetJson(/** @type {string} */ (url), tokenOf(ctx)), { token }, "/api/user")
  );
}

/**
 * @param {string} token
 * @param {{email?: string, username?: string, bio?: string, password?: string, image?: string}} patch
 * @returns {Promise<Readonly<LoginEnvelope>>}
 */
export async function updateSettings(token, patch) {
  return /** @type {Readonly<LoginEnvelope>} */ (
    await objectKernel({ name: "settings", validate: validateLoginResponse }, obs, (config, ctx, input) => httpPutJson("/api/user", input, tokenOf(ctx)), { token }, { user: patch })
  );
}

/**
 * @param {string} [token]
 * @param {string} username
 * @returns {Promise<Readonly<ProfileEnvelope>>}
 */
export async function fetchProfile(username, token = "") {
  return /** @type {Readonly<ProfileEnvelope>} */ (
    await objectKernel({ name: "profile", validate: validateProfileResponse }, obs, (config, ctx, url) => httpGetJson(/** @type {string} */ (url), tokenOf(ctx)), { token }, `/api/profiles/${encodeURIComponent(username)}`)
  );
}

/**
 * @param {string} token
 * @param {string} username
 * @param {boolean} follow true to follow, false to unfollow
 * @returns {Promise<Readonly<ProfileEnvelope>>}
 */
export async function setFollow(token, username, follow) {
  const url = `/api/profiles/${encodeURIComponent(username)}/follow`;
  return /** @type {Readonly<ProfileEnvelope>} */ (
    await objectKernel(
      { name: "follow", validate: validateProfileResponse },
      obs,
      (config, ctx, target) =>
        follow
          ? httpPostJson(/** @type {string} */ (target), {}, tokenOf(ctx))
          : httpDeleteJson(/** @type {string} */ (target), tokenOf(ctx)),
      { token },
      url,
    )
  );
}

/**
 * @param {string} token
 * @param {string} slug
 * @param {boolean} favorite true to favourite, false to unfavourite
 * @returns {Promise<Readonly<ArticleEnvelope>>}
 */
export async function setFavorite(token, slug, favorite) {
  const url = `/api/articles/${encodeURIComponent(slug)}/favorite`;
  return /** @type {Readonly<ArticleEnvelope>} */ (
    await objectKernel(
      { name: "favorite", validate: validateArticleResponse },
      obs,
      (config, ctx, target) =>
        favorite
          ? httpPostJson(/** @type {string} */ (target), {}, tokenOf(ctx))
          : httpDeleteJson(/** @type {string} */ (target), tokenOf(ctx)),
      { token },
      url,
    )
  );
}

/**
 * @typedef {object} ArticleDraft
 * @property {string} title
 * @property {string} description
 * @property {string} body
 * @property {string[]} [tagList]
 */

/**
 * @param {string} token
 * @param {ArticleDraft} draft
 * @returns {Promise<Readonly<ArticleEnvelope>>}
 */
export async function createArticle(token, draft) {
  return /** @type {Readonly<ArticleEnvelope>} */ (
    await objectKernel({ name: "create-article", validate: validateArticleResponse }, obs, (config, ctx, input) => httpPostJson("/api/articles", input, tokenOf(ctx)), { token }, { article: draft })
  );
}

/**
 * @param {string} token
 * @param {string} slug
 * @param {Partial<ArticleDraft>} patch
 * @returns {Promise<Readonly<ArticleEnvelope>>}
 */
export async function updateArticle(token, slug, patch) {
  return /** @type {Readonly<ArticleEnvelope>} */ (
    await objectKernel({ name: "update-article", validate: validateArticleResponse }, obs, (config, ctx, input) => httpPutJson(`/api/articles/${encodeURIComponent(/** @type {string} */ (slugOf(ctx)))}`, input, tokenOf(ctx)), { token, slug }, { article: patch })
  );
}

/**
 * @param {string} token
 * @param {string} slug
 * @returns {Promise<void>}
 */
export async function deleteArticle(token, slug) {
  await httpDeleteJson(`/api/articles/${encodeURIComponent(slug)}`, token);
}

/**
 * @param {string} token
 * @param {string} slug
 * @param {string} body
 * @returns {Promise<Readonly<CommentEnvelope>>}
 */
export async function addComment(token, slug, body) {
  return /** @type {Readonly<CommentEnvelope>} */ (
    await objectKernel({ name: "add-comment", validate: validateCommentResponse }, obs, (config, ctx, input) => httpPostJson(`/api/articles/${encodeURIComponent(/** @type {string} */ (slugOf(ctx)))}/comments`, input, tokenOf(ctx)), { token, slug }, { comment: { body } })
  );
}

/**
 * @param {string} token
 * @param {string} slug
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteComment(token, slug, id) {
  await httpDeleteJson(`/api/articles/${encodeURIComponent(slug)}/comments/${id}`, token);
}
