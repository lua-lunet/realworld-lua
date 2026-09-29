/**
 * Light-DOM web components for full Conduit parity: header, home (feed tabs +
 * tag filter + pager), article page (favourite/follow + delete + comments
 * add/delete), register, settings, editor (create/edit), and profile pages.
 * No framework, no shadow DOM; markup uses the shared RealWorld stylesheet
 * classes. Avatars fall back to an inline data-URI, never a remote host.
 */
import { currentUser, onAuthChange, signIn, signOut } from "../auth.mjs";
import {
  addComment,
  createArticle,
  deleteArticle,
  deleteComment,
  fetchArticle,
  fetchArticleList,
  fetchComments,
  fetchFeed,
  fetchProfile,
  fetchTags,
  login,
  register,
  setFavorite,
  setFollow,
  updateArticle,
  updateSettings,
} from "../api.mjs";
import { pageItems, pageOffset, totalPages } from "../pagination.mjs";

/** @param {unknown} value @returns {string} */
function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** @param {string} iso @returns {string} */
function date(iso) {
  return new Date(iso).toDateString();
}

/** Generic inline-SVG fallback avatar; no external image host. */
const AVATAR_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' rx='6' fill='%23888888'/%3E%3Ctext x='24' y='31' font-family='sans-serif' font-size='20' fill='%23ffffff' text-anchor='middle'%3E%3F%3C/text%3E%3C/svg%3E";

/** @param {string | null | undefined} [image] @returns {string} */
function avatar(image) {
  return image && image !== "" ? esc(image) : AVATAR_FALLBACK;
}

/** @param {string} [message] @returns {string} */
function errorList(message) {
  return `<ul class="error-messages"><li>${esc(message ?? "Something went wrong.")}</li></ul>`;
}

/** @param {import("../validators.mjs").ArticleListRow} article
 * @returns {string}
 */
function articlePreview(article) {
  return `
  <div class="article-preview">
    <div class="article-meta">
      <a href="#/profile/${esc(article.author.username)}"><img src="${avatar(article.author.image)}" alt="${esc(article.author.username)}"></a>
      <div class="info">
        <a class="author" href="#/profile/${esc(article.author.username)}">${esc(article.author.username)}</a>
        <span class="date">${esc(date(article.createdAt))}</span>
      </div>
      <div class="pull-xs-right">
        <button class="btn btn-sm btn-outline-primary" type="button" tabindex="-1">
          <i class="ion-heart"></i> ${esc(article.favoritesCount)}
        </button>
      </div>
    </div>
    <a href="#/article/${esc(article.slug)}" class="preview-link">
      <h1>${esc(article.title)}</h1>
      <p>${esc(article.description)}</p>
      <span>Read more...</span>
      <ul class="tag-list">
        ${article.tagList.map((tag) => `<li class="tag-default tag-pill tag-outline">${esc(tag)}</li>`).join("")}
      </ul>
    </a>
  </div>`;
}

/**
 * @param {import("../validators.mjs").CommentRow} comment
 * @param {string | null} viewerName
 * @returns {string}
 */
function commentCard(comment, viewerName) {
  const own = viewerName !== null && comment.author.username === viewerName;
  return `
  <div class="card">
    <div class="card-block">
      <p class="card-text">${esc(comment.body)}</p>
    </div>
    <div class="card-footer">
      <a href="#/profile/${esc(comment.author.username)}" class="comment-author">
        <img src="${avatar(comment.author.image)}" class="comment-author-img" alt="${esc(comment.author.username)}">
      </a>
      &nbsp;
      <a href="#/profile/${esc(comment.author.username)}" class="comment-author">${esc(comment.author.username)}</a>
      <span class="date-posted">${esc(date(comment.createdAt))}</span>
      ${own ? `<span class="mod-icons"><a href="#/article/" data-role="delete-comment" data-id="${esc(comment.id)}"><i class="ion-trash-a"></i></a></span>` : ""}
    </div>
  </div>`;
}

/**
 * @param {number} pages
 * @param {number} current
 * @returns {string}
 */
function pagerMarkup(pages, current) {
  if (pages <= 1) return "";
  return `<ul class="pagination">${pageItems(pages, current)
    .map(
      (n) =>
        `<li class="page-item${n === current ? " active" : ""}"><a class="page-link" href="" data-page="${n}">${n}</a></li>`,
    )
    .join("")}</ul>`;
}

/**
 * Header; subscribes to the auth store so the signed-in state renders.
 */
export class ConduitHeader extends HTMLElement {
  /** @type {(() => void) | undefined} */ unsubscribe;

