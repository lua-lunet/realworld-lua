/**
 * Barrel for generated validators plus hand-written envelope validators for
 * the RealWorld response wrappers. The envelope validators compose the
 * generated row validators and report errors with real JSON Pointers into
 * the envelope (instancePath prefixed, schemaPath anchored at the
 * corresponding /properties branch of the envelope).
 */
import { validate as validateArticle } from "../generated/article.mjs";
import { validate as validateArticleListRow } from "../generated/article-list-row.mjs";
import { validate as validateComment } from "../generated/comment.mjs";
import { validate as validateUser } from "../generated/user.mjs";

export { validateArticle, validateArticleListRow, validateComment, validateUser };

/** @typedef {{instancePath: string, schemaPath: string}} ValidationError */
/**
 * @typedef {object} ArticleRow
 * @property {string} slug
 * @property {string} title
 * @property {string} description
 * @property {string} body
 * @property {string[]} tagList
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {boolean} favorited
 * @property {number} favoritesCount
 * @property {AuthorRow} author
 * @typedef {object} ArticleListRow
 * @property {string} slug
 * @property {string} title
 * @property {string} description
 * @property {string[]} tagList
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {boolean} favorited
 * @property {number} favoritesCount
 * @property {AuthorRow} author
 * @typedef {object} AuthorRow
 * @property {string} username
 * @property {boolean} following
 * @property {string | null} [bio]
 * @property {string | null} [image]
 */
/**
 * @typedef {object} CommentRow
 * @property {number} id
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} body
 * @property {AuthorRow} author
 */
/**
 * @typedef {object} UserRow
 * @property {string} email
 * @property {string} token
 * @property {string} username
 * @property {string | null} [bio]
 * @property {string | null} [image]
 */
/**
 * @typedef {object} ArticleListEnvelope
 * @property {ArticleListRow[]} articles
 * @property {number} articlesCount
 * @typedef {object} ArticleEnvelope
 * @property {ArticleRow} article
 * @typedef {object} CommentsEnvelope
 * @property {CommentRow[]} comments
 * @typedef {object} CommentEnvelope
 * @property {CommentRow} comment
 * @typedef {object} LoginEnvelope
 * @property {UserRow} user
 * @typedef {object} ProfileEnvelope
 * @property {AuthorRow} profile
 * @typedef {object} TagsEnvelope
 * @property {string[]} tags
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} instance
 * @returns {ValidationError[]}
 */
export function validateTagsResponse(instance) {
  if (!isObject(instance)) return [{ instancePath: "", schemaPath: "/properties" }];
  const errors = [];
  if (!("tags" in instance) || !Array.isArray(instance.tags)) {
    errors.push({ instancePath: "/tags", schemaPath: "/properties/tags" });
  } else {
    for (let i = 0; i < instance.tags.length; i++) {
      if (typeof instance.tags[i] !== "string") {
        errors.push({ instancePath: `/tags/${i}`, schemaPath: "/properties/tags/elements/type" });
      }
    }
  }
  return errors;
}

/**
 * @param {unknown} instance
 * @returns {ValidationError[]}
 */
export function validateArticleListResponse(instance) {
  if (!isObject(instance)) return [{ instancePath: "", schemaPath: "/properties" }];
  const errors = [];
  if (!("articles" in instance) || !Array.isArray(instance.articles)) {
    errors.push({ instancePath: "/articles", schemaPath: "/properties/articles" });
  } else {
    for (let i = 0; i < instance.articles.length; i++) {
      for (const e of /** @type {ValidationError[]} */ (validateArticleListRow(instance.articles[i]))) {
        errors.push({
          instancePath: `/articles/${i}${e.instancePath}`,
          schemaPath: `/properties/articles/elements${e.schemaPath}`,
        });
      }
    }
  }
  const count = isObject(instance) ? instance["articlesCount"] : undefined;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
    errors.push({ instancePath: "/articlesCount", schemaPath: "/properties/articlesCount/type" });
  }
  return errors;
}

