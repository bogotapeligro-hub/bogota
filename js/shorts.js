const Shorts = (() => {
  const KEY = "bau_shorts_v1";
  const MAX_SHORTS = 100;
  const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

  function getAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
    catch { return []; }
  }

  function saveAll(list) {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_SHORTS)));
  }

  function isSensitiveCategory(category = "") {
    return (APP_CONFIG.sensitiveCategories || []).includes(category);
  }

  function addShort(data) {
    const user = Auth.user();
    if (!user) return null;
    const short = {
      id: `short_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      userId: user.userId || user.username,
      username: user.username,
      title: data.title || "",
      description: data.description || "",
      category: data.category || "Short",
      isSensitive: Boolean(data.isSensitive) || isSensitiveCategory(data.category),
      mediaUrl: data.mediaUrl || "",
      mediaType: data.mediaType || "image",
      reactions: {},
      commentCount: 0,
      views: 0,
      saved: 0,
      createdAt: new Date().toISOString()
    };
    const all = getAll();
    all.unshift(short);
    saveAll(all);
    return short;
  }

  function react(shortId, reaction) {
    const all = getAll();
    const short = all.find(s => s.id === shortId);
    const user = Auth.user();
    if (!short || !user) return;
    const userId = user.userId || user.username;
    short.reactions[userId] = short.reactions[userId] === reaction ? null : reaction;
    saveAll(all);
  }

  function incrementViews(shortId) {
    const all = getAll();
    const short = all.find(s => s.id === shortId);
    if (!short) return;
    short.views = (short.views || 0) + 1;
    saveAll(all);
  }

  function addComment(shortId) {
    const all = getAll();
    const short = all.find(s => s.id === shortId);
    if (!short) return;
    short.commentCount = (short.commentCount || 0) + 1;
    saveAll(all);
  }

  function renderCard(short) {
    const user = Auth.user();
    const userId = user?.userId || user?.username || "";
    const myReaction = short.reactions?.[userId];
    const mediaTag = short.mediaType === "video"
      ? `<video class="short-video" src="${UI.escapeHTML(short.mediaUrl)}" loop muted playsinline preload="metadata"></video>`
      : `<img class="short-image" src="${UI.escapeHTML(short.mediaUrl || "assets/placeholder-post.svg")}" alt="${UI.escapeHTML(short.title)}" loading="lazy" />`;
    return `
      <article class="short-card ${short.isSensitive ? "short-sensitive locked" : ""}" data-short-id="${UI.escapeHTML(short.id)}">
        <div class="short-media-wrap" data-short-play>
          ${mediaTag}
          <div class="short-play-overlay ${short.mediaType === "video" ? "" : "hidden"}">Play</div>
          ${short.isSensitive ? `
            <div class="short-sensitive-warning">
              <span>Contenido sensible</span>
              <strong>Este short puede contener imagenes fuertes.</strong>
              <button class="warning-btn" type="button" data-short-reveal>Ver short</button>
            </div>
          ` : ""}
        </div>
        <div class="short-info">
          <div class="short-head">
            <a href="#/profile/${encodeURIComponent(short.userId || short.username)}" class="short-author">${typeof Profile !== "undefined" ? Profile.renderAvatar(short.username, 28) : ""} @${UI.escapeHTML(short.username)}</a>
            <span class="category-pill">${UI.escapeHTML(short.category || "Short")}</span>
          </div>
          <h3 class="short-title">${UI.escapeHTML(short.title)}</h3>
          ${short.description ? `<p class="short-desc">${UI.escapeHTML(short.description)}</p>` : ""}
          <div class="short-stats"><span>${short.views || 0} vistas</span><span>${short.commentCount || 0} comentarios</span></div>
          <div class="short-actions">
            <button class="short-action-btn ${myReaction === "like" ? "active" : ""}" data-short-react="like">${myReaction === "like" ? "Te gusta" : "Me gusta"}</button>
            <button class="short-action-btn" data-short-comment>Comentar</button>
            <button class="short-action-btn" data-short-save>Guardar</button>
            <button class="short-action-btn" data-short-share="${UI.escapeHTML(short.id)}">Compartir</button>
            <button class="short-action-btn danger" data-short-report="${UI.escapeHTML(short.id)}">Reportar</button>
          </div>
        </div>
      </article>
    `;
  }

  function render() {
    if (!UI.requireSession()) return;
    const all = getAll();
    const user = Auth.user();
    const avatarHtml = typeof Profile !== "undefined" && user ? Profile.renderAvatar(user.username, 36) : "";
    UI.renderApp(`
      <div class="feed-layout shorts-layout">
        ${Feed.sidebar("Shorts")}
        <section class="shorts-column">
          <div class="shorts-header">
            <span class="badge-alert">Shorts urbanos</span>
            <h1>Clips cortos con contexto</h1>
            <p class="muted">Reportes, manifestaciones, eventos, comunidad y clips de juegos en formato vertical.</p>
          </div>
          <div class="short-upload-box">
            <div class="short-upload-avatar">${avatarHtml}</div>
            <div class="short-upload-form" id="shortUploadForm">
              <input type="text" id="shortTitleInput" placeholder="Titulo del short..." maxlength="60" />
              <input type="text" id="shortDescInput" placeholder="Descripcion o contexto" maxlength="200" />
              <div class="short-upload-grid">
                <select id="shortCategoryInput">${APP_CONFIG.categories.map(category => `<option value="${UI.escapeHTML(category)}" ${category === "Short" ? "selected" : ""}>${UI.escapeHTML(category)}</option>`).join("")}</select>
                <label class="check-row short-sensitive-check"><input id="shortSensitiveInput" type="checkbox" /> <span>Sensible</span></label>
              </div>
              <div class="short-upload-actions">
                <label class="ghost-btn short-media-btn">Subir imagen<input type="file" accept="image/*" hidden id="shortImageInput" /></label>
                <label class="ghost-btn short-media-btn">Subir video<input type="file" accept="video/mp4,video/webm" hidden id="shortVideoInput" /></label>
                <button class="warning-btn" id="shortPublishBtn" disabled>Publicar</button>
              </div>
              <div id="shortPreview" class="short-preview hidden"></div>
            </div>
          </div>
          <div class="shorts-feed" id="shortsFeed">
            ${all.length === 0 ? `<div class="shorts-empty"><span class="shorts-empty-icon">Video</span><h3>Todavia no hay shorts</h3><p>Comparte el primer clip urbano con contexto.</p></div>` : all.map(s => renderCard(s)).join("")}
          </div>
        </section>
      </div>
    `);
    bind();
  }

  function bind() {
    const imageInput = document.getElementById("shortImageInput");
    const videoInput = document.getElementById("shortVideoInput");
    const titleInput = document.getElementById("shortTitleInput");
    const categoryInput = document.getElementById("shortCategoryInput");
    const sensitiveInput = document.getElementById("shortSensitiveInput");
    const publishBtn = document.getElementById("shortPublishBtn");
    const preview = document.getElementById("shortPreview");
    let selectedFile = null;
    let selectedType = "";

    const updatePublishBtn = () => { if (publishBtn) publishBtn.disabled = !selectedFile || !titleInput?.value.trim(); };
    categoryInput?.addEventListener("change", () => { if (sensitiveInput && isSensitiveCategory(categoryInput.value)) sensitiveInput.checked = true; });
    titleInput?.addEventListener("input", updatePublishBtn);
    imageInput?.addEventListener("change", () => handleFile(imageInput.files?.[0], "image"));
    videoInput?.addEventListener("change", () => handleFile(videoInput.files?.[0], "video"));

    function handleFile(file, type) {
      if (!file) return;
      if (type === "video" && file.size > MAX_VIDEO_BYTES) {
        UI.toast("El video no puede superar 25 MB.", "warning");
        videoInput.value = "";
        return;
      }
      selectedFile = file;
      selectedType = type;
      if (type === "image" && videoInput) videoInput.value = "";
      if (type === "video" && imageInput) imageInput.value = "";
      showPreview(URL.createObjectURL(file), type);
      updatePublishBtn();
    }

    function showPreview(url, type) {
      if (!preview) return;
      preview.classList.remove("hidden");
      preview.innerHTML = type === "video"
        ? `<video src="${url}" controls muted loop class="short-preview-media"></video><button class="mini-btn" id="shortRemoveMedia">Quitar</button>`
        : `<img src="${url}" class="short-preview-media" alt="Vista previa" /><button class="mini-btn" id="shortRemoveMedia">Quitar</button>`;
      preview.querySelector("#shortRemoveMedia")?.addEventListener("click", () => {
        selectedFile = null;
        selectedType = "";
        if (imageInput) imageInput.value = "";
        if (videoInput) videoInput.value = "";
        preview.classList.add("hidden");
        updatePublishBtn();
      });
    }

    publishBtn?.addEventListener("click", async () => {
      if (!selectedFile || !titleInput?.value.trim()) return;
      try {
        publishBtn.disabled = true;
        publishBtn.textContent = "Publicando...";
        let mediaUrl = "";
        if (Api.hasConfiguredApiUrl()) {
          const uploaded = await Api.apiUploadMedia(Auth.token(), {
            name: selectedFile.name,
            mimeType: selectedFile.type,
            mediaType: selectedType,
            size: selectedFile.size,
            content: await readFileAsBase64(selectedFile)
          });
          mediaUrl = uploaded.mediaUrl;
        } else {
          mediaUrl = await readFileAsDataUrl(selectedFile);
        }
        const short = addShort({
          title: titleInput.value.trim(),
          description: document.getElementById("shortDescInput")?.value.trim() || "",
          category: categoryInput?.value || "Short",
          isSensitive: Boolean(sensitiveInput?.checked),
          mediaUrl,
          mediaType: selectedType
        });
        if (short) {
          Notifications.add?.("short", "Nuevo short", "Publicaste un short urbano.", "#/shorts", "!");
          UI.toast("Short publicado.", "success");
          render();
        }
      } catch (error) {
        UI.toast(error.message || "Error al publicar short.", "error");
      } finally {
        if (publishBtn) {
          publishBtn.disabled = false;
          publishBtn.textContent = "Publicar";
        }
      }
    });

    document.querySelectorAll("[data-short-reveal]").forEach(btn => btn.addEventListener("click", event => event.target.closest(".short-card")?.classList.remove("locked")));
    document.querySelectorAll("[data-short-react]").forEach(btn => btn.addEventListener("click", () => {
      const card = btn.closest("[data-short-id]");
      if (!card) return;
      react(card.dataset.shortId, "like");
      render();
    }));
    document.querySelectorAll("[data-short-comment]").forEach(btn => btn.addEventListener("click", () => {
      const card = btn.closest("[data-short-id]");
      if (card) addComment(card.dataset.shortId);
      UI.toast("Comentario registrado para el short.", "success");
      render();
    }));
    document.querySelectorAll("[data-short-save]").forEach(btn => btn.addEventListener("click", () => UI.toast("Short guardado.", "success")));
    document.querySelectorAll("[data-short-report]").forEach(btn => btn.addEventListener("click", () => UI.toast("Reporte de short recibido para revision.", "success")));
    document.querySelectorAll("[data-short-share]").forEach(btn => btn.addEventListener("click", () => {
      const url = `${location.origin}${location.pathname}#/shorts`;
      if (navigator.share) navigator.share({ title: `Short en ${APP_CONFIG.appName}`, url }).catch(() => {});
      else navigator.clipboard.writeText(url).then(() => UI.toast("Enlace copiado.", "success")).catch(() => {});
    }));
    document.querySelectorAll("[data-short-play]").forEach(wrap => {
      const video = wrap.querySelector("video");
      if (!video) return;
      wrap.addEventListener("click", event => {
        if (event.target.closest("button") || wrap.closest(".short-card")?.classList.contains("locked")) return;
        if (video.paused) {
          video.play();
          wrap.querySelector(".short-play-overlay")?.classList.add("hidden");
          const card = wrap.closest("[data-short-id]");
          if (card) incrementViews(card.dataset.shortId);
        } else {
          video.pause();
          wrap.querySelector(".short-play-overlay")?.classList.remove("hidden");
        }
      });
    });
  }

  function readFileAsBase64(file) {
    return readFileAsDataUrl(file).then(value => String(value).split(",")[1] || "");
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
      reader.readAsDataURL(file);
    });
  }

  return { render, getAll, addShort, react, incrementViews, addComment };
})();