  connectedCallback() {
    this.render();
    this.unsubscribe = onAuthChange(() => this.render());
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
  }

  render() {
    const user = currentUser();
    const right = user
      ? `
          <li class="nav-item"><a class="nav-link" href="#/editor"><i class="ion-compose"></i>&nbsp;New Post</a></li>
          <li class="nav-item"><a class="nav-link" href="#/settings"><i class="ion-gear-a"></i>&nbsp;Settings</a></li>
          <li class="nav-item"><a class="nav-link" href="#/profile/${esc(user.username)}"><img src="${avatar(user.image)}" class="user-pic" alt="${esc(user.username)}">${esc(user.username)}</a></li>`
      : `
          <li class="nav-item"><a class="nav-link" href="#/login">Sign in</a></li>
          <li class="nav-item"><a class="nav-link" href="#/register">Sign up</a></li>`;
    this.innerHTML = `
    <nav class="navbar navbar-light">
      <div class="container">
        <a class="navbar-brand" href="#/">conduit</a>
        <ul class="nav navbar-nav pull-xs-right">
          <li class="nav-item"><a class="nav-link" href="#/">Home</a></li>
          ${right}
        </ul>
      </div>
    </nav>`;
  }
}

/**
 * Home page: your feed / global feed tabs (feed when signed in), tag filter,
 * popular-tags sidebar, and a 10-per-page pager.
 */
export class ConduitHome extends HTMLElement {
  /** @type {string} */ activeTag = /** @type {string} */ (/** @type {unknown} */ (undefined));
  /** @type {"feed" | "global" | "tag"} */ activeTab = /** @type {"feed" | "global" | "tag"} */ (/** @type {unknown} */ (undefined));
  /** @type {number} */ page = /** @type {number} */ (/** @type {unknown} */ (undefined));
  /** @type {ConduitArticleList} */ list = /** @type {ConduitArticleList} */ (/** @type {unknown} */ (undefined));
  /** @type {ConduitPager} */ pager = /** @type {ConduitPager} */ (/** @type {unknown} */ (undefined));
  /** @type {ConduitTagList} */ tagSidebar = /** @type {ConduitTagList} */ (/** @type {unknown} */ (undefined));

  connectedCallback() {
    const user = currentUser();
    this.activeTab = user ? "feed" : "global";
    this.activeTag = "";
    this.page = 1;
    this.render();
    this.load();
    this.loadTags();
  }

  render() {
    const user = currentUser();
    const feedTab = user
      ? `<li class="nav-item" data-role="feed-tab"><a class="nav-link" href="#/"><span>Your Feed</span></a></li>`
      : "";
    const tagTab =
      this.activeTab === "tag"
        ? `<li class="nav-item"><a class="nav-link active" href="#/"><i class="ion-pound"></i> <span>${esc(this.activeTag)}</span></a></li>`
        : "";
    this.innerHTML = `
    <div class="home-page">
      <div class="banner">
        <div class="container">
          <h1 class="logo-font">conduit</h1>
          <p>A place to share your knowledge.</p>
        </div>
      </div>
      <div class="container page">
        <div class="row">
          <div class="col-md-9">
            <div class="feed-toggle">
              <ul class="nav nav-pills outline-active">
                ${feedTab}
                <li class="nav-item" data-role="global-tab">
                  <a class="nav-link" href="#/">Global Feed</a>
                </li>
                ${tagTab}
              </ul>
            </div>
            <conduit-article-list></conduit-article-list>
            <conduit-pager></conduit-pager>
          </div>
          <div class="col-md-3">
            <div class="sidebar">
              <p>Popular Tags</p>
              <conduit-tag-list></conduit-tag-list>
            </div>
          </div>
        </div>
      </div>
    </div>`;
    this.list = /** @type {ConduitArticleList} */ (this.querySelector("conduit-article-list"));
    this.pager = /** @type {ConduitPager} */ (this.querySelector("conduit-pager"));
    this.tagSidebar = /** @type {ConduitTagList} */ (this.querySelector("conduit-tag-list"));
    const feedTabEl = this.querySelector('[data-role="feed-tab"] a');
    if (feedTabEl) {
      feedTabEl.addEventListener("click", (event) => {
        event.preventDefault();
        this.setTab("feed");
      });
    }
    const globalTab = this.querySelector('[data-role="global-tab"] a');
    if (globalTab) {
      globalTab.addEventListener("click", (event) => {
        event.preventDefault();
        this.setTab("global");
      });
    }
  }

