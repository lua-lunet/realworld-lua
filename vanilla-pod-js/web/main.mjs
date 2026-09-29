import { ConduitApp } from "./components/conduit-app.mjs";
import {
  ConduitArticleList,
  ConduitArticlePage,
  ConduitEditor,
  ConduitHeader,
  ConduitHome,
  ConduitLogin,
  ConduitPager,
  ConduitProfile,
  ConduitRegister,
  ConduitSettings,
  ConduitTagList,
} from "./components/conduit-elements.mjs";

// Leaf components first, root last: when <conduit-app> upgrades and renders
// its children in connectedCallback, every child element is already defined.
customElements.define("conduit-article-list", ConduitArticleList);
customElements.define("conduit-pager", ConduitPager);
customElements.define("conduit-tag-list", ConduitTagList);
customElements.define("conduit-header", ConduitHeader);
customElements.define("conduit-home", ConduitHome);
customElements.define("conduit-article-page", ConduitArticlePage);
customElements.define("conduit-login", ConduitLogin);
customElements.define("conduit-register", ConduitRegister);
customElements.define("conduit-settings", ConduitSettings);
customElements.define("conduit-editor", ConduitEditor);
customElements.define("conduit-profile", ConduitProfile);
customElements.define("conduit-app", ConduitApp);
