const Router = (() => {
  const routes = {
    "/login": { view: "login", bind: () => Auth.bindLogin() },
    "/register": { view: "register", bind: () => Auth.bindRegister() },
    "/feed": { custom: () => Feed.render() },
    "/create-post": { view: "create-post", auth: true, bind: () => Posts.bindCreatePost() },
    "/casino": { view: "casino", auth: true, bind: () => Casino.bind() },
    "/ruleta-bogotana": { view: "ruleta-bogotana", auth: true, bind: () => RuletaBogotana.init() },
    "/dados-calle": { view: "dados-calle", auth: true, bind: () => CasinoDuelos.init("dados-calle") },
    "/cartas-distrito": { view: "cartas-distrito", auth: true, bind: () => CasinoDuelos.init("cartas-distrito") },
    "/profile": { custom: () => renderProfile(), auth: true },
    "/chat": { custom: () => Chat.renderGlobal(), auth: true },
    "/mapa": { custom: () => MapaReportes.render(), auth: true },
    "/rules": { view: "rules" },
    "/admin": { view: "admin", auth: true, moderation: true, bind: () => Admin.initAdminPanel() }
  };

  function currentPath() {
    const hash = location.hash || APP_CONFIG.defaultRoute;
    return hash.replace(/^#/, "").split("?")[0];
  }

  async function render() {
    if (!AgeGate.isConfirmed()) {
      AgeGate.render();
      return;
    }

    UI.syncTopbar();
    const path = currentPath();
    if (path.startsWith("/post/")) return renderPostDetail(decodeURIComponent(path.replace("/post/", "")));
    if (path.startsWith("/profile/")) return renderProfile(decodeURIComponent(path.replace("/profile/", "")));
    if (path.startsWith("/chat/")) return Chat.renderPrivate(decodeURIComponent(path.replace("/chat/", "")));

    const route = routes[path] || routes["/feed"];
    if (route.auth && !UI.requireSession()) return;
    if (route.moderation && !Auth.isAdminOrModerator()) {
      UI.renderApp(UI.emptyState("No tienes permisos para acceder a esta seccion.", "Esta vista esta reservada para administradores y moderadores.", `<a class="warning-btn inline-btn" href="#/feed">Volver al feed</a>`));
      return;
    }

    if (route.custom) return route.custom();

    const html = await UI.loadView(route.view);
    UI.renderApp(html);
    route.bind?.();
  }

  async function renderPostDetail(postId) {
    UI.renderApp(`
      <div class="feed-layout detail-layout">
        ${Feed.sidebar("Inicio")}
        <section class="feed-column">
          ${UI.skeletonPosts(1)}
        </section>
        <aside class="right-sidebar"><section class="trend-card"><h3>Detalle</h3><p class="muted">Cargando publicacion...</p></section></aside>
      </div>
    `);
    try {
      const data = await Api.apiGetPost(postId);
      const post = Posts.sanitizePostData(data.post);
      document.querySelector(".feed-column").innerHTML = `
        <section class="post-detail-panel">
          <div class="detail-toolbar">
            <a href="#/feed" class="back-link">Volver al feed</a>
            <a href="#/feed" class="detail-close" aria-label="Cerrar">X</a>
          </div>
          ${Posts.card(post)}
          <section class="comments-section">
            <div class="comments-title-row">
              <h2>Comentarios</h2>
              <span id="commentCounter">${Number(post.commentCount || 0)} comentarios</span>
            </div>
            <div id="commentsList">${Comments.renderList(data.comments)}</div>
            ${Comments.renderForm(post.postId)}
          </section>
        </section>
      `;
      Reactions.bind(document);
      Posts.bindReportButtons(document);
      Posts.bindShareButtons(document);
      Posts.bindAdminInline(document);
      Comments.bindForm({
        onCreated: () => {
          const counter = document.getElementById("commentCounter");
          if (counter) {
            const current = Number((counter.textContent || "0").match(/\d+/)?.[0] || 0) + 1;
            counter.textContent = `${current} comentarios`;
          }
        }
      });
      Comments.bindModerationButtons(document);
    } catch (error) {
      document.querySelector(".feed-column").innerHTML = UI.emptyState("Publicacion no encontrada", error.message, `<a class="warning-btn inline-btn" href="#/feed">Volver al feed</a>`);
    }
  }

  async function renderProfile(userIdOrUsername = "") {
    if (!UI.requireSession()) return;
    const self = Auth.user();
    const requested = String(userIdOrUsername || self?.userId || "");
    const html = await UI.loadView("profile");
    UI.renderApp(html);
    const box = document.getElementById("profileBox");
    if (!box || !self) return;
    box.innerHTML = UI.skeletonPosts(1);

    const isViewingSelf = !requested || requested === self.userId || requested === self.username;
    let profileUser = isViewingSelf
      ? self
      : { userId: requested, username: requested, role: "user", status: "active" };
    let posts = [];
    let profileError = "";
    try {
      const known = typeof Chat !== "undefined"
        ? Chat.collectKnownUsers().find(user => user.userId === requested || user.username === requested)
        : null;
      if (known) profileUser = { ...profileUser, ...known, role: profileUser.role || "user", status: profileUser.status || "active" };
      if (!isViewingSelf && Api.apiGetUserProfile && Api.hasConfiguredApiUrl()) {
        const result = await Api.apiGetUserProfile(Auth.token(), requested);
        profileUser = result.user || profileUser;
        posts = result.posts || [];
      } else {
        const result = await Api.apiListPosts();
        posts = (result.posts || []).filter(post => String(post.userId) === String(profileUser.userId) || post.username === profileUser.username);
      }
      if (!posts.length && !isViewingSelf && (!Api.apiGetUserProfile || !Api.hasConfiguredApiUrl())) {
        const result = await Api.apiListPosts();
        posts = (result.posts || []).filter(post => String(post.userId) === String(profileUser.userId) || post.username === profileUser.username);
      }
    } catch (error) {
      profileError = String(error.message || "");
      posts = [];
    }

    const isSelf = String(profileUser.userId) === String(self.userId) || String(profileUser.username) === String(self.username);
    const chatButton = !isSelf
      ? `<a class="warning-btn inline-btn" href="#/chat/${encodeURIComponent(profileUser.userId || profileUser.username)}">Chatear</a>`
      : "";
    box.innerHTML = `
      <div class="profile-card expanded-profile">
        <div class="avatar">${UI.escapeHTML(profileUser.username?.slice(0, 2).toUpperCase() || "BA")}</div>
        <div class="profile-main">
          <h2>@${UI.escapeHTML(profileUser.username)}</h2>
          <p>Rol: <strong>${UI.escapeHTML(profileUser.role || "user")}</strong></p>
          <p>Estado: <strong>${UI.escapeHTML(profileUser.status || "active")}</strong></p>
          <div class="profile-actions">
            ${chatButton}
            ${isSelf && Auth.isAdminOrModerator() ? `<a class="warning-btn inline-btn" href="#/admin">${Auth.isAdmin() ? "Abrir panel admin" : "Abrir moderacion"}</a>` : ""}
          </div>
        </div>
      </div>
      <section class="profile-posts">
        <h2>Publicaciones</h2>
        ${profileError ? `<p class="muted">Perfil cargado con datos locales. Para ver publicaciones completas de este usuario, actualiza el backend.</p>` : ""}
        ${posts.length ? posts.map(post => Posts.card(post, true)).join("") : `<p class="muted">No hay publicaciones para mostrar.</p>`}
      </section>
    `;
    Feed.bindFeedActions();
  }

  function reload() { render(); }

  window.addEventListener("hashchange", render);
  document.addEventListener("DOMContentLoaded", () => {
    UI.bindGlobalNavigation();
    if (!location.hash) location.hash = APP_CONFIG.defaultRoute;
    render();
  });

  return { render, reload };
})();
