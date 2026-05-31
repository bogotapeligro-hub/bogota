const Shorts = (() => {
  const KEY = "bau_shorts_v1";
  const MAX_SHORTS = 100;
  const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

  function getAll() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveAll(list) {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_SHORTS)));
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
      mediaUrl: data.mediaUrl || "",
      mediaType: data.mediaType || "image",
      reactions: {},
      commentCount: 0,
      views: 0,
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
    if (!short) return;
    const user = Auth.user();
    if (!user) return;
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
      : `<img class="short-image" src="${UI.escapeHTML(short.mediaUrl || "assets/default-short.png")}" alt="${UI.escapeHTML(short.title)}" loading="lazy" />`;

    return `
      <article class="short-card" data-short-id="${UI.escapeHTML(short.id)}">
        <div class="short-media-wrap" data-short-play>
          ${mediaTag}
          <div class="short-play-overlay ${short.mediaType === "video" ? "" : "hidden"}">▶</div>
        </div>
        <div class="short-info">
          <div class="short-head">
            <a href="#/profile/${encodeURIComponent(short.userId || short.username)}" class="short-author">${typeof Profile !== "undefined" ? Profile.renderAvatar(short.username, 28) : ""} @${UI.escapeHTML(short.username)}</a>
          </div>
          <h3 class="short-title">${UI.escapeHTML(short.title)}</h3>
          ${short.description ? `<p class="short-desc">${UI.escapeHTML(short.description)}</p>` : ""}
          <div class="short-stats">
            <span>👁️ ${short.views || 0}</span>
            <span>💬 ${short.commentCount || 0}</span>
          </div>
          <div class="short-actions">
            <button class="short-action-btn ${myReaction === "like" ? "active" : ""}" data-short-react="like">👍 ${myReaction === "like" ? "Te gusta" : "Me gusta"}</button>
            <button class="short-action-btn" data-short-comment>💬 Comentar</button>
            <button class="short-action-btn" data-short-share="${UI.escapeHTML(short.id)}">🔗 Compartir</button>
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
            <span class="badge-alert">Shorts</span>
            <h1>Videos cortos</h1>
            <p class="muted">Contenido rápido de la comunidad</p>
          </div>
          ${user ? `
            <div class="short-upload-box">
              <div class="short-upload-avatar">${avatarHtml}</div>
              <div class="short-upload-form" id="shortUploadForm">
                <input type="text" id="shortTitleInput" placeholder="Título del short..." maxlength="60" />
                <input type="text" id="shortDescInput" placeholder="Descripción (opcional)" maxlength="200" />
                <div class="short-upload-actions">
                  <label class="ghost-btn short-media-btn">
                    📷 Subir imagen
                    <input type="file" accept="image/*" hidden id="shortImageInput" />
                  </label>
                  <label class="ghost-btn short-media-btn">
                    🎬 Subir video
                    <input type="file" accept="video/mp4,video/webm" hidden id="shortVideoInput" />
                  </label>
                  <button class="warning-btn" id="shortPublishBtn" disabled>Publicar</button>
                </div>
                <div id="shortPreview" class="short-preview hidden"></div>
              </div>
            </div>
          ` : ""}
          <div class="shorts-feed" id="shortsFeed">
            ${all.length === 0 ? `
              <div class="shorts-empty">
                <span class="shorts-empty-icon">🎬</span>
                <h3>Todavía no hay shorts</h3>
                <p>Sé el primero en compartir un video corto</p>
              </div>
            ` : all.map(s => renderCard(s)).join("")}
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
    const publishBtn = document.getElementById("shortPublishBtn");
    const preview = document.getElementById("shortPreview");
    let selectedFile = null;
    let selectedType = "";

    function updatePublishBtn() {
      if (publishBtn) {
        publishBtn.disabled = !selectedFile || !titleInput?.value.trim();
      }
    }

    imageInput?.addEventListener("change", () => {
      const file = imageInput.files?.[0];
      if (file) {
        selectedFile = file;
        selectedType = "image";
        videoInput.value = "";
        showPreview(URL.createObjectURL(file), "image");
        updatePublishBtn();
      }
    });

    videoInput?.addEventListener("change", () => {
      const file = videoInput.files?.[0];
      if (!file) return;
      if (file.size > MAX_VIDEO_BYTES) {
        UI.toast("El video no puede superar 25 MB.", "warning");
        videoInput.value = "";
        return;
      }
      selectedFile = file;
      selectedType = "video";
      imageInput.value = "";
      showPreview(URL.createObjectURL(file), "video");
      updatePublishBtn();
    });

    titleInput?.addEventListener("input", updatePublishBtn);

    function showPreview(url, type) {
      if (!preview) return;
      preview.classList.remove("hidden");
      preview.innerHTML = type === "video"
        ? `<video src="${url}" controls muted loop class="short-preview-media"></video>
           <button class="mini-btn" id="shortRemoveMedia">Quitar</button>`
        : `<img src="${url}" class="short-preview-media" />
           <button class="mini-btn" id="shortRemoveMedia">Quitar</button>`;
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
        let mediaType = selectedType;
        if (Api.hasConfiguredApiUrl()) {
          const content = await readFileAsBase64(selectedFile);
          const uploaded = await Api.apiUploadMedia(Auth.token(), {
            name: selectedFile.name,
            mimeType: selectedFile.type,
            mediaType: selectedType,
            size: selectedFile.size,
            content
          });
          mediaUrl = uploaded.mediaUrl;
        } else {
          mediaUrl = await readFileAsDataUrl(selectedFile);
        }
        const short = addShort({
          title: titleInput.value.trim(),
          description: document.getElementById("shortDescInput")?.value.trim() || "",
          mediaUrl,
          mediaType
        });
        if (short) {
          UI.toast("Short publicado.", "success");
          selectedFile = null;
          selectedType = "";
          if (imageInput) imageInput.value = "";
          if (videoInput) videoInput.value = "";
          if (titleInput) titleInput.value = "";
          const descInput = document.getElementById("shortDescInput");
          if (descInput) descInput.value = "";
          if (preview) preview.classList.add("hidden");
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

    document.querySelectorAll("[data-short-react]").forEach(btn => {
      btn.addEventListener("click", () => {
        const card = btn.closest("[data-short-id]");
        if (!card) return;
        const shortId = card.dataset.shortId;
        react(shortId, "like");
        const all = getAll();
        const short = all.find(s => s.id === shortId);
        if (short) {
          const user = Auth.user();
          const userId = user?.userId || user?.username || "";
          const isActive = short.reactions?.[userId] === "like";
          btn.classList.toggle("active", isActive);
          btn.innerHTML = isActive ? "👍 Te gusta" : "👍 Me gusta";
        }
      });
    });

    document.querySelectorAll("[data-short-comment]").forEach(btn => {
      btn.addEventListener("click", () => {
        const card = btn.closest("[data-short-id]");
        if (!card) return;
        UI.toast("Comentarios en shorts próximamente.", "info");
      });
    });

    document.querySelectorAll("[data-short-share]").forEach(btn => {
      btn.addEventListener("click", () => {
        const url = `${location.origin}${location.pathname}#/shorts`;
        if (navigator.share) {
          navigator.share({ title: "Mira este short en Bogotá Alerta Urbana", url }).catch(() => {});
        } else {
          navigator.clipboard.writeText(url).then(() => UI.toast("Enlace copiado.", "success")).catch(() => {});
        }
      });
    });

    document.querySelectorAll("[data-short-play]").forEach(wrap => {
      const video = wrap.querySelector("video");
      if (!video) return;
      wrap.addEventListener("click", () => {
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
