const Alerts = (() => {
  const ALERT_CATEGORIES = ["Alerta", "Manifestacion", "Trafico", "Seguridad", "Incidente", "Accidente", "Emergencia"];

  async function render() {
    if (!UI.requireSession()) return;
    UI.renderApp(`
      <div class="feed-layout map-layout">
        ${Feed.sidebar("Alertas")}
        <section class="feed-column">
          <div class="feed-hero">
            <span class="badge-alert">Alertas de la ciudad</span>
            <h1>Situaciones recientes por zona</h1>
            <p>Consulta reportes con nivel bajo, medio o alto. Las ubicaciones son aproximadas para proteger privacidad.</p>
          </div>
          <section class="feed-tools">
            <div class="feed-tools-row">
              <label><span>Localidad</span><select id="alertLocality"><option value="">Todas</option>${APP_CONFIG.localities.map(item => `<option value="${UI.escapeHTML(item)}">${UI.escapeHTML(item)}</option>`).join("")}</select></label>
              <label><span>Tipo</span><select id="alertCategory"><option value="">Todas</option>${ALERT_CATEGORIES.map(item => `<option value="${UI.escapeHTML(item)}">${UI.escapeHTML(item)}</option>`).join("")}</select></label>
              <label><span>Nivel</span><select id="alertLevel"><option value="">Todos</option>${APP_CONFIG.alertLevels.map(item => `<option value="${UI.escapeHTML(item)}">${UI.escapeHTML(item)}</option>`).join("")}</select></label>
              <a class="warning-btn inline-btn" href="#/create-post">Reportar alerta</a>
            </div>
          </section>
          <div id="alertsList">${UI.skeletonPosts(3)}</div>
        </section>
      </div>
    `);
    try {
      const result = await Api.apiListPosts();
      const posts = (result.posts || []).map(Posts.sanitizePostData).filter(post => post.status === "active" && (ALERT_CATEGORIES.includes(post.category) || post.alertLevel));
      renderList(posts);
      ["alertLocality", "alertCategory", "alertLevel"].forEach(id => document.getElementById(id)?.addEventListener("change", () => renderList(posts)));
    } catch (error) {
      document.getElementById("alertsList").innerHTML = UI.emptyState("No se pudieron cargar alertas", error.message || "Revisa la conexion.");
    }
  }

  function renderList(allPosts) {
    const loc = document.getElementById("alertLocality")?.value || "";
    const cat = document.getElementById("alertCategory")?.value || "";
    const level = document.getElementById("alertLevel")?.value || "";
    let posts = allPosts;
    if (loc) posts = posts.filter(post => String(post.location || "").toLowerCase().includes(loc.toLowerCase()));
    if (cat) posts = posts.filter(post => post.category === cat);
    if (level) posts = posts.filter(post => (post.alertLevel || "Medio") === level);
    document.getElementById("alertsList").innerHTML = posts.length ? `
      <section class="alerts-list">
        ${posts.map(post => `
          <article class="alert-row level-${UI.escapeHTML(String(post.alertLevel || "Medio").toLowerCase())}">
            <div>
              <span class="category-pill ${categoryClass(post.category)}">${UI.escapeHTML(post.category)}</span>
              <h2>${UI.escapeHTML(post.title)}</h2>
              <p>${UI.escapeHTML(post.description)}</p>
              <div class="alert-meta">
                <span>${UI.escapeHTML(post.location)}</span>
                <span>${UI.formatDate(post.createdAt)}</span>
                <strong>Nivel ${UI.escapeHTML(post.alertLevel || "Medio")}</strong>
              </div>
            </div>
            <div class="alert-actions">
              <a class="warning-btn inline-btn" href="#/post/${encodeURIComponent(post.postId)}">Ver detalles</a>
              <button class="ghost-btn" data-share-post="${UI.escapeHTML(post.postId)}">Compartir</button>
              <button class="ghost-btn danger" data-report-target="post" data-target-id="${UI.escapeHTML(post.postId)}">Info falsa</button>
            </div>
          </article>
        `).join("")}
      </section>
    ` : UI.emptyState("Sin alertas", "No hay alertas activas con esos filtros.", `<a class="warning-btn inline-btn" href="#/create-post">Crear reporte</a>`, "!");
    Posts.bindShareButtons(document);
    Posts.bindReportButtons(document);
  }

  function categoryClass(category = "") {
    return `cat-${String(category).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}`;
  }

  return { render };
})();