/**
 * @param {unknown} instance
 * @returns {ValidationError[]}
 */
export function validateArticleResponse(instance) {
  if (!isObject(instance)) return [{ instancePath: "", schemaPath: "/properties" }];
  if (!("article" in instance)) {
    return [{ instancePath: "/article", schemaPath: "/properties/article" }];
  }
  return /** @type {ValidationError[]} */ (validateArticle(instance.article)).map((e) => ({
    instancePath: `/article${e.instancePath}`,
    schemaPath: `/properties/article${e.schemaPath}`,
  }));
}

/**
 * @param {unknown} instance
 * @returns {ValidationError[]}
 */
export function validateCommentsResponse(instance) {
  if (!isObject(instance)) return [{ instancePath: "", schemaPath: "/properties" }];
  if (!("comments" in instance) || !Array.isArray(instance.comments)) {
    return [{ instancePath: "/comments", schemaPath: "/properties/comments" }];
  }
  const errors = [];
    for (let i = 0; i < instance.comments.length; i++) {
      for (const e of /** @type {ValidationError[]} */ (validateComment(instance.comments[i]))) {
      errors.push({
        instancePath: `/comments/${i}${e.instancePath}`,
        schemaPath: `/properties/comments/elements${e.schemaPath}`,
      });
    }
  }
  return errors;
}

/**
 * @param {unknown} instance
 * @returns {ValidationError[]}
 */
export function validateLoginResponse(instance) {
  if (!isObject(instance)) return [{ instancePath: "", schemaPath: "/properties" }];
  if (!("user" in instance)) {
    return [{ instancePath: "/user", schemaPath: "/properties/user" }];
  }
  return /** @type {ValidationError[]} */ (validateUser(instance.user)).map((e) => ({
    instancePath: `/user${e.instancePath}`,
    schemaPath: `/properties/user${e.schemaPath}`,
  }));
}

/**
 * @param {unknown} instance
 * @returns {ValidationError[]}
 */
export function validateProfileResponse(instance) {
  if (!isObject(instance)) return [{ instancePath: "", schemaPath: "/properties" }];
  const profile = instance.profile;
  if (!isObject(profile)) {
    return [{ instancePath: "/profile", schemaPath: "/properties/profile" }];
  }
  const errors = [];
  if (typeof profile.username !== "string") {
    errors.push({ instancePath: "/profile/username", schemaPath: "/properties/profile/properties/username/type" });
  }
  if (typeof profile.following !== "boolean") {
    errors.push({ instancePath: "/profile/following", schemaPath: "/properties/profile/properties/following/type" });
  }
  if ("bio" in profile && profile.bio !== undefined && profile.bio !== null && typeof profile.bio !== "string") {
    errors.push({ instancePath: "/profile/bio", schemaPath: "/properties/profile/optionalProperties/bio/type" });
  }
  if ("image" in profile && profile.image !== undefined && profile.image !== null && typeof profile.image !== "string") {
    errors.push({ instancePath: "/profile/image", schemaPath: "/properties/profile/optionalProperties/image/type" });
  }
  for (const key of Object.keys(profile)) {
    if (key !== "username" && key !== "following" && key !== "bio" && key !== "image") {
      errors.push({ instancePath: `/profile/${key}`, schemaPath: "/properties/profile" });
    }
  }
  return errors;
}

/**
 * @param {unknown} instance
 * @returns {ValidationError[]}
 */
export function validateCommentResponse(instance) {
  if (!isObject(instance)) return [{ instancePath: "", schemaPath: "/properties" }];
  if (!("comment" in instance)) {
    return [{ instancePath: "/comment", schemaPath: "/properties/comment" }];
  }
  return /** @type {ValidationError[]} */ (validateComment(instance.comment)).map((e) => ({
    instancePath: `/comment${e.instancePath}`,
    schemaPath: `/properties/comment${e.schemaPath}`,
  }));
}