  /** @param {"feed" | "global"} tab */
  setTab(tab) {
    this.activeTab = tab;
    this.activeTag = "";
    this.page = 1;
    this.render();
    this.load();
    this.loadTags();
  }

  /** @param {string} tag */
  setTag(tag) {
    this.activeTab = "tag";
    this.activeTag = tag;
    this.page = 1;
    this.render();
    this.load();
    this.loadTags();
  }

  async load() {
    this.list.showLoading();
    const user = currentUser();
    const limit = 10;
    const offset = pageOffset(this.page, limit);
    try {
      /** @type {Readonly<import("../validators.mjs").ArticleListEnvelope>} */
      let envelope;
      if (this.activeTab === "feed" && user) {
        envelope = await fetchFeed(user.token, { limit, offset });
      } else {
        envelope = await fetchArticleList({
          tag: this.activeTab === "tag" ? this.activeTag : "",
          limit,
          offset,
          token: user?.token ?? "",
        });
      }
      this.list.showArticles(envelope.articles);
      this.pager.showPager(totalPages(envelope.articlesCount, limit), this.page, (n) => {
        this.page = n;
        this.load();
      });
    } catch (error) {
      this.list.showError(/** @type {Error} */ (error).message);
      this.pager.showPager(0, 1, () => {});
    }
  }

  async loadTags() {
    try {
      const envelope = await fetchTags();
      this.tagSidebar.showTags(envelope.tags, (tag) => this.setTag(tag));
    } catch {
      this.tagSidebar.showError();
    }
  }
}

export class ConduitArticleList extends HTMLElement {
  showLoading() {
    this.innerHTML = `<div class="article-preview">Loading...</div>`;
  }

  /** @param {ReadonlyArray<import("../validators.mjs").ArticleListRow>} articles */
  /** @param {ReadonlyArray<import("../validators.mjs").ArticleListRow>} articles */
  showArticles(articles) {
    this.innerHTML =
      articles.length === 0
        ? `<div class="article-preview">No articles are here... yet.</div>`
        : articles.map((article) => articlePreview(article)).join("");
  }

  /** @param {string} message */
  showError(message) {
    this.innerHTML = errorList(message);
  }
}

export class ConduitPager extends HTMLElement {
  /**
   * @param {number} pages
   * @param {number} current
   * @param {(page: number) => void} onPage
   */
  showPager(pages, current, onPage) {
    this.innerHTML = pagerMarkup(pages, current);
    for (const link of this.querySelectorAll("a[data-page]")) {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        onPage(Number(/** @type {HTMLElement} */ (link).dataset.page));
      });
    }
  }
}

export class ConduitTagList extends HTMLElement {
  /** @param {string[]} tags @param {(tag: string) => void} onClickTag */
  showTags(tags, onClickTag) {
    this.innerHTML = tags
      .map(
        (tag) =>
          `<a href="#/" class="tag-default tag-pill" data-tag="${esc(tag)}">${esc(tag)}</a>`,
      )
      .join("");
    for (const element of this.querySelectorAll("a[data-tag]")) {
      element.addEventListener("click", (event) => {
        event.preventDefault();
        onClickTag(/** @type {HTMLElement} */ (element).dataset.tag || "");
      });
    }
  }

  showError() {
    this.innerHTML = "";
  }
}

/**
 * Single article page: banner (favourite + follow + edit/delete for the
 * author), body, and comments (add form + delete own).
 */
export class ConduitArticlePage extends HTMLElement {
  /** @type {string} */ slug = /** @type {string} */ (/** @type {unknown} */ (undefined));

  /** @param {string} slug */
  show(slug) {
    this.slug = slug;
    this.innerHTML = `<div class="article-preview">Loading article...</div>`;
    this.load();
  }

