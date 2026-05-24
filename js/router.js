const Router = (() => {
  const routes = {
    "/login": { view: "login", bind: () => Auth.bindLogin() },
    "/register": { view: "register", bind: () => Auth.bindRegister() },
    "/feed": { custom: () => Feed.render() },
    "/create-post": { view: "create-post", auth: true, bind: () => Posts.bindCreatePost() },
    "/casino": { view: "casino", auth: true, bind: () => Casino.bind() },
    "/ruleta-bogotana": { view: "ruleta-bogotana", auth: true, bind: () => RuletaBogotana.init() },
    "/profile": { view: "profile", auth: true, bind: () => bindProfile() },
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
      document.querySelector(".feed-column").innerHTML = `
        <a href="#/feed" class="back-link">Volver al feed</a>
        ${Posts.card(data.post)}
        <section class="comments-section">
          <h2>Comentarios</h2>
          ${Comments.renderForm(data.post.postId)}
          <div id="commentsList">${Comments.renderList(data.comments)}</div>
        </section>
      `;
      Reactions.bind(document);
      Posts.bindReportButtons(document);
      Posts.bindShareButtons(document);
      Posts.bindAdminInline(document);
      Comments.bindForm();
      Comments.bindModerationButtons(document);
    } catch (error) {
      document.querySelector(".feed-column").innerHTML = UI.emptyState("Publicacion no encontrada", error.message, `<a class="warning-btn inline-btn" href="#/feed">Volver al feed</a>`);
    }
  }

  function bindProfile() {
    const user = Auth.user();
    const box = document.getElementById("profileBox");
    if (!box || !user) return;
    box.innerHTML = `
      <div class="profile-card">
        <div class="avatar">${UI.escapeHTML(user.username?.slice(0, 2).toUpperCase() || "BA")}</div>
        <div>
          <h2>@${UI.escapeHTML(user.username)}</h2>
          <p>Rol: <strong>${UI.escapeHTML(user.role)}</strong></p>
          <p>Estado: <strong>${UI.escapeHTML(user.status)}</strong></p>
          ${Auth.isAdminOrModerator() ? `<a class="warning-btn inline-btn" href="#/admin">${Auth.isAdmin() ? "Abrir panel admin" : "Abrir moderacion"}</a>` : ""}
        </div>
      </div>
    `;
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
