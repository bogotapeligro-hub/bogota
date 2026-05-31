const Feed = (() => {
  function sidebar(active = "Inicio") {
    const items = [
      ["Inicio", "#/feed"],
      ["Publicar", "#/create-post"],
      ["Shorts", "#/shorts"],
      ["Alertas", "#/alertas"],
      ["Chat", "#/chat"],
      ["Mapa", "#/mapa"],
      ["Juegos", "#/casino"],
      ["Tendencias", "#/feed?tag=tendencias"],
      ["Manifestaciones", "#/feed?cat=Manifestacion"],
      ["Accidentes", "#/feed?cat=Accidente"],
      ["Contenido sensible", "#/feed?sensitive=visible"],
      ["Movilidad", "#/feed?cat=Movilidad"],
      ["Reglas", "#/rules"],
      ["Perfil", "#/profile"]
    ];
    if (Auth.isAdminOrModerator?.()) {
      items.splice(4, 0, [Auth.isAdmin() ? "Panel Admin" : "Moderacion", "#/admin"]);
    }
    return `
      <aside class="left-sidebar">
        <div class="sidebar-card">
          ${items.map(([label, href]) => `<a href="${href}" class="side-link ${label === active ? "active" : ""}">${UI.escapeHTML(label)}${label === "Chat" ? ` <span class="chat-badge hidden" data-chat-badge>0</span>` : ""}</a>`).join("")}
        </div>
        <div class="sidebar-card caution-card">
          <strong>Regla critica</strong>
          <p>No subas datos personales, amenazas, menores en situacion vulnerable ni contenido que incite violencia.</p>
        </div>
      </aside>
    `;
  }

  function rightbar(posts = []) {
    const tagCounts = {};
    posts.forEach(post => Posts.parseTags(post.tags).forEach(tag => tagCounts[tag] = (tagCounts[tag] || 0) + 1));
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const categories = APP_CONFIG.categories.map(cat => ({ cat, count: posts.filter(post => post.category === cat).length })).filter(item => item.count);
    return `
      <aside class="right-sidebar">
        <section class="trend-card">
          <h3>Tendencias Bogota</h3>
          ${categories.length ? categories.map(item => `<a href="#/feed?cat=${encodeURIComponent(item.cat)}"><span>${UI.escapeHTML(item.cat)}</span><strong>${item.count}</strong></a>`).join("") : `<p class="muted">Sin tendencias todavia.</p>`}
        </section>
        <section class="trend-card">
          <h3>Etiquetas populares</h3>
          <div class="tag-row">${topTags.length ? topTags.map(([tag]) => `<a class="chip" href="#/feed?tag=${encodeURIComponent(tag)}">#${UI.escapeHTML(tag)}</a>`).join("") : `<span class="muted">Publica con etiquetas.</span>`}</div>
        </section>
        <section class="trend-card safety-card">
          <h3>Seguridad y reglas</h3>
          <p>El contenido fuerte aparece difuminado. Reporta menores, datos personales, amenazas, acoso o material sin contexto.</p>
          <a class="warning-link" href="#/rules">Ver reglas completas</a>
        </section>
        <section class="trend-card help-card">
          <h3>Ayuda util</h3>
          ${(APP_CONFIG.emergencyLinks || []).map(item => `<div class="help-row"><strong>${UI.escapeHTML(item.label)}</strong><span>${UI.escapeHTML(item.detail)}</span></div>`).join("")}
        </section>
      </aside>
    `;
  }

  function renderAlertStrip(posts = []) {
    const alertPosts = posts
      .filter(post => ["Alerta", "Manifestacion", "Trafico", "Seguridad", "Incidente", "Accidente", "Emergencia"].includes(post.category) || post.alertLevel)
      .slice(0, 3);
    if (!alertPosts.length) return "";
    return `
      <section class="city-alert-strip">
        <div class="city-alert-head">
          <div><span class="badge-alert">Alertas de la ciudad</span><h2>Situaciones recientes</h2></div>
          <a class="ghost-btn" href="#/alertas">Ver todas</a>
        </div>
        <div class="city-alert-grid">
          ${alertPosts.map(post => `
            <a class="city-alert-card level-${UI.escapeHTML(String(post.alertLevel || "Medio").toLowerCase())}" href="#/post/${encodeURIComponent(post.postId)}">
              <strong>${UI.escapeHTML(post.title)}</strong>
              <span>${UI.escapeHTML(post.location)} - ${UI.escapeHTML(post.category)}</span>
              <small>Nivel ${UI.escapeHTML(post.alertLevel || "Medio")} - ${UI.formatDate(post.createdAt)}</small>
            </a>
          `).join("")}
        </div>
      </section>
    `;
  }

  async function render() {
    const filters = parseHashQuery();
    UI.renderApp(`
      <div class="feed-layout">
        ${sidebar("Inicio")}
        <section class="feed-column">
          <div class="feed-hero">
            <span class="badge-alert">Bogota en tiempo real</span>
            <h1>Reportes ciudadanos y alertas urbanas</h1>
            <p>Comparte informacion de interes publico con contexto. Las peleas, accidentes y agresiones se tratan como contenido sensible, no como entretenimiento.</p>
          </div>
          ${renderFeedTools(filters)}
          <div id="feedPosts">${UI.skeletonPosts(4)}</div>
        </section>
        <aside class="right-sidebar"><section class="trend-card"><h3>Cargando...</h3></section></aside>
      </div>
    `);

    try {
      const result = await Api.apiListPosts();
      const allPosts = (result.posts || [])
        .map(Posts.sanitizePostData)
        .filter(post => post.status === "active")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      let posts = allPosts;
      const { cat, tag, loc, sort, q, sensitive } = filters;
      if (cat) posts = posts.filter(post => post.category === cat);
      if (tag) posts = posts.filter(post => Posts.parseTags(post.tags).map(x => x.toLowerCase()).includes(tag.toLowerCase()));
      if (loc) posts = posts.filter(post => String(post.location || "").toLowerCase().includes(loc.toLowerCase()));
      if (sensitive !== "visible") posts = posts.filter(post => !post.isSensitive);
      if (q) {
        const ql = q.toLowerCase();
        posts = posts.filter(post => post.title.toLowerCase().includes(ql) || post.description.toLowerCase().includes(ql) || post.location.toLowerCase().includes(ql) || (post.tags || "").toLowerCase().includes(ql));
      }
      posts = sortPosts(posts, sort);

      const layout = document.querySelector(".feed-layout");
      const feedPosts = document.getElementById("feedPosts");
      if (!layout || !feedPosts) return;
      document.querySelector(".right-sidebar")?.remove();
      layout.insertAdjacentHTML("beforeend", rightbar(allPosts));
      feedPosts.insertAdjacentHTML("beforebegin", renderAlertStrip(allPosts));
      feedPosts.innerHTML = posts.length
        ? posts.map(post => Posts.card(post)).join("")
        : UI.emptyState("No hay publicaciones", cat || tag || loc || q ? "No hay reportes activos con esos filtros." : "Todavia no hay publicaciones registradas. Se el primero en reportar.", `<a class="warning-btn inline-btn" href="#/create-post">Crear publicacion</a>`, "!");
      bindFeedActions();
      bindFeedFilters();
      bindFeedSearch();
    } catch (error) {
      const feedPosts = document.getElementById("feedPosts");
      if (feedPosts) feedPosts.innerHTML = UI.emptyState("Error cargando feed", error.message || "No se pudo conectar con la base de datos. Revisa la URL de Apps Script en config.js.");
      else UI.toast(error.message || "Error cargando feed.", "error");
    }
  }

  function parseHashQuery() {
    const [, query = ""] = location.hash.split("?");
    const params = new URLSearchParams(query);
    return {
      cat: params.get("cat"),
      tag: params.get("tag"),
      loc: params.get("loc"),
      sort: params.get("sort") || "recent",
      q: params.get("q") || "",
      sensitive: params.get("sensitive") || "hidden"
    };
  }

  function renderFeedTools(filters = {}) {
    const option = (value, label, selected) => `<option value="${UI.escapeHTML(value)}" ${value === selected ? "selected" : ""}>${UI.escapeHTML(label)}</option>`;
    return `
      <section class="feed-tools" aria-label="Filtros de publicaciones">
        <div class="feed-search-bar">
          <input type="search" id="feedSearchInput" class="feed-search-input" placeholder="Buscar publicaciones..." value="${UI.escapeHTML(filters.q || "")}" />
          <button class="ghost-btn" id="feedSearchClear">Limpiar</button>
        </div>
        <div class="feed-tools-row">
          <label><span>Localidad</span><select id="feedLocalityFilter">${option("", "Todas", filters.loc || "")}${APP_CONFIG.localities.map(locality => option(locality, locality, filters.loc || "")).join("")}</select></label>
          <label><span>Categoria</span><select id="feedCategoryFilter">${option("", "Todas", filters.cat || "")}${APP_CONFIG.categories.map(category => option(category, category, filters.cat || "")).join("")}</select></label>
          <label><span>Orden</span><select id="feedSortFilter">${option("recent", "Mas recientes", filters.sort || "recent")}${option("commented", "Mas comentados", filters.sort || "recent")}${option("popular", "Mas reaccionados", filters.sort || "recent")}</select></label>
          <label><span>Sensible</span><select id="feedSensitiveFilter">${option("hidden", "Oculto por defecto", filters.sensitive || "hidden")}${option("visible", "Mostrar con advertencia", filters.sensitive || "hidden")}</select></label>
          <a class="ghost-btn feed-map-link" href="#/mapa">Ver mapa</a>
        </div>
      </section>
    `;
  }

  function bindFeedSearch() {
    const input = document.getElementById("feedSearchInput");
    const clear = document.getElementById("feedSearchClear");
    if (!input) return;
    const handler = () => {
      const q = input.value.trim();
      const params = new URLSearchParams(location.hash.split("?")[1] || "");
      if (q) params.set("q", q); else params.delete("q");
      location.hash = `#/feed${params.toString() ? `?${params}` : ""}`;
    };
    let debounceTimer;
    input.addEventListener("input", () => {
      clearDebounceTimer(debounceTimer);
      debounceTimer = setTimeout(handler, 400);
    });
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        clearDebounceTimer(debounceTimer);
        handler();
      }
    });
    clear?.addEventListener("click", () => {
      input.value = "";
      clearDebounceTimer(debounceTimer);
      handler();
    });
  }

  function clearDebounceTimer(timer) {
    if (timer) clearTimeout(timer);
  }

  function sortPosts(posts, sort = "recent") {
    const list = [...posts];
    if (sort === "commented") return list.sort((a, b) => Number(b.commentCount || 0) - Number(a.commentCount || 0) || new Date(b.createdAt) - new Date(a.createdAt));
    if (sort === "popular") return list.sort((a, b) => Number(b.reactionCount || 0) - Number(a.reactionCount || 0) || new Date(b.createdAt) - new Date(a.createdAt));
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function bindFeedFilters() {
    const update = () => {
      const params = new URLSearchParams();
      const loc = document.getElementById("feedLocalityFilter")?.value || "";
      const cat = document.getElementById("feedCategoryFilter")?.value || "";
      const sort = document.getElementById("feedSortFilter")?.value || "recent";
      const sensitive = document.getElementById("feedSensitiveFilter")?.value || "hidden";
      const q = document.getElementById("feedSearchInput")?.value.trim() || "";
      if (loc) params.set("loc", loc);
      if (cat) params.set("cat", cat);
      if (sort && sort !== "recent") params.set("sort", sort);
      if (sensitive === "visible") params.set("sensitive", sensitive);
      if (q) params.set("q", q);
      location.hash = `#/feed${params.toString() ? `?${params}` : ""}`;
    };
    ["feedLocalityFilter", "feedCategoryFilter", "feedSortFilter", "feedSensitiveFilter"].forEach(id => document.getElementById(id)?.addEventListener("change", update));
  }

  function bindFeedActions() {
    Reactions.bind(document);
    Posts.bindReportButtons(document);
    Posts.bindShareButtons(document);
    Posts.bindSaveButtons(document);
    Posts.bindSensitiveMedia(document);
    Posts.bindVerificationButtons(document);
    Posts.bindChatShareButtons(document);
    Posts.bindAdminInline(document);
    Comments.bindModerationButtons(document);
    document.querySelectorAll("[data-open-post]").forEach(card => {
      card.addEventListener("click", event => {
        if (event.target.closest("a, button, input, textarea, select, video")) return;
        location.hash = `#/post/${card.dataset.openPost}`;
      });
      card.addEventListener("keydown", event => {
        if ((event.key === "Enter" || event.key === " ") && !event.target.closest("a, button, input, textarea, select")) {
          event.preventDefault();
          location.hash = `#/post/${card.dataset.openPost}`;
        }
      });
    });
    document.querySelectorAll("[data-comment-open]").forEach(button => button.addEventListener("click", () => location.hash = `#/post/${button.dataset.commentOpen}`));
    if (typeof Chat !== "undefined") Chat.updateBadges?.();
  }

  return { render, sidebar, rightbar, bindFeedActions, parseHashQuery, sortPosts, renderAlertStrip };
})();