  async load() {
    const user = currentUser();
    /** @type {Readonly<import("../validators.mjs").ArticleEnvelope> | null} */
    let articleEnvelope = null;
    try {
      articleEnvelope = await fetchArticle(this.slug, user?.token ?? "");
    } catch (error) {
      this.innerHTML = `<div class="container page">${errorList(/** @type {Error} */ (error).message)}</div>`;
      return;
    }
    const article = articleEnvelope.article;
    const own = user !== null && article.author.username === user.username;
    const paragraphs = article.body
      .split("\n\n")
      .map((paragraph) => `<p>${esc(paragraph)}</p>`)
      .join("");
    const favoriteButton = user
      ? `<button class="btn btn-sm ${article.favorited ? "btn-primary" : "btn-outline-primary"}" data-role="favorite">
          <i class="ion-heart"></i>&nbsp; ${article.favorited ? "Unfavorite Post" : "Favorite Post"} <span class="counter">(${esc(article.favoritesCount)})</span>
        </button>`
      : "";
    const followButton = user && !own
      ? `<button class="btn btn-sm ${article.author.following ? "btn-secondary" : "btn-outline-secondary"}" data-role="follow">
          <i class="ion-plus-round"></i>&nbsp; ${article.author.following ? "Unfollow" : "Follow"} ${esc(article.author.username)}
        </button>`
      : "";
    const authorButtons = own
      ? `<span>
          <a class="btn btn-outline-secondary btn-sm" href="#/editor/${esc(article.slug)}"><i class="ion-compose"></i> Edit Article</a>
          <button class="btn btn-outline-danger btn-sm" data-role="delete-article"><i class="ion-trash-a"></i> Delete Article</button>
        </span>`
      : "";
    this.innerHTML = `
    <div class="article-page">
      <div class="banner">
        <div class="container">
          <h1>${esc(article.title)}</h1>
          <div class="article-meta">
            <a href="#/profile/${esc(article.author.username)}"><img src="${avatar(article.author.image)}" alt="${esc(article.author.username)}"></a>
            <div class="info">
              <a class="author" href="#/profile/${esc(article.author.username)}">${esc(article.author.username)}</a>
              <span class="date">${esc(date(article.createdAt))}</span>
            </div>
            <span>
              ${followButton}
              ${favoriteButton}
              ${authorButtons}
            </span>
          </div>
        </div>
      </div>
      <div class="container page">
        <div class="row article-content">
          <div class="col-xs-12">
            <div>${paragraphs}</div>
            <ul class="tag-list">
              ${article.tagList.map((tag) => `<li class="tag-default tag-pill tag-outline">${esc(tag)}</li>`).join("")}
            </ul>
          </div>
        </div>
        <hr>
        <div class="article-actions"></div>
        <div class="row">
          <div class="col-xs-12 col-md-8 offset-md-2" data-role="comments">
            <div class="article-preview">Loading comments...</div>
          </div>
        </div>
      </div>
    </div>`;

    const favoriteButtonEl = /** @type {HTMLButtonElement | null} */ (this.querySelector('[data-role="favorite"]'));
    if (favoriteButtonEl && user) {
      favoriteButtonEl.addEventListener("click", () => {
        void this.toggleFavorite(user.token, !article.favorited);
      });
    }
    const followButtonEl = /** @type {HTMLButtonElement | null} */ (this.querySelector('[data-role="follow"]'));
    if (followButtonEl && user) {
      followButtonEl.addEventListener("click", () => {
        void this.toggleFollow(user.token, !article.author.following);
      });
    }
    const deleteButtonEl = /** @type {HTMLButtonElement | null} */ (this.querySelector('[data-role="delete-article"]'));
    if (deleteButtonEl) {
      deleteButtonEl.addEventListener("click", () => {
        if (!confirm("Delete this article? This cannot be undone.")) return;
        void this.removeArticle(user ? user.token : "");
      });
    }
    void this.loadComments();
  }

  /** @param {string} token @param {boolean} favorite */
  async toggleFavorite(token, favorite) {
    try {
      await setFavorite(token, this.slug, favorite);
      this.show(this.slug);
    } catch (error) {
      alert(/** @type {Error} */ (error).message);
    }
  }

  /** @param {string} token @param {boolean} follow */
  async toggleFollow(token, follow) {
    const user = currentUser();
    if (!user) return;
    const envelope = await fetchArticle(this.slug, token);
    try {
      await setFollow(token, envelope.article.author.username, follow);
      this.show(this.slug);
    } catch (error) {
      alert(/** @type {Error} */ (error).message);
    }
  }

  /** @param {string} token */
  async removeArticle(token) {
    try {
      await deleteArticle(token, this.slug);
      location.hash = "#/";
    } catch (error) {
      alert(/** @type {Error} */ (error).message);
    }
  }

