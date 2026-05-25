const MapaReportes = (() => {
  const BOGOTA_ZONES = {
    suba: [27, 17],
    usaquen: [62, 14],
    chapinero: [55, 31],
    teusaquillo: [45, 43],
    engativa: [24, 39],
    fontibon: [25, 55],
    kennedy: [33, 67],
    bosa: [24, 78],
    candelaria: [56, 51],
    santafe: [58, 46],
    martires: [48, 54],
    "puente aranda": [43, 61],
    tunjuelito: [45, 74],
    usme: [62, 83],
    "ciudad bolivar": [38, 86]
  };

  async function render() {
    UI.renderApp(`
      <div class="feed-layout map-layout">
        ${Feed.sidebar("Mapa")}
        <section class="feed-column">
          <div class="feed-hero">
            <span class="badge-alert">Mapa aproximado</span>
            <h1>Reportes activos por zona</h1>
            <p>Los pines muestran una zona general para proteger privacidad. No se publican coordenadas exactas ni direcciones precisas.</p>
          </div>
          <section class="feed-tools">
            <div class="feed-tools-row map-tools-row">
              <label>
                <span>Localidad</span>
                <select id="mapLocalityFilter">
                  <option value="">Todas</option>
                  ${APP_CONFIG.localities.map(locality => `<option value="${UI.escapeHTML(locality)}">${UI.escapeHTML(locality)}</option>`).join("")}
                </select>
              </label>
              <label>
                <span>Categoria</span>
                <select id="mapCategoryFilter">
                  <option value="">Todas</option>
                  ${APP_CONFIG.categories.map(category => `<option value="${UI.escapeHTML(category)}">${UI.escapeHTML(category)}</option>`).join("")}
                </select>
              </label>
              <button class="ghost-btn" type="button" id="approxLocationBtn">Usar mi zona</button>
              <a class="warning-btn inline-btn" href="#/create-post">Crear reporte</a>
            </div>
          </section>
          <section class="report-map-card">
            <div id="reportMapCanvas" class="report-map-canvas">${UI.skeletonPosts(1)}</div>
            <div id="reportMapList" class="report-map-list"></div>
          </section>
        </section>
      </div>
    `);

    try {
      const result = await Api.apiListPosts();
      const allPosts = (result.posts || []).map(Posts.sanitizePostData).filter(post => post.status === "active");
      renderPins(allPosts);
      bindFilters(allPosts);
    } catch (error) {
      document.getElementById("reportMapCanvas").innerHTML = UI.emptyState("No se pudo cargar el mapa", error.message || "Revisa la conexion con la base de datos.");
    }
  }

  function bindFilters(allPosts) {
    const redraw = () => renderPins(allPosts);
    document.getElementById("mapLocalityFilter")?.addEventListener("change", redraw);
    document.getElementById("mapCategoryFilter")?.addEventListener("change", redraw);
    document.getElementById("approxLocationBtn")?.addEventListener("click", () => {
      UI.toast("Usaremos solo tu zona aproximada. No se guardan coordenadas exactas.", "info");
      if (!navigator.geolocation) {
        UI.toast("Tu navegador no permite geolocalizacion.", "warning");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => UI.toast("Ubicacion aproximada recibida. Elige tu localidad para filtrar mejor.", "success"),
        () => UI.toast("No se pudo obtener permiso. Puedes seleccionar la localidad manualmente.", "warning"),
        { enableHighAccuracy: false, timeout: 7000, maximumAge: 600000 }
      );
    });
  }

  function renderPins(allPosts) {
    const loc = document.getElementById("mapLocalityFilter")?.value || "";
    const cat = document.getElementById("mapCategoryFilter")?.value || "";
    let posts = allPosts;
    if (loc) posts = posts.filter(post => String(post.location || "").toLowerCase().includes(loc.toLowerCase()));
    if (cat) posts = posts.filter(post => post.category === cat);
    posts = posts.slice(0, 60);

    const canvas = document.getElementById("reportMapCanvas");
    const list = document.getElementById("reportMapList");
    if (!canvas || !list) return;

    canvas.innerHTML = `
      <div class="map-grid-lines" aria-hidden="true"></div>
      <div class="map-label north">Norte</div>
      <div class="map-label center">Centro</div>
      <div class="map-label south">Sur</div>
      ${posts.map(renderPin).join("")}
    `;
    list.innerHTML = posts.length
      ? posts.map(post => `
        <a class="report-map-item" href="#/post/${encodeURIComponent(post.postId)}">
          <strong>${UI.escapeHTML(post.title)}</strong>
          <span>${UI.escapeHTML(post.category)} · ${UI.escapeHTML(post.location || "Zona no especificada")}</span>
        </a>
      `).join("")
      : `<div class="chat-empty">No hay reportes activos con esos filtros.</div>`;
  }

  function renderPin(post) {
    const [x, y] = approximatePoint(post.location || post.category || post.postId);
    return `
      <a class="report-pin ${categoryClass(post.category)}" style="left:${x}%;top:${y}%;" href="#/post/${encodeURIComponent(post.postId)}" title="${UI.escapeHTML(post.title)}">
        <span></span>
      </a>
    `;
  }

  function approximatePoint(value) {
    const text = normalize(value);
    const found = Object.entries(BOGOTA_ZONES).find(([key]) => text.includes(key));
    if (found) return jitter(found[1], text);
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    return [18 + (hash % 66), 16 + ((hash >> 8) % 70)];
  }

  function jitter(point, seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) hash = (hash + seed.charCodeAt(i) * (i + 3)) % 997;
    return [
      clamp(point[0] + (hash % 9) - 4, 8, 92),
      clamp(point[1] + ((hash >> 3) % 9) - 4, 8, 92)
    ];
  }

  function normalize(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function categoryClass(category = "") {
    return `cat-${normalize(category).replace(/[^a-z0-9]+/g, "-")}`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  return { render };
})();
