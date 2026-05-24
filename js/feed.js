const Feed = (() => {
  function sidebar(active = "Inicio") {
    const items = [
      ["Inicio", "#/feed"],
      ["Publicar", "#/create-post"],
      ["Chat", "#/chat"],
      ["¿Quieres jugar?", "#/casino"],
      ["Tendencias", "#/feed?tag=tendencias"],
      ["Manifestaciones", "#/feed?cat=Manifestacion"],
      ["Accidentes", "#/feed?cat=Accidente"],
      ["Peleas", "#/feed?cat=Pelea"],
      ["Movilidad", "#/feed?cat=Movilidad"],
      ["Reglas", "#/rules"],
      ["Perfil", "#/profile"]
    ];
    if (Auth.isAdminOrModerator?.()) {
      items.splice(3, 0, [Auth.isAdmin() ? "Panel Admin" : "Moderacion", "#/admin"]);
    }
    return `
      <aside class="left-sidebar">
        <div class="sidebar-card">
          ${items.map(([label, href]) => `<a href="${href}" class="side-link ${label === active ? "active" : ""}">${UI.escapeHTML(label)}${label === "Chat" ? ` <span class="chat-badge hidden" data-chat-badge>0</span>` : ""}</a>`).join("")}
        </div>
        <div class="sidebar-card caution-card">
          <strong>Regla critica</strong>
          <p>No subas contenido con menores en situaciones vulnerables, datos personales, amenazas o incitacion a delitos.</p>
        </div>
      </aside>
    `;
  }

  function rightbar(posts = []) {
    const tagCounts = {};
    posts.forEach((post) => Posts.parseTags(post.tags).forEach((tag) => tagCounts[tag] = (tagCounts[tag] || 0) + 1));
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const categories = APP_CONFIG.categories.map((cat) => ({ cat, count: posts.filter((post) => post.category === cat).length })).filter((item) => item.count);

    return `
      <aside class="right-sidebar">
        <section class="trend-card">
          <h3>Tendencias Bogota</h3>
          ${categories.length ? categories.map((item) => `<a href="#/feed?cat=${encodeURIComponent(item.cat)}"><span>${UI.escapeHTML(item.cat)}</span><strong>${item.count}</strong></a>`).join("") : `<p class="muted">Sin tendencias todavia.</p>`}
        </section>
        <section class="trend-card">
          <h3>Etiquetas populares</h3>
          <div class="tag-row">${topTags.length ? topTags.map(([tag]) => `<a class="chip" href="#/feed?tag=${encodeURIComponent(tag)}">#${UI.escapeHTML(tag)}</a>`).join("") : `<span class="muted">Publica con etiquetas.</span>`}</div>
        </section>
        <section class="trend-card safety-card">
          <h3>Seguridad y reglas</h3>
          <p>Reporta contenido que involucre menores, datos personales, amenazas, acoso o material demasiado grafico sin advertencia.</p>
          <a class="warning-link" href="#/rules">Ver reglas completas</a>
        </section>
      </aside>
    `;
  }

  async function render() {
    UI.renderApp(`
      <div class="feed-layout">
        ${sidebar("Inicio")}
        <section class="feed-column">
          <div class="feed-hero">
            <span class="badge-alert">Bogota en tiempo real</span>
            <h1>Reportes ciudadanos y alertas urbanas</h1>
            <p>Comparte informacion de interes publico con responsabilidad. Evita datos personales, acusaciones sin evidencia y contenido prohibido.</p>
          </div>
          <div id="feedPosts">${UI.skeletonPosts(4)}</div>
        </section>
        <aside class="right-sidebar"><section class="trend-card"><h3>Cargando...</h3></section></aside>
      </div>
    `);

    try {
      const result = await Api.apiListPosts();
      const allPosts = (result.posts || [])
        .map(Posts.sanitizePostData)
        .filter((post) => post.status === "active")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      let posts = allPosts;
      const { cat, tag } = parseHashQuery();
      if (cat) posts = posts.filter((post) => post.category === cat);
      if (tag) posts = posts.filter((post) => Posts.parseTags(post.tags).map((x) => x.toLowerCase()).includes(tag.toLowerCase()));

      const layout = document.querySelector(".feed-layout");
      const feedPosts = document.getElementById("feedPosts");
      if (!layout || !feedPosts) return;

      document.querySelector(".right-sidebar")?.remove();
      layout.insertAdjacentHTML("beforeend", rightbar(allPosts));
      feedPosts.innerHTML = posts.length
        ? posts.map((post) => Posts.card(post)).join("")
        : UI.emptyState("No hay publicaciones", cat || tag ? "No hay reportes activos con ese filtro." : "Todavia no hay publicaciones registradas en la base de datos.", `<a class="warning-btn inline-btn" href="#/create-post">Crear publicacion</a>`);

      bindFeedActions();
    } catch (error) {
      const feedPosts = document.getElementById("feedPosts");
      if (feedPosts) {
        feedPosts.innerHTML = UI.emptyState("Error cargando feed", error.message || "No se pudo conectar con la base de datos. Revisa la URL de Apps Script en config.js.");
      } else {
        UI.toast(error.message || "Error cargando feed.", "error");
      }
    }
  }

  function parseHashQuery() {
    const [, query = ""] = location.hash.split("?");
    const params = new URLSearchParams(query);
    return { cat: params.get("cat"), tag: params.get("tag") };
  }

  function bindFeedActions() {
    Reactions.bind(document);
    Posts.bindReportButtons(document);
    Posts.bindShareButtons(document);
    Posts.bindAdminInline(document);
    Comments.bindModerationButtons(document);
    document.querySelectorAll("[data-open-post]").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest("a, button, input, textarea, select, video")) return;
        location.hash = `#/post/${card.dataset.openPost}`;
      });
      card.addEventListener("keydown", (event) => {
        if ((event.key === "Enter" || event.key === " ") && !event.target.closest("a, button, input, textarea, select")) {
          event.preventDefault();
          location.hash = `#/post/${card.dataset.openPost}`;
        }
      });
    });
    document.querySelectorAll("[data-comment-open]").forEach((button) => {
      button.addEventListener("click", () => location.hash = `#/post/${button.dataset.commentOpen}`);
    });
    if (typeof Chat !== "undefined") Chat.updateBadges?.();
  }

  return { render, sidebar, rightbar, bindFeedActions };
})();