  async loadComments() {
    const user = currentUser();
    const target = /** @type {HTMLElement} */ (this.querySelector('[data-role="comments"]'));
    if (!target) return;
    const form = user
      ? `
        <form class="card comment-form" data-role="comment-form">
          <div class="card-block">
            <textarea class="form-control" placeholder="Write a comment..." rows="3" required></textarea>
          </div>
          <div class="card-footer">
            <img src="${avatar(user.image)}" class="comment-author-img" alt="${esc(user.username)}">
            <button class="btn btn-sm btn-primary" type="submit">Post Comment</button>
          </div>
        </form>`
      : "";
    try {
      const envelope = await fetchComments(this.slug, user?.token ?? "");
      const viewerName = user ? user.username : null;
      target.innerHTML = `
        ${form}
        ${envelope.comments.length === 0 ? `<p>No comments yet.</p>` : envelope.comments.map((comment) => commentCard(comment, viewerName)).join("")}`;
      const formEl = /** @type {HTMLFormElement | null} */ (target.querySelector('[data-role="comment-form"]'));
      if (formEl && user) {
        formEl.addEventListener("submit", (event) => {
          event.preventDefault();
          const textarea = /** @type {HTMLTextAreaElement} */ (formEl.querySelector("textarea"));
          void this.postComment(user.token, textarea.value);
        });
      }
      for (const link of target.querySelectorAll('[data-role="delete-comment"]')) {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          if (!user) return;
          void this.removeComment(user.token, Number(/** @type {HTMLElement} */ (link).dataset.id));
        });
      }
    } catch (error) {
      target.innerHTML = errorList(/** @type {Error} */ (error).message);
    }
  }

  /** @param {string} token @param {string} body */
  async postComment(token, body) {
    try {
      await addComment(token, this.slug, body);
      await this.loadComments();
    } catch (error) {
      alert(/** @type {Error} */ (error).message);
    }
  }

  /** @param {string} token @param {number} id */
  async removeComment(token, id) {
    try {
      await deleteComment(token, this.slug, id);
      await this.loadComments();
    } catch (error) {
      alert(/** @type {Error} */ (error).message);
    }
  }
}

/**
 * Shared auth-form scaffold for Sign in / Sign up.
 * @param {string} heading
 * @param {boolean} showNameField
 * @param {string} linkHref
 * @param {string} linkText
 * @returns {string}
 */
function authFormMarkup(heading, showNameField, linkHref, linkText) {
  return `
    <div class="auth-page">
      <div class="container page">
        <div class="row">
          <div class="col-md-6 offset-md-3 col-xs-12">
            <h1 class="text-xs-center">${esc(heading)}</h1>
            <p class="text-xs-center"><a href="${esc(linkHref)}">${esc(linkText)}</a></p>
            <ul class="error-messages" data-role="errors" hidden></ul>
            <form data-role="form">
              <fieldset>
                ${showNameField ? `<fieldset class="form-group"><input class="form-control form-control-lg" type="text" placeholder="Username" autocomplete="username" required></fieldset>` : ""}
                <fieldset class="form-group">
                  <input class="form-control form-control-lg" type="email" placeholder="Email" autocomplete="email" required>
                </fieldset>
                <fieldset class="form-group">
                  <input class="form-control form-control-lg" type="password" placeholder="Password" autocomplete="${showNameField ? "new-password" : "current-password"}" required>
                </fieldset>
                <button class="btn btn-lg btn-primary pull-xs-right" type="submit">${esc(heading)}</button>
              </fieldset>
            </form>
          </div>
        </div>
      </div>
    </div>`;
}

/**
 * Sign-in form: email + password, posts through the kernel, stores the
 * returned user (with token) in the in-memory auth store.
 */
export class ConduitLogin extends HTMLElement {
  connectedCallback() {
    this.innerHTML = authFormMarkup("Sign In", false, "#/register", "Need an account?");
    const form = /** @type {HTMLFormElement} */ (this.querySelector('[data-role="form"]'));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = /** @type {HTMLInputElement} */ (form.querySelector('input[type="email"]')).value;
      const password = /** @type {HTMLInputElement} */ (form.querySelector('input[type="password"]')).value;
      void this.submit(email, password);
    });
  }

  /** @param {string} email @param {string} password */
  async submit(email, password) {
    const errors = /** @type {HTMLElement} */ (this.querySelector('[data-role="errors"]'));
    errors.hidden = true;
    try {
      const envelope = await login(email, password);
      signIn(envelope.user);
      location.hash = "#/";
    } catch (error) {
      errors.innerHTML = `<li>${esc(/** @type {Error} */ (error).message)}</li>`;
      errors.hidden = false;
    }
  }
}

/**
 * Sign-up form: username + email + password → POST /api/users → auto login.
 */
