const Posts = (() => {
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
  let selectedMediaFile = null;
  let selectedMediaType = "none";

  function parseTags(value = "") {
    if (Array.isArray(value)) return value;
    return String(value)
      .split(/[,#]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  function isValidMediaUrl(url) {
    const value = String(url || "").trim();
    if (!value) return false;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:";
    } catch (error) {
      return false;
    }
  }

  function normalizeMediaType(post) {
    const type = String(post.mediaType || "").trim().toLowerCase();
    if (["image", "video", "none"].includes(type)) return type;
    if (!post.mediaUrl) return "none";
    return "none";
  }

  function driveFileIdFromUrl(url) {
    const value = String(url || "").trim();
    const idParam = value.match(/[?&]id=([^&]+)/i);
    if (idParam) return decodeURIComponent(idParam[1]);
    const pathId = value.match(/\/file\/d\/([^/]+)/i);
    if (pathId) return decodeURIComponent(pathId[1]);
    return "";
  }

  function displayMediaUrl(url, mediaType) {
    const value = String(url || "").trim();
    const driveId = driveFileIdFromUrl(value);
    if (driveId && mediaType === "image") {
      return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1600`;
    }
    return value;
  }

  function sanitizePostData(post = {}) {
    return {
      ...post,
      postId: String(post.postId || ""),
      username: String(post.username || "usuario"),
      category: String(post.category || "Otro"),
      title: String(post.title || ""),
      description: String(post.description || ""),
      location: String(post.location || "Zona no especificada"),
      mediaUrl: String(post.mediaUrl || "").trim(),
      mediaType: normalizeMediaType(post),
      tags: post.tags || "",
      status: String(post.status || "active"),
      reactionCount: Number(post.reactionCount || 0),
      commentCount: Number(post.commentCount || 0),
      reportCount: Number(post.reportCount || 0)
    };
  }

  function renderMedia(rawPost) {
    const post = sanitizePostData(rawPost);

    if (!post.mediaUrl || post.mediaType === "none") {
      return `<div class="no-media">Sin contenido multimedia</div>`;
    }

    if (!isValidMediaUrl(post.mediaUrl)) {
      return `<div class="no-media">Multimedia no disponible</div>`;
    }

    const safeUrl = UI.escapeHTML(displayMediaUrl(post.mediaUrl, post.mediaType));
    if (post.mediaType === "image") {
      return `
        <div class="post-media-wrap">
          <img class="post-media" src="${safeUrl}" alt="Imagen de la publicacion" loading="lazy" referrerpolicy="no-referrer" />
        </div>
      `;
    }

    if (post.mediaType === "video") {
      return `
        <div class="post-media-wrap">
          <video class="post-media" controls preload="metadata">
            <source src="${safeUrl}">
            Tu navegador no soporta video HTML5.
          </video>
        </div>
      `;
    }

    return `<div class="no-media">Multimedia no disponible</div>`;
  }

  function card(rawPost, compact = false) {
    const post = sanitizePostData(rawPost);
    const tags = parseTags(post.tags);
    const safePostId = UI.escapeHTML(post.postId);
    const isAdminControls = Auth.isAdminOrModerator() ? `
      <div class="admin-inline-controls">
        <span class="status-badge status-${UI.escapeHTML(post.status)}">Moderacion</span>
        <button class="mini-btn" data-admin-status="hidden" data-post-id="${safePostId}">Ocultar</button>
        <button class="mini-btn danger" data-admin-remove-post="${safePostId}">Remover</button>
        <button class="mini-btn" data-admin-status="reviewed" data-post-id="${safePostId}">Revisada</button>
        <a class="mini-btn" href="#/admin">Ver reportes</a>
      </div>
    ` : "";

    return `
      <article class="post-card" data-post-id="${safePostId}">
        <div class="post-head">
          <div>
            <strong>@${UI.escapeHTML(post.username)}</strong>
            <span class="muted">${UI.formatDate(post.createdAt)}</span>
          </div>
          <span class="category-pill ${categoryClass(post.category)}">${UI.escapeHTML(post.category)}</span>
        </div>
        <a href="#/post/${encodeURIComponent(post.postId)}" class="post-title">${UI.escapeHTML(post.title)}</a>
        <p class="post-description">${UI.escapeHTML(post.description)}</p>
        <div class="post-location">Ubicacion: ${UI.escapeHTML(post.location)}</div>
        ${compact ? "" : renderMedia(post)}
        <div class="tag-row">${UI.chips(tags)}</div>
        <div class="post-status-row">
          <span>Estado: <strong>${UI.escapeHTML(post.status)}</strong></span>
          <span>${post.reactionCount} reacciones</span>
          <span>${post.commentCount} comentarios</span>
          <span>${post.reportCount} reportes</span>
        </div>
        <div class="post-actions">
          ${Reactions.renderButtons("post", post.postId)}
          <button class="action-btn" data-comment-open="${safePostId}">Comentar</button>
          <button class="action-btn" data-share-post="${safePostId}">Compartir</button>
          <button class="action-btn danger" data-report-target="post" data-target-id="${safePostId}">Reportar</button>
        </div>
        ${isAdminControls}
      </article>
    `;
  }

  function categoryClass(category = "") {
    return `cat-${String(category).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}`;
  }

  function bindCreatePost() {
    const form = document.getElementById("createPostForm");
    if (!form) return;
    selectedMediaFile = null;
    selectedMediaType = "none";

    fillSelect(form.category, APP_CONFIG.categories, "Selecciona categoria");
    fillSelect(form.location, APP_CONFIG.localities, "Selecciona localidad o zona");
    bindMediaUpload(form);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!UI.requireSession()) return;
      const button = form.querySelector("button[type='submit']");
      const data = {
        title: form.title.value.trim(),
        description: form.description.value.trim(),
        category: form.category.value,
        location: form.location.value,
        mediaUrl: "",
        mediaType: "none",
        tags: parseTags(form.tags.value).join(", "),
        status: APP_CONFIG.postsDefaultStatus
      };

      if (!form.contentSafety.checked) {
        return UI.toast("Debes confirmar que el contenido cumple las reglas criticas.", "warning");
      }

      const validation = Moderation.validatePostContent(data);
      data.moderationFlags = validation.flags;
      if (!validation.allowed) {
        return UI.toast(validation.message, "error");
      }

      try {
        UI.showBusy("Estamos cargando tu publicacion, espera...");
        UI.setLoading(button, true, "Publicando...");
        if (selectedMediaFile) {
          UI.showBusy("Estamos subiendo tu foto o video, espera...");
          UI.setLoading(button, true, "Subiendo multimedia...");
          const uploaded = await uploadSelectedMedia();
          data.mediaUrl = uploaded.mediaUrl;
          data.mediaType = uploaded.mediaType;
          UI.hideBusy();
        }
        UI.showBusy("Estamos guardando tu publicacion, espera...");
        UI.setLoading(button, true, "Guardando...");
        await Api.apiCreatePost(Auth.token(), data);
        UI.toast(APP_CONFIG.postsDefaultStatus === "pending" ? "Publicacion enviada a revision." : "Publicacion creada.", "success");
        location.hash = "#/feed";
      } catch (error) {
        const message = String(error.message || "");
        if (message.includes("uploadMedia") && message.includes("no soportada")) {
          UI.toast("Falta actualizar el despliegue de Apps Script. Vuelve a desplegar el Web App con el Code.gs nuevo.", "error");
        } else {
          UI.toast(message, "error");
        }
      } finally {
        UI.setLoading(button, false);
        UI.hideBusy();
        UI.hideBusy();
        UI.hideBusy();
      }
    });
  }

  function bindMediaUpload(form) {
    const input = form.querySelector("#mediaFileInput");
    const preview = form.querySelector("#mediaUploadPreview");
    const clearButton = form.querySelector("#clearMediaBtn");
    if (!input || !preview || !clearButton) return;

    form.querySelectorAll("[data-pick-media]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedMediaType = button.dataset.pickMedia;
        input.accept = selectedMediaType === "image" ? "image/*" : "video/*";
        input.click();
      });
    });

    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return clearSelectedMedia(input, preview, clearButton);

      const inferredType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "none";
      if (inferredType === "none") {
        clearSelectedMedia(input, preview, clearButton);
        return UI.toast("Solo puedes subir imagenes o videos.", "error");
      }

      const maxBytes = inferredType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
      if (file.size > maxBytes) {
        clearSelectedMedia(input, preview, clearButton);
        return UI.toast(inferredType === "image" ? "La foto no puede superar 8 MB." : "El video no puede superar 25 MB.", "error");
      }

      selectedMediaFile = file;
      selectedMediaType = inferredType;
      clearButton.classList.remove("hidden");
      renderMediaPreview(preview, file, inferredType);
    });

    clearButton.addEventListener("click", () => clearSelectedMedia(input, preview, clearButton));
  }

  function renderMediaPreview(preview, file, mediaType) {
    const objectUrl = URL.createObjectURL(file);
    const safeName = UI.escapeHTML(file.name);
    if (mediaType === "image") {
      preview.innerHTML = `
        <img src="${objectUrl}" alt="Vista previa de la foto seleccionada" />
        <span>${safeName}</span>
      `;
      return;
    }

    preview.innerHTML = `
      <video controls preload="metadata" src="${objectUrl}"></video>
      <span>${safeName}</span>
    `;
  }

  function clearSelectedMedia(input, preview, clearButton) {
    selectedMediaFile = null;
    selectedMediaType = "none";
    input.value = "";
    clearButton.classList.add("hidden");
    preview.textContent = "Sin contenido multimedia";
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () => reject(new Error("No se pudo leer el archivo multimedia."));
      reader.readAsDataURL(file);
    });
  }

  async function uploadSelectedMedia() {
    const content = await readFileAsBase64(selectedMediaFile);
    return Api.apiUploadMedia(Auth.token(), {
      name: selectedMediaFile.name,
      mimeType: selectedMediaFile.type,
      size: selectedMediaFile.size,
      mediaType: selectedMediaType,
      content
    });
  }

  function fillSelect(select, items, placeholder) {
    if (!select) return;
    select.innerHTML = `<option value="">${UI.escapeHTML(placeholder)}</option>` + items.map((item) => `<option value="${UI.escapeHTML(item)}">${UI.escapeHTML(item)}</option>`).join("");
  }

  function bindReportButtons(root = document) {
    root.querySelectorAll("[data-report-target]").forEach((button) => {
      button.addEventListener("click", () => openReportModal(button.dataset.reportTarget, button.dataset.targetId));
    });
  }

  function openReportModal(targetType, targetId) {
    if (!UI.requireSession()) return;
    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <section class="modal-card">
        <h2>Reportar contenido</h2>
        <p class="muted">Selecciona el motivo. Los reportes se guardan para revision.</p>
        <label>Motivo</label>
        <select id="reportReason">${APP_CONFIG.reportReasons.map((reason) => `<option value="${UI.escapeHTML(reason)}">${UI.escapeHTML(reason)}</option>`).join("")}</select>
        <label>Detalles opcionales</label>
        <textarea id="reportDetails" rows="4" placeholder="Explica brevemente el problema, sin publicar datos personales."></textarea>
        <div class="modal-actions">
          <button class="ghost-btn" id="cancelReport">Cancelar</button>
          <button class="warning-btn" id="sendReport">Enviar reporte</button>
        </div>
      </section>
    `;
    document.body.appendChild(modal);
    modal.querySelector("#cancelReport").addEventListener("click", () => modal.remove());
    modal.querySelector("#sendReport").addEventListener("click", async () => {
      try {
        await Api.apiReport(Auth.token(), targetType, targetId, modal.querySelector("#reportReason").value, modal.querySelector("#reportDetails").value.trim());
        UI.toast("Reporte enviado.", "success");
        modal.remove();
      } catch (error) {
        UI.toast(error.message, "error");
      }
    });
  }

  function bindShareButtons(root = document) {
    root.querySelectorAll("[data-share-post]").forEach((button) => {
      button.addEventListener("click", async () => {
        const url = `${location.origin}${location.pathname}#/post/${button.dataset.sharePost}`;
        try {
          await navigator.clipboard.writeText(url);
          UI.toast("Enlace copiado.", "success");
        } catch {
          UI.toast("No se pudo copiar. Copia la URL desde la barra del navegador.", "warning");
        }
      });
    });
  }

  async function bindAdminInline(root = document) {
    root.querySelectorAll("[data-admin-status]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!Auth.isAdminOrModerator()) return;
        try {
          if (button.dataset.adminStatus === "hidden" && typeof Admin !== "undefined" && Admin.hidePost) {
            await Admin.hidePost(button.dataset.postId);
            return;
          }
          await Api.apiAdminUpdatePostStatus(Auth.token(), button.dataset.postId, button.dataset.adminStatus);
          UI.toast("Publicacion actualizada.", "success");
          Router.reload();
        } catch (error) {
          UI.toast(error.message, "error");
        }
      });
    });
    root.querySelectorAll("[data-admin-remove-post]").forEach((button) => {
      button.addEventListener("click", () => {
        if (!Auth.isAdminOrModerator()) return;
        if (typeof Admin !== "undefined" && Admin.removePost) Admin.removePost(button.dataset.adminRemovePost);
      });
    });
  }

  return {
    card,
    renderMedia,
    sanitizePostData,
    isValidMediaUrl,
    bindCreatePost,
    bindReportButtons,
    bindShareButtons,
    bindAdminInline,
    parseTags
  };
})();
