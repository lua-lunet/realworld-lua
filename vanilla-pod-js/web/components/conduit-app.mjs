/**
 * Root component + hash router: #/ (home), #/login, #/register, #/settings,
 * #/editor, #/editor/:slug, #/article/:slug, #/profile/:username,
 * #/profile/:username/favorites.
 * Light DOM only; children are plain custom elements upgraded in place.
 */
import { ConduitArticlePage, ConduitHeader } from "./conduit-elements.mjs";

/**
 * @typedef {object} Route
 * @property {"home" | "login" | "register" | "settings" | "editor" | "article" | "profile"} page
 * @property {string} [slug]
 * @property {"articles" | "favorites"} [tab]
 */

/** @returns {Route} */
function parseHash() {
  const hash = location.hash.replace(/^#/, "");
  if (hash === "/login") return { page: "login" };
  if (hash === "/register") return { page: "register" };
  if (hash === "/settings") return { page: "settings" };
  if (hash === "/editor") return { page: "editor" };
  const editor = /^\/editor\/(.+)$/.exec(hash);
  if (editor) return { page: "editor", slug: editor[1] };
  const article = /^\/article\/(.+)$/.exec(hash);
  if (article) return { page: "article", slug: article[1] };
  const profileFavorites = /^\/profile\/([^/]+)\/favorites$/.exec(hash);
  if (profileFavorites) return { page: "profile", slug: profileFavorites[1], tab: "favorites" };
  const profile = /^\/profile\/([^/]+)$/.exec(hash);
  if (profile) return { page: "profile", slug: profile[1], tab: "articles" };
  return { page: "home" };
}

export class ConduitApp extends HTMLElement {
  /** @type {HTMLElement} */
  main = /** @type {HTMLElement} */ (/** @type {unknown} */ (undefined));

  connectedCallback() {
    window.addEventListener("hashchange", () => this.route());
    this.innerHTML = `
    <a href="#/" class="skip-link">Skip to content</a>
    <conduit-header></conduit-header>
    <main data-role="main"></main>`;
    this.main = /** @type {HTMLElement} */ (this.querySelector('[data-role="main"]'));
    this.route();
  }

  route() {
    const route = parseHash();
    if (route.page === "article") {
      this.main.innerHTML = `<conduit-article-page></conduit-article-page>`;
      /** @type {ConduitArticlePage} */ (this.main.querySelector("conduit-article-page")).show(/** @type {string} */ (route.slug));
      return;
    }
    if (route.page === "editor") {
      this.main.innerHTML = `<conduit-editor></conduit-editor>`;
      /** @type {import("./conduit-elements.mjs").ConduitEditor} */ (this.main.querySelector("conduit-editor")).show(route.slug);
      return;
    }
    if (route.page === "profile") {
      this.main.innerHTML = `<conduit-profile></conduit-profile>`;
      /** @type {import("./conduit-elements.mjs").ConduitProfile} */ (this.main.querySelector("conduit-profile")).show(/** @type {string} */ (route.slug), route.tab);
      return;
    }
    this.main.innerHTML =
      route.page === "login"
        ? `<conduit-login></conduit-login>`
        : route.page === "register"
          ? `<conduit-register></conduit-register>`
          : route.page === "settings"
            ? `<conduit-settings></conduit-settings>`
            : `<conduit-home></conduit-home>`;
  }
}