export class ConduitRegister extends HTMLElement {
  connectedCallback() {
    this.innerHTML = authFormMarkup("Sign Up", true, "#/login", "Have an account?");
    const form = /** @type {HTMLFormElement} */ (this.querySelector('[data-role="form"]'));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const username = /** @type {HTMLInputElement} */ (form.querySelector('input[type="text"]')).value;
      const email = /** @type {HTMLInputElement} */ (form.querySelector('input[type="email"]')).value;
      const password = /** @type {HTMLInputElement} */ (form.querySelector('input[type="password"]')).value;
      void this.submit(username, email, password);
    });
  }

  /** @param {string} username @param {string} email @param {string} password */
  async submit(username, email, password) {
    const errors = /** @type {HTMLElement} */ (this.querySelector('[data-role="errors"]'));
    errors.hidden = true;
    try {
      const envelope = await register(username, email, password);
      signIn(envelope.user);
      location.hash = "#/";
    } catch (error) {
      errors.innerHTML = `<li>${esc(/** @type {Error} */ (error).message)}</li>`;
      errors.hidden = false;
    }
  }
}

/**
 * Settings page: edit user (image, username, bio, email, password) via
 * PUT /api/user, plus sign out.
 */
export class ConduitSettings extends HTMLElement {
  connectedCallback() {
    const user = currentUser();
    if (!user) {
      location.hash = "#/login";
      return;
    }
    this.innerHTML = `
    <div class="settings-page">
      <div class="container page">
        <div class="row">
          <div class="col-md-6 offset-md-3 col-xs-12">
            <h1 class="text-xs-center">Your Settings</h1>
            <ul class="error-messages" data-role="errors" hidden></ul>
            <form data-role="form">
              <fieldset>
                <fieldset class="form-group">
                  <input class="form-control" type="url" data-role="image" placeholder="URL of profile picture" value="${esc(user.image ?? "")}" autocomplete="url">
                </fieldset>
                <fieldset class="form-group">
                  <input class="form-control form-control-lg" type="text" data-role="username" placeholder="Username" value="${esc(user.username)}" autocomplete="username" required>
                </fieldset>
                <fieldset class="form-group">
                  <textarea class="form-control form-control-lg" rows="8" data-role="bio" placeholder="Short bio about you">${esc(user.bio ?? "")}</textarea>
                </fieldset>
                <fieldset class="form-group">
                  <input class="form-control form-control-lg" type="email" data-role="email" placeholder="Email" value="${esc(user.email)}" autocomplete="email" required>
                </fieldset>
                <fieldset class="form-group">
                  <input class="form-control form-control-lg" type="password" data-role="password" placeholder="New Password" autocomplete="new-password">
                </fieldset>
                <button class="btn btn-lg btn-primary pull-xs-right" type="submit">Update Settings</button>
              </fieldset>
            </form>
            <hr>
            <button class="btn btn-outline-danger" data-role="logout">Or click here to logout.</button>
          </div>
        </div>
      </div>
    </div>`;
    const form = /** @type {HTMLFormElement} */ (this.querySelector('[data-role="form"]'));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.submit();
    });
    const logout = /** @type {HTMLButtonElement} */ (this.querySelector('[data-role="logout"]'));
    logout.addEventListener("click", () => {
      signOut();
      location.hash = "#/";
    });
  }

  async submit() {
    const errors = /** @type {HTMLElement} */ (this.querySelector('[data-role="errors"]'));
    const user = currentUser();
    if (!user) return;
    /** @type {HTMLInputElement | null} */
    const image = this.querySelector('[data-role="image"]');
    /** @type {HTMLInputElement | null} */
    const username = this.querySelector('[data-role="username"]');
    /** @type {HTMLTextAreaElement | null} */
    const bio = this.querySelector('[data-role="bio"]');
    /** @type {HTMLInputElement | null} */
    const email = this.querySelector('[data-role="email"]');
    /** @type {HTMLInputElement | null} */
    const password = this.querySelector('[data-role="password"]');
    errors.hidden = true;
    try {
      const envelope = await updateSettings(user.token, {
        image: image?.value ?? "",
        username: username?.value ?? "",
        bio: bio?.value ?? "",
        email: email?.value ?? "",
        ...(password?.value !== undefined && password.value !== "" ? { password: password.value } : {}),
      });
      signIn(envelope.user);
      location.hash = "#/";
    } catch (error) {
      errors.innerHTML = `<li>${esc(/** @type {Error} */ (error).message)}</li>`;
      errors.hidden = false;
    }
  }
}

/**
 * Editor page: create (#/editor) or edit (#/editor/:slug) an article.
 */
