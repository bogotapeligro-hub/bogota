const Posts = (() => {
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
  const MAX_IMAGE_FILES = 5;
  const MAX_VIDEO_FILES = 1;
  const MAX_VIDEO_SECONDS = 60;
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
  let selectedMediaFiles = [];
  let selectedMediaType = "none";

  function parseTags(value = "") {
    if (Array.isArray(value)) return value;
    return String(value).split(/[,#]/).map(tag => tag.trim()).filter(Boolean).slice(0, 8);
  }

  function parseBoolean(value) {
    return value === true || value === "true" || value === "1" || value === 1 || value === "si" || value === "yes";
  }

  function isSensitiveCategory(category = "") {
    return (APP_CONFIG.sensitiveCategories || []).includes(String(category || ""));
  }

  function inferSensitive(post = {}) {
    if (parseBoolean(post.isSensitive) || parseBoolean(post.sensitive)) return true;
    if (isSensitiveCategory(post.category)) return true;
    const text = [post.title, post.description, post.tags, post.category].join(" ").toLowerCase();
    return /(pelea|agresion|herid|sangre|accidente|choque|arma|violencia|fuerte|sensible)/i.test(text);
  }

  function postMetaKey(postId, suffix) {
    return `bau_post_${suffix}_${postId}`;
  }

  function getLocalCount(postId, suffix) {
    try { return Number(localStorage.getItem(postMetaKey(postId, suffix)) || 0); }
    catch { return 0; }
  }

  function incrementLocalCount(postId, suffix) {
    const next = getLocalCount(postId, suffix) + 1;
    localStorage.setItem(postMetaKey(postId, suffix), String(next));
    return next;
  }

  function isValidMediaUrl(url) {
    const value = String(url || "").trim();
    if (!value) return false;
    if (value.startsWith("data:")) return true;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  function normalizeMediaType(post) {
    const type = String(post.mediaType || "").trim().toLowerCase();
    if (["image", "video", "mixed", "none"].includes(type)) return type;
    if (!post.mediaUrl) return "none";
    return "none";
  }

  function parseMediaItems(mediaUrl, mediaType = "none") {
    const value = String(mediaUrl || "").trim();
    if (!value) return [];
    if (value.startsWith("[")) {
      try {
        return JSON.parse(value)
          .filter(item => item && isValidMediaUrl(item.url) && ["image", "video"].includes(String(item.type || "").toLowerCase()))
          .slice(0, MAX_IMAGE_FILES + MAX_VIDEO_FILES)
          .map(item => ({
            url: String(item.url || "").trim(),
            type: String(item.type || "").trim().toLowerCase(),
            name: String(item.name || "").trim()
          }));
      } catch {
        return [];
      }
    }
    const type = String(mediaType || "").trim().toLowerCase();
    if (!["image", "video"].includes(type) || !isValidMediaUrl(value)) return [];
    return [{ url: value, type, name: "" }];
  }

  function mediaTypeFromItems(items) {
    const hasImage = items.some(item => item.type === "image");
    const hasVideo = items.some(item => item.type === "video");
    if (hasImage && hasVideo) return "mixed";
    if (hasImage) return "image";
    if (hasVideo) return "video";
    return "none";
  }

  function isValidMediaPayload(mediaUrl, mediaType = "none") {
    if (!mediaUrl) return true;
    return parseMediaItems(mediaUrl, mediaType).length > 0;
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
    const postId = String(post.postId || "");
    const normalized = {
      ...post,
      postId,
      username: String(post.username || "usuario"),
      category: String(post.category || "Otro"),
      title: String(post.title || ""),
      description: String(post.description || ""),
      location: String(post.location || "Zona no especificada"),
      mediaUrl: String(post.mediaUrl || "").trim(),
      mediaType: normalizeMediaType(post),
      mediaItems: parseMediaItems(post.mediaUrl, post.mediaType),
      tags: post.tags || "",
      status: String(post.status || "active"),
      reactionCount: Number(post.reactionCount || 0),
      commentCount: Number(post.commentCount || 0),
      reportCount: Number(post.reportCount || 0),
      userId: String(post.userId || post.username || ""),
      blurFaces: parseBoolean(post.blurFaces),
      anonymous: parseBoolean(post.anonymous),
      alertLevel: String(post.alertLevel || ""),
      source: String(post.source || ""),
      verificationStatus: String(post.verificationStatus || "pending"),
      confirmCount: Number(post.confirmCount || getLocalCount(postId, "confirm")),
      doubtCount: Number(post.doubtCount || getLocalCount(postId, "doubt")),
      viewCount: Number(post.viewCount || getLocalCount(postId, "views"))
    };
    normalized.isSensitive = inferSensitive(normalized);
    return normalized;
  }

  function renderMedia(rawPost) {
    const post = sanitizePostData(rawPost);
    const items = post.mediaItems || [];
    if (!items.length || post.mediaType === "none") {
      return `<div class="no-media">Sin contenido multimedia</div>`;
    }
    const warning = post.isSensitive ? `
      <div class="sensitive-warning" data-sensitive-warning>
        <span class="sensitive-pill">Contenido sensible</span>
        <strong>Este contenido puede contener violencia o imagenes sensibles.</strong>
        <p>Ver bajo responsabilidad. No se reproduce automaticamente.</p>
        <div class="sensitive-actions">
          <button class="warning-btn" type="button" data-reveal-sensitive>Ver contenido</button>
          <button class="ghost-btn" type="button" data-hide-sensitive>Ocultar</button>
        </div>
      </div>
    ` : "";
    return `
      <div class="post-media-shell ${post.isSensitive ? "is-sensitive locked" : ""}">
        <div class="post-media-grid ${items.length === 1 ? "single-media" : ""}">
          ${items.map((item, index) => renderMediaItem(item, index)).join("")}
        </div>
        ${warning}
      </div>
    `;
  }

  function renderMediaItem(item, index) {
    const safeUrl = UI.escapeHTML(displayMediaUrl(item.url, item.type));
    const safeName = UI.escapeHTML(item.name || `Multimedia ${index + 1}`);
    if (item.type === "image") {
      return `<div class="post-media-wrap"><img class="post-media" src="${safeUrl}" alt="${safeName}" loading="lazy" referrerpolicy="no-referrer" /></div>`;
    }
    return `
      <div class="post-media-wrap">
        <video class="post-media" controls preload="metadata">
          <source src="${safeUrl}">
          Tu navegador no soporta video HTML5.
        </video>
      </div>
    `;
  }

  function card(rawPost, compact = false) {
    const post = sanitizePostData(rawPost);
    if (post.postId) incrementLocalCount(post.postId, "views");
    if (typeof Chat !== "undefined") Chat.rememberUser?.(post);
    const tags = parseTags(post.tags);
    const safePostId = UI.escapeHTML(post.postId);
    const publicUsername = post.anonymous ? "vecino_anonimo" : (post.username || "usuario");
    const safeUser = UI.escapeHTML(publicUsername);
    const avatarHtml = typeof Profile !== "undefined" ? Profile.renderAvatar(publicUsername, 36) : "";
    const savedPosts = JSON.parse(localStorage.getItem("bau_saved_posts") || "[]");
    const isSaved = savedPosts.includes(post.postId);
    const verified = post.confirmCount >= 3 && post.confirmCount > post.doubtCount;
    const verificationLabel = verified ? "Verificado por comunidad" : (post.doubtCount > post.confirmCount ? "Informacion dudosa" : "Pendiente de verificar");
    const verificationClass = verified ? "verified" : (post.doubtCount > post.confirmCount ? "doubtful" : "pending");
    const reportWarning = post.reportCount >= 3 ? `<div class="review-warning">Este contenido tiene varios reportes y queda pendiente de revision.</div>` : "";
    const profileTarget = post.anonymous ? "anonimo" : (post.userId || post.username || publicUsername);
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
      <article class="post-card post-card-openable ${post.isSensitive ? "post-sensitive" : ""}" data-post-id="${safePostId}" data-open-post="${safePostId}" tabindex="0" role="button" aria-label="Abrir publicacion ${UI.escapeHTML(post.title)}">
        <div class="post-head">
          <div class="post-head-left">
            <a class="post-avatar-link" href="#/profile/${encodeURIComponent(profileTarget)}">${avatarHtml}</a>
            <div>
              <a class="user-link" href="#/profile/${encodeURIComponent(profileTarget)}" data-user-link>@${safeUser}</a>
              <span class="muted">${UI.formatDate(post.createdAt)}</span>
            </div>
          </div>
          <div class="post-badges">
            <span class="category-pill ${categoryClass(post.category)}">${UI.escapeHTML(post.category)}</span>
            ${post.isSensitive ? `<span class="sensitive-mini">Contenido sensible</span>` : ""}
            ${post.alertLevel ? `<span class="alert-level level-${UI.escapeHTML(post.alertLevel.toLowerCase())}">${UI.escapeHTML(post.alertLevel)}</span>` : ""}
          </div>
        </div>
        <a href="#/post/${encodeURIComponent(post.postId)}" class="post-title">${UI.escapeHTML(post.title)}</a>
        <p class="post-description">${UI.escapeHTML(post.description)}</p>
        <div class="post-location">Zona aproximada: ${UI.escapeHTML(post.location)}</div>
        ${post.source ? `<div class="post-source">Fuente/contexto: ${UI.escapeHTML(post.source)}</div>` : ""}
        ${post.blurFaces ? `<div class="privacy-note">Requiere difuminar rostros o datos visibles.</div>` : ""}
        ${compact ? "" : renderMedia(post)}
        <div class="tag-row">${UI.chips(tags)}</div>
        <div class="post-status-row">
          <span class="verification-badge ${verificationClass}">${verificationLabel}</span>
          <span>${post.viewCount + 1} vistas</span>
          <span>${post.reactionCount} reacciones</span>
          <span>${post.commentCount} comentarios</span>
          <span>${post.reportCount} reportes</span>
        </div>
        ${reportWarning}
        <div class="post-actions">
          ${Reactions.renderButtons("post", post.postId)}
          <button class="action-btn" data-comment-open="${safePostId}">Comentar</button>
          <button class="action-btn" data-confirm-post="${safePostId}">Confirmo (${post.confirmCount})</button>
          <button class="action-btn" data-doubt-post="${safePostId}">Dudosa (${post.doubtCount})</button>
          <button class="action-btn action-save" data-save-post="${safePostId}" data-saved="${isSaved ? "1" : "0"}">${isSaved ? "Guardado" : "Guardar"}</button>
          <button class="action-btn action-share" data-share-post="${safePostId}">Compartir</button>
          <button class="action-btn" data-chat-share-post="${safePostId}">Enviar por chat</button>
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
    selectedMediaFiles = [];
    selectedMediaType = "none";
    fillSelect(form.category, APP_CONFIG.categories, "Selecciona categoria");
    fillSelect(form.location, APP_CONFIG.localities, "Selecciona localidad o zona");
    bindMediaUpload(form);
    form.category?.addEventListener("change", () => {
      if (form.isSensitive && isSensitiveCategory(form.category.value)) form.isSensitive.checked = true;
    });

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
        status: APP_CONFIG.postsDefaultStatus,
        isSensitive: Boolean(form.isSensitive?.checked) || isSensitiveCategory(form.category.value),
        blurFaces: Boolean(form.blurFaces?.checked),
        anonymous: Boolean(form.anonymous?.checked),
        alertLevel: form.alertLevel?.value || "",
        source: form.source?.value.trim() || "",
        verificationStatus: "pending"
      };

      if (!form.contentSafety.checked) {
        return UI.toast("Debes confirmar que el contenido cumple las reglas criticas.", "warning");
      }

      const validation = Moderation.validatePostContent(data);
      data.moderationFlags = validation.flags;
      if (!validation.allowed) return UI.toast(validation.message, "error");

      try {
        UI.showBusy("Estamos cargando tu publicacion, espera...");
        UI.setLoading(button, true, "Publicando...");
        if (selectedMediaFiles.length) {
          UI.showBusy("Estamos subiendo tu multimedia, espera...");
          UI.setLoading(button, true, "Subiendo multimedia...");
          const uploaded = await uploadSelectedMedia();
          data.mediaUrl = JSON.stringify(uploaded.map(item => ({
            url: item.mediaUrl,
            type: item.mediaType,
            name: item.name || ""
          })));
          data.mediaType = mediaTypeFromItems(uploaded.map(item => ({ type: item.mediaType })));
          UI.hideBusy();
        }
        UI.showBusy("Estamos guardando tu publicacion, espera...");
        UI.setLoading(button, true, "Guardando...");
        await Api.apiCreatePost(Auth.token(), data);
        if (typeof Profile !== "undefined") Profile.trackPostCreated?.();
        if (typeof Notifications !== "undefined") {
          Notifications.add("post", "Publicacion creada", data.isSensitive ? "Tu reporte sensible quedo protegido con advertencia." : "Tu reporte ya esta en la plataforma.", "#/feed", "!");
        }
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
    renderSelectedMediaPreview(preview, input, clearButton);
    form.querySelectorAll("[data-pick-media]").forEach(button => {
      button.addEventListener("click", () => {
        selectedMediaType = button.dataset.pickMedia;
        input.accept = selectedMediaType === "image" ? "image/*" : "video/*";
        input.multiple = selectedMediaType === "image";
        input.click();
      });
    });
    input.addEventListener("change", async () => {
      const files = Array.from(input.files || []);
      input.value = "";
      if (!files.length) return;
      await addSelectedMedia(files, preview, input, clearButton);
    });
    clearButton.addEventListener("click", () => clearSelectedMedia(input, preview, clearButton));
    preview.addEventListener("click", event => {
      const button = event.target.closest("[data-remove-media-index]");
      if (button) removeSelectedMedia(Number(button.dataset.removeMediaIndex), input, preview, clearButton);
    });
  }

  async function addSelectedMedia(files, preview, input, clearButton) {
    for (const file of files) {
      const inferredType = inferMediaType(file);
      const validation = await validateSelectedFile(file, inferredType);
      if (!validation.allowed) {
        UI.toast(validation.message, "warning");
        continue;
      }
      selectedMediaFiles.push({ file, mediaType: inferredType, previewUrl: URL.createObjectURL(file), duration: validation.duration || 0 });
    }
    renderSelectedMediaPreview(preview, input, clearButton);
  }

  function inferMediaType(file) {
    if (ALLOWED_IMAGE_TYPES.includes(file.type) || file.type.startsWith("image/")) return "image";
    if (ALLOWED_VIDEO_TYPES.includes(file.type) || file.type.startsWith("video/")) return "video";
    return "none";
  }

  async function validateSelectedFile(file, mediaType) {
    if (mediaType === "none") return { allowed: false, message: "Solo puedes subir imagenes o videos validos." };
    const imageCount = selectedMediaFiles.filter(item => item.mediaType === "image").length;
    const videoCount = selectedMediaFiles.filter(item => item.mediaType === "video").length;
    if (mediaType === "image") {
      if (imageCount >= MAX_IMAGE_FILES) return { allowed: false, message: "Solo puedes subir maximo 5 fotos." };
      if (file.size > MAX_IMAGE_BYTES) return { allowed: false, message: "Cada foto no puede superar 8 MB." };
      return { allowed: true };
    }
    if (videoCount >= MAX_VIDEO_FILES) return { allowed: false, message: "Solo puedes subir 1 video por publicacion." };
    if (file.size > MAX_VIDEO_BYTES) return { allowed: false, message: "El video no puede superar 25 MB." };
    const duration = await getVideoDuration(file);
    if (duration > MAX_VIDEO_SECONDS) return { allowed: false, message: "El video no puede durar mas de 1 minuto." };
    return { allowed: true, duration };
  }

  function getVideoDuration(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const url = URL.createObjectURL(file);
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const duration = Number(video.duration || 0);
        URL.revokeObjectURL(url);
        resolve(duration);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo leer la duracion del video."));
      };
      video.src = url;
    }).catch(error => {
      UI.toast(error.message, "error");
      return MAX_VIDEO_SECONDS + 1;
    });
  }

  function renderSelectedMediaPreview(preview, input, clearButton) {
    if (!selectedMediaFiles.length) {
      preview.classList.remove("has-media");
      clearButton.classList.add("hidden");
      preview.textContent = "Sin contenido multimedia";
      return;
    }
    preview.classList.add("has-media");
    clearButton.classList.remove("hidden");
    preview.innerHTML = selectedMediaFiles.map((item, index) => {
      const safeName = UI.escapeHTML(item.file.name);
      const duration = item.mediaType === "video" && item.duration ? `<span class="media-duration">${formatDuration(item.duration)}</span>` : "";
      const media = item.mediaType === "image"
        ? `<img src="${item.previewUrl}" alt="Vista previa de ${safeName}" />`
        : `<video controls preload="metadata" src="${item.previewUrl}"></video>`;
      return `
        <article class="media-preview-card">
          ${media}
          <button class="media-remove-btn" type="button" data-remove-media-index="${index}" aria-label="Eliminar ${safeName}">Quitar</button>
          <span class="media-preview-name">${safeName}</span>
          ${duration}
        </article>
      `;
    }).join("");
    input.value = "";
  }

  function formatDuration(seconds) {
    const total = Math.ceil(Number(seconds) || 0);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  function removeSelectedMedia(index, input, preview, clearButton) {
    const [removed] = selectedMediaFiles.splice(index, 1);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    renderSelectedMediaPreview(preview, input, clearButton);
  }

  function clearSelectedMedia(input, preview, clearButton) {
    selectedMediaFiles.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    selectedMediaFiles = [];
    selectedMediaType = "none";
    input.value = "";
    clearButton.classList.add("hidden");
    preview.classList.remove("has-media");
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
    const uploaded = [];
    for (const item of selectedMediaFiles) {
      const content = await readFileAsBase64(item.file);
      uploaded.push(await Api.apiUploadMedia(Auth.token(), {
        name: item.file.name,
        mimeType: item.file.type,
        size: item.file.size,
        mediaType: item.mediaType,
        content
      }));
    }
    return uploaded;
  }

  function fillSelect(select, items, placeholder) {
    if (!select) return;
    select.innerHTML = `<option value="">${UI.escapeHTML(placeholder)}</option>` + items.map(item => `<option value="${UI.escapeHTML(item)}">${UI.escapeHTML(item)}</option>`).join("");
  }

  function bindReportButtons(root = document) {
    root.querySelectorAll("[data-report-target]").forEach(button => {
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
        <p class="muted">Selecciona el motivo. Los reportes se guardan para revision y pueden ocultar temporalmente el contenido.</p>
        <label>Motivo</label>
        <select id="reportReason">${APP_CONFIG.reportReasons.map(reason => `<option value="${UI.escapeHTML(reason)}">${UI.escapeHTML(reason)}</option>`).join("")}</select>
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
        if (typeof Notifications !== "undefined") Notifications.add("moderation", "Reporte recibido", "El contenido quedo marcado para revision.", "#/admin", "!");
        UI.toast("Reporte enviado. Gracias por ayudar a moderar.", "success");
        modal.remove();
      } catch (error) {
        UI.toast(error.message, "error");
      }
    });
  }

  function bindShareButtons(root = document) {
    root.querySelectorAll("[data-share-post]").forEach(button => {
      button.addEventListener("click", async () => {
        const url = `${location.origin}${location.pathname}#/post/${button.dataset.sharePost}`;
        if (navigator.share) {
          try { await navigator.share({ title: APP_CONFIG.appName, url }); } catch {}
        } else {
          try {
            await navigator.clipboard.writeText(url);
            UI.toast("Enlace copiado.", "success");
          } catch {
            UI.toast("No se pudo copiar. Copia la URL desde la barra del navegador.", "warning");
          }
        }
      });
    });
  }

  function bindSaveButtons(root = document) {
    root.querySelectorAll("[data-save-post]").forEach(button => {
      button.addEventListener("click", () => {
        const postId = button.dataset.savePost;
        let saved = JSON.parse(localStorage.getItem("bau_saved_posts") || "[]");
        const idx = saved.indexOf(postId);
        if (idx > -1) {
          saved.splice(idx, 1);
          button.textContent = "Guardar";
          button.dataset.saved = "0";
          UI.toast("Publicacion removida de guardados.", "info");
        } else {
          saved.push(postId);
          button.textContent = "Guardado";
          button.dataset.saved = "1";
          UI.toast("Publicacion guardada.", "success");
        }
        localStorage.setItem("bau_saved_posts", JSON.stringify(saved));
      });
    });
  }

  function bindSensitiveMedia(root = document) {
    root.querySelectorAll("[data-reveal-sensitive]").forEach(button => {
      button.addEventListener("click", event => {
        event.target.closest(".post-media-shell")?.classList.remove("locked");
      });
    });
    root.querySelectorAll("[data-hide-sensitive]").forEach(button => {
      button.addEventListener("click", event => {
        const shell = event.target.closest(".post-media-shell");
        shell?.classList.add("locked");
        shell?.querySelectorAll("video").forEach(video => video.pause());
      });
    });
  }

  function bindVerificationButtons(root = document) {
    root.querySelectorAll("[data-confirm-post]").forEach(button => {
      button.addEventListener("click", () => {
        const total = incrementLocalCount(button.dataset.confirmPost, "confirm");
        button.textContent = `Confirmo (${total})`;
        UI.toast("Gracias. Tu confirmacion ayuda a dar contexto.", "success");
      });
    });
    root.querySelectorAll("[data-doubt-post]").forEach(button => {
      button.addEventListener("click", () => {
        const total = incrementLocalCount(button.dataset.doubtPost, "doubt");
        button.textContent = `Dudosa (${total})`;
        UI.toast("Marcado como informacion dudosa.", "warning");
      });
    });
  }

  function bindChatShareButtons(root = document) {
    root.querySelectorAll("[data-chat-share-post]").forEach(button => {
      button.addEventListener("click", () => {
        const url = `${location.origin}${location.pathname}#/post/${button.dataset.chatSharePost}`;
        try { sessionStorage.setItem("bau_pending_chat_share", url); } catch {}
        UI.toast("Abre un chat y pega el enlace del reporte.", "info");
        location.hash = "#/chat";
      });
    });
  }

  async function bindAdminInline(root = document) {
    root.querySelectorAll("[data-admin-status]").forEach(button => {
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
    root.querySelectorAll("[data-admin-remove-post]").forEach(button => {
      button.addEventListener("click", () => {
        if (Auth.isAdminOrModerator() && typeof Admin !== "undefined" && Admin.removePost) Admin.removePost(button.dataset.adminRemovePost);
      });
    });
  }

  return {
    card,
    renderMedia,
    sanitizePostData,
    isValidMediaUrl,
    isValidMediaPayload,
    bindCreatePost,
    bindReportButtons,
    bindShareButtons,
    bindSaveButtons,
    bindSensitiveMedia,
    bindVerificationButtons,
    bindChatShareButtons,
    bindAdminInline,
    parseTags
  };
})();