export class ConduitEditor extends HTMLElement {
  /** @type {string} */ slug = /** @type {string} */ (/** @type {unknown} */ (undefined));
  /** @type {string[]} */ tagList = /** @type {string[]} */ (/** @type {unknown} */ (undefined));

  /** @param {string} [slug] */
  show(slug) {
    this.slug = slug ?? "";
    this.tagList = [];
    this.render();
    if (this.slug !== "") void this.load();
  }

  render() {
    this.innerHTML = `
    <div class="editor-page">
      <div class="container page">
        <div class="row">
          <div class="col-md-10 offset-md-1 col-xs-12">
            <ul class="error-messages" data-role="errors" hidden></ul>
            <form data-role="form">
              <fieldset>
                <fieldset class="form-group">
                  <input class="form-control form-control-lg" type="text" data-role="title" placeholder="Article Title" required>
                </fieldset>
                <fieldset class="form-group">
                  <input class="form-control form-control-lg" type="text" data-role="description" placeholder="What's this article about?" required>
                </fieldset>
                <fieldset class="form-group">
                  <textarea class="form-control form-control-lg" rows="8" data-role="body" placeholder="Write your article (in markdown)" required></textarea>
                </fieldset>
                <fieldset class="form-group">
                  <input class="form-control form-control-lg" type="text" data-role="tag-input" placeholder="Enter tags (press Enter)">
                  <div class="tag-list" data-role="tag-pills"></div>
                </fieldset>
                <button class="btn btn-lg btn-primary pull-xs-right" type="submit">${this.slug === "" ? "Publish Article" : "Update Article"}</button>
              </fieldset>
            </form>
          </div>
        </div>
      </div>
    </div>`;
    const form = /** @type {HTMLFormElement} */ (this.querySelector('[data-role="form"]'));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.submit();
    });
    const tagInput = /** @type {HTMLInputElement} */ (this.querySelector('[data-role="tag-input"]'));
    tagInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const tag = tagInput.value.trim();
        if (tag !== "" && !this.tagList.includes(tag)) {
          this.tagList = [...this.tagList, tag];
        }
        tagInput.value = "";
        this.renderTagPills();
      }
    });
    this.renderTagPills();
  }

  renderTagPills() {
    const pills = /** @type {HTMLElement | null} */ (this.querySelector('[data-role="tag-pills"]'));
    if (!pills) return;
    pills.innerHTML = this.tagList
      .map(
        (tag) =>
          `<span class="tag-default tag-pill"><i class="ion-close-round" data-role="remove-tag" data-tag="${esc(tag)}"></i> ${esc(tag)}</span>`,
      )
      .join("");
    for (const icon of pills.querySelectorAll('[data-role="remove-tag"]')) {
      icon.addEventListener("click", () => {
        const tag = /** @type {HTMLElement} */ (icon).dataset.tag || "";
        this.tagList = this.tagList.filter((t) => t !== tag);
        this.renderTagPills();
      });
    }
  }

  async load() {
    const user = currentUser();
    if (!user) {
      location.hash = "#/login";
      return;
    }
    try {
      const envelope = await fetchArticle(this.slug, user.token);
      const article = envelope.article;
      if (article.author.username !== user.username) {
        this.renderError("You can only edit your own articles.");
        return;
      }
      const title = /** @type {HTMLInputElement} */ (this.querySelector('[data-role="title"]'));
      const description = /** @type {HTMLInputElement} */ (this.querySelector('[data-role="description"]'));
      const body = /** @type {HTMLTextAreaElement} */ (this.querySelector('[data-role="body"]'));
      title.value = article.title;
      description.value = article.description;
      body.value = article.body;
      this.tagList = [...article.tagList];
      this.renderTagPills();
    } catch (error) {
      this.renderError(/** @type {Error} */ (error).message);
    }
  }

  /** @param {string} message */
  renderError(message) {
    const errors = /** @type {HTMLElement} */ (this.querySelector('[data-role="errors"]'));
    errors.innerHTML = `<li>${esc(message)}</li>`;
    errors.hidden = false;
  }

  async submit() {
    const user = currentUser();
    if (!user) {
      location.hash = "#/login";
      return;
    }
    const title = /** @type {HTMLInputElement} */ (this.querySelector('[data-role="title"]')).value;
    const description = /** @type {HTMLInputElement} */ (this.querySelector('[data-role="description"]')).value;
    const body = /** @type {HTMLTextAreaElement} */ (this.querySelector('[data-role="body"]')).value;
    try {
      const envelope =
        this.slug === ""
          ? await createArticle(user.token, { title, description, body, tagList: this.tagList })
          : await updateArticle(user.token, this.slug, { title, description, body, tagList: this.tagList });
      location.hash = `#/article/${encodeURIComponent(envelope.article.slug)}`;
    } catch (error) {
      this.renderError(/** @type {Error} */ (error).message);
    }
  }
}

/**
 * Profile page: bio header (follow / edit settings), tabs for authored and
 * favourited articles, both paged.
 */
export class ConduitProfile extends HTMLElement {
  /** @type {string} */ username = /** @type {string} */ (/** @type {unknown} */ (undefined));
  /** @type {"articles" | "favorites"} */ tab = /** @type {"articles" | "favorites"} */ (/** @type {unknown} */ (undefined));
  /** @type {number} */ page = /** @type {number} */ (/** @type {unknown} */ (undefined));

  /**
   * @param {string} username
   * @param {"articles" | "favorites"} [tab]
   */
  show(username, tab = "articles") {
    this.username = username;
    this.tab = tab;
    this.page = 1;
    this.render();
    void this.loadProfile();
    void this.load();
  }

  render() {
    const isFavorites = this.tab === "favorites";
    this.innerHTML = `
    <div class="profile-page">
      <div class="user-info">
        <div class="container">
          <div class="row">
            <div class="col-xs-12 col-md-10 offset-md-1" data-role="info">
              <div class="article-preview">Loading profile...</div>
            </div>
          </div>
        </div>
      </div>
      <div class="container">
        <div class="row">
          <div class="col-xs-12 col-md-10 offset-md-1">
            <div class="articles-toggle">
              <ul class="nav nav-pills outline-active">
                <li class="nav-item"><a class="nav-link${isFavorites ? "" : " active"}" href="#/profile/${esc(this.username)}">My Articles</a></li>
                <li class="nav-item"><a class="nav-link${isFavorites ? " active" : ""}" href="#/profile/${esc(this.username)}/favorites">Favorited Articles</a></li>
              </ul>
            </div>
            <conduit-article-list></conduit-article-list>
            <conduit-pager></conduit-pager>
          </div>
        </div>
      </div>
    </div>`;
  }

  async loadProfile() {
    const user = currentUser();
    const info = /** @type {HTMLElement} */ (this.querySelector('[data-role="info"]'));
    try {
      const envelope = await fetchProfile(this.username, user?.token ?? "");
      const profile = envelope.profile;
      const self = user !== null && profile.username === user.username;
      info.innerHTML = `
        <img src="${avatar(profile.image)}" class="user-img" alt="${esc(profile.username)}">
        <h4>${esc(profile.username)}</h4>
        <p>${esc(profile.bio ?? "")}</p>
        ${self
          ? `<a class="btn btn-sm btn-outline-secondary action-btn" href="#/settings"><i class="ion-gear-a"></i>&nbsp;Edit Profile Settings</a>`
          : user
            ? `<button class="btn btn-sm action-btn ${profile.following ? "btn-secondary" : "btn-outline-secondary"}" data-role="follow">
                <i class="ion-plus-round"></i>&nbsp;${profile.following ? "Unfollow" : "Follow"} ${esc(profile.username)}
              </button>`
            : ""}`;
      const followButton = /** @type {HTMLButtonElement | null} */ (info.querySelector('[data-role="follow"]'));
      if (followButton && user) {
        followButton.addEventListener("click", () => {
          void (async () => {
            try {
              await setFollow(user.token, profile.username, !profile.following);
              await this.loadProfile();
            } catch (error) {
              alert(/** @type {Error} */ (error).message);
            }
          })();
        });
      }
    } catch (error) {
      info.innerHTML = errorList(/** @type {Error} */ (error).message);
    }
  }

  async load() {
    const user = currentUser();
    const list = /** @type {ConduitArticleList} */ (this.querySelector("conduit-article-list"));
    const pager = /** @type {ConduitPager} */ (this.querySelector("conduit-pager"));
    list.showLoading();
    const limit = 10;
    const offset = pageOffset(this.page, limit);
    try {
      const envelope = await fetchArticleList(
        this.tab === "favorites"
          ? { favorited: this.username, limit, offset, token: user?.token ?? "" }
          : { author: this.username, limit, offset, token: user?.token ?? "" },
      );
      list.showArticles(envelope.articles);
      pager.showPager(totalPages(envelope.articlesCount, limit), this.page, (n) => {
        this.page = n;
        void this.load();
      });
    } catch (error) {
      list.showError(/** @type {Error} */ (error).message);
      pager.showPager(0, 1, () => {});
    }
  }
}
