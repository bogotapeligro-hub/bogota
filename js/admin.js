const Admin = (() => {
  const reasons = [
    "Menores involucrados",
    "Contenido sexual",
    "Violencia contra menores",
    "Datos personales",
    "Amenaza o incitacion",
    "Doxxing",
    "Contenido grafico",
    "Spam",
    "Otro"
  ];

  function checkAdminAccess() {
    return Auth.isAdminOrModerator();
  }

  function renderAdminBadge() {
    const label = document.getElementById("adminModeLabel");
    if (label) label.textContent = Auth.isAdmin() ? "Modo Admin" : "Modo Moderador";
    document.querySelectorAll(".admin-only").forEach((el) => el.classList.toggle("hidden", !Auth.isAdmin()));
  }

  async function initAdminPanel() {
    if (!checkAdminAccess()) {
      UI.renderApp(UI.emptyState("No tienes permisos para acceder a esta seccion.", "Esta vista esta reservada para administradores y moderadores.", `<a class="warning-btn inline-btn" href="#/feed">Volver al feed</a>`));
      return;
    }
    renderAdminBadge();
    document.querySelectorAll("[data-admin-refresh]").forEach((button) => button.addEventListener("click", () => initAdminPanel()));
    await Promise.all([loadAdminDashboard(), loadReportedPosts(), loadReportedComments(), loadReports()]);
    if (Auth.isAdmin()) await Promise.all([loadUsers(), loadAuditLog()]);
  }

  async function loadAdminDashboard() {
    const box = document.getElementById("adminStats");
    if (!box) return;
    box.innerHTML = UI.skeletonPosts(1);
    try {
      const result = await Api.apiAdminDashboard(Auth.token());
      renderAdminStats(result.stats || {});
    } catch (error) {
      box.innerHTML = `<p class="error-text">${UI.escapeHTML(error.message)}</p>`;
    }
  }

  async function loadReportedPosts() {
    const box = document.getElementById("reportedPosts");
    if (!box) return;
    box.innerHTML = UI.skeletonPosts(2);
    try {
      const result = await Api.apiAdminListReportedPosts(Auth.token());
      renderReportedPosts(result.posts || []);
    } catch (error) {
      box.innerHTML = `<p class="error-text">${UI.escapeHTML(error.message)}</p>`;
    }
  }

  async function loadReportedComments() {
    const box = document.getElementById("reportedComments");
    if (!box) return;
    box.innerHTML = UI.skeletonPosts(1);
    try {
      const result = await Api.apiAdminListReportedComments(Auth.token());
      renderReportedComments(result.comments || []);
    } catch (error) {
      box.innerHTML = `<p class="error-text">${UI.escapeHTML(error.message)}</p>`;
    }
  }

  async function loadReports() {
    const box = document.getElementById("reportsList");
    if (!box) return;
    box.innerHTML = UI.skeletonPosts(1);
    try {
      const result = await Api.apiAdminListReports(Auth.token());
      renderReports(result.reports || []);
    } catch (error) {
      box.innerHTML = `<p class="error-text">${UI.escapeHTML(error.message)}</p>`;
    }
  }

  async function loadUsers() {
    const box = document.getElementById("usersList");
    if (!box) return;
    box.innerHTML = UI.skeletonPosts(1);
    try {
      const result = await Api.apiAdminListUsers(Auth.token());
      renderUsers(result.users || []);
    } catch (error) {
      box.innerHTML = `<p class="error-text">${UI.escapeHTML(error.message)}</p>`;
    }
  }

  async function loadAuditLog() {
    const box = document.getElementById("auditLog");
    if (!box) return;
    box.innerHTML = UI.skeletonPosts(1);
    try {
      const result = await Api.apiAdminListAuditLog(Auth.token());
      renderAuditLog(result.logs || []);
    } catch (error) {
      box.innerHTML = `<p class="error-text">${UI.escapeHTML(error.message)}</p>`;
    }
  }

  function renderAdminStats(stats) {
    const box = document.getElementById("adminStats");
    if (!box) return;
    const cards = [
      ["Publicaciones", stats.totalPosts || 0],
      ["Posts reportados", stats.reportedPosts || 0],
      ["Comentarios reportados", stats.reportedComments || 0],
      ["Usuarios activos", stats.activeUsers || 0],
      ["Usuarios bloqueados", stats.blockedUsers || 0]
    ];
    box.innerHTML = cards.map(([label, value]) => `
      <article class="admin-stat-card">
        <span>${UI.escapeHTML(label)}</span>
        <strong>${Number(value || 0)}</strong>
      </article>
    `).join("");
  }

  function renderReportedPosts(posts) {
    const box = document.getElementById("reportedPosts");
    if (!box) return;
    box.innerHTML = posts.length ? posts.map((post) => `
      <article class="admin-item">
        <div class="admin-item-main">
          <span class="status-badge status-${UI.escapeHTML(post.status || "active")}">${UI.escapeHTML(post.status || "active")}</span>
          <h3>${UI.escapeHTML(post.title || "Sin titulo")}</h3>
          <p>${UI.escapeHTML(post.description || "").slice(0, 180)}</p>
          <div class="admin-meta">
            <span>@${UI.escapeHTML(post.username)}</span>
            <span>${UI.escapeHTML(post.category || "Otro")}</span>
            <span>${UI.formatDate(post.createdAt)}</span>
            <span>${Number(post.reportCount || 0)} reportes</span>
            <span>Motivo: ${UI.escapeHTML(post.mainReason || "Sin motivo principal")}</span>
          </div>
        </div>
        <div class="admin-actions">
          <a class="mini-btn" href="#/post/${encodeURIComponent(post.postId)}">Ver</a>
          <button class="mini-btn" data-admin-post-status="hidden" data-post-id="${UI.escapeHTML(post.postId)}">Ocultar</button>
          <button class="mini-btn danger" data-admin-post-remove="${UI.escapeHTML(post.postId)}">Remover</button>
          <button class="mini-btn" data-admin-post-restore="${UI.escapeHTML(post.postId)}">Restaurar</button>
          <button class="mini-btn" data-admin-post-status="reviewed" data-post-id="${UI.escapeHTML(post.postId)}">Revisado</button>
        </div>
      </article>
    `).join("") : `<p class="muted">No hay publicaciones reportadas o pendientes.</p>`;
    bindAdminActions(box);
  }

  function renderReportedComments(comments) {
    const box = document.getElementById("reportedComments");
    if (!box) return;
    box.innerHTML = comments.length ? comments.map((comment) => `
      <article class="admin-item">
        <div class="admin-item-main">
          <span class="status-badge status-${UI.escapeHTML(comment.status || "active")}">${UI.escapeHTML(comment.status || "active")}</span>
          <h3>@${UI.escapeHTML(comment.username)}</h3>
          <p>${UI.escapeHTML(comment.text || "")}</p>
          <div class="admin-meta">
            <span>Post: ${UI.escapeHTML(comment.postId)}</span>
            <span>${UI.formatDate(comment.createdAt)}</span>
            <span>${Number(comment.reportCount || 0)} reportes</span>
            <span>Motivo: ${UI.escapeHTML(comment.mainReason || "Sin motivo principal")}</span>
          </div>
        </div>
        <div class="admin-actions">
          <button class="mini-btn" data-admin-comment-status="hidden" data-comment-id="${UI.escapeHTML(comment.commentId)}">Ocultar</button>
          <button class="mini-btn danger" data-admin-comment-remove="${UI.escapeHTML(comment.commentId)}">Remover</button>
          <button class="mini-btn" data-admin-comment-restore="${UI.escapeHTML(comment.commentId)}">Restaurar</button>
          <button class="mini-btn" data-admin-comment-status="reviewed" data-comment-id="${UI.escapeHTML(comment.commentId)}">Revisado</button>
        </div>
      </article>
    `).join("") : `<p class="muted">No hay comentarios reportados.</p>`;
    bindAdminActions(box);
  }

  function renderReports(reports) {
    const box = document.getElementById("reportsList");
    if (!box) return;
    box.innerHTML = reports.length ? reports.map((report) => `
      <article class="admin-report-row">
        <div>
          <strong>${UI.escapeHTML(report.reason)}</strong>
          <p>${UI.escapeHTML(report.details || "Sin detalles")}</p>
          <small>${UI.escapeHTML(report.targetType)} ${UI.escapeHTML(report.targetId)} | usuario ${UI.escapeHTML(report.userId)} | ${UI.formatDate(report.createdAt)}</small>
        </div>
        <div class="admin-actions">
          <span class="status-badge status-${UI.escapeHTML(report.status || "open")}">${UI.escapeHTML(report.status || "open")}</span>
          <button class="mini-btn" data-admin-report-reviewed="${UI.escapeHTML(report.reportId)}">Marcar revisado</button>
        </div>
      </article>
    `).join("") : `<p class="muted">Sin reportes.</p>`;
    bindAdminActions(box);
  }

  function renderUsers(users) {
    const box = document.getElementById("usersList");
    if (!box) return;
    box.innerHTML = users.length ? users.map((user) => `
      <article class="admin-user-row">
        <div>
          <strong>@${UI.escapeHTML(user.username)}</strong>
          <small>${UI.escapeHTML(user.userId)} | creado ${UI.formatDate(user.createdAt)} | ultimo login ${UI.formatDate(user.lastLoginAt)}</small>
        </div>
        <select data-user-role="${UI.escapeHTML(user.userId)}">
          ${["user", "moderator", "admin"].map((role) => `<option value="${role}" ${role === user.role ? "selected" : ""}>${role}</option>`).join("")}
        </select>
        <select data-user-status="${UI.escapeHTML(user.userId)}">
          ${["active", "blocked", "deleted"].map((status) => `<option value="${status}" ${status === user.status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </article>
    `).join("") : `<p class="muted">No hay usuarios.</p>`;
    box.querySelectorAll("[data-user-role]").forEach((select) => {
      select.addEventListener("change", () => updateUserRole(select.dataset.userRole, select.value));
    });
    box.querySelectorAll("[data-user-status]").forEach((select) => {
      select.addEventListener("change", () => updateUserStatus(select.dataset.userStatus, select.value));
    });
  }

  function renderAuditLog(logs) {
    const box = document.getElementById("auditLog");
    if (!box) return;
    box.innerHTML = logs.length ? logs.map((log) => `
      <article class="admin-report-row">
        <div>
          <strong>${UI.escapeHTML(log.action)}</strong>
          <p>${UI.escapeHTML(log.details || "Sin detalles")}</p>
          <small>${UI.escapeHTML(log.userId)} | ${UI.escapeHTML(log.targetType)} ${UI.escapeHTML(log.targetId)} | ${UI.formatDate(log.createdAt)}</small>
        </div>
      </article>
    `).join("") : `<p class="muted">Sin auditoria registrada.</p>`;
  }

  function bindAdminActions(root = document) {
    root.querySelectorAll("[data-admin-post-status]").forEach((button) => {
      button.addEventListener("click", () => updatePostStatus(button.dataset.postId, button.dataset.adminPostStatus));
    });
    root.querySelectorAll("[data-admin-comment-status]").forEach((button) => {
      button.addEventListener("click", () => updateCommentStatus(button.dataset.commentId, button.dataset.adminCommentStatus));
    });
    root.querySelectorAll("[data-admin-post-remove]").forEach((button) => {
      button.addEventListener("click", () => removePost(button.dataset.adminPostRemove));
    });
    root.querySelectorAll("[data-admin-comment-remove]").forEach((button) => {
      button.addEventListener("click", () => removeComment(button.dataset.adminCommentRemove));
    });
    root.querySelectorAll("[data-admin-post-restore]").forEach((button) => {
      button.addEventListener("click", () => restorePost(button.dataset.adminPostRestore));
    });
    root.querySelectorAll("[data-admin-comment-restore]").forEach((button) => {
      button.addEventListener("click", () => restoreComment(button.dataset.adminCommentRestore));
    });
    root.querySelectorAll("[data-admin-report-reviewed]").forEach((button) => {
      button.addEventListener("click", () => markReportReviewed(button.dataset.adminReportReviewed));
    });
  }

  function askReason(title = "Motivo de moderacion") {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className = "modal-backdrop";
      modal.innerHTML = `
        <section class="modal-card moderation-modal">
          <h2>${UI.escapeHTML(title)}</h2>
          <label>Motivo</label>
          <select id="moderationReason">${reasons.map((reason) => `<option value="${UI.escapeHTML(reason)}">${UI.escapeHTML(reason)}</option>`).join("")}</select>
          <label>Detalles</label>
          <textarea id="moderationDetails" rows="4" placeholder="Explica brevemente la accion."></textarea>
          <div class="modal-actions">
            <button class="ghost-btn" id="cancelModeration">Cancelar</button>
            <button class="warning-btn" id="confirmModeration">Confirmar</button>
          </div>
        </section>
      `;
      document.body.appendChild(modal);
      modal.querySelector("#cancelModeration").addEventListener("click", () => {
        modal.remove();
        resolve(null);
      });
      modal.querySelector("#confirmModeration").addEventListener("click", () => {
        const result = {
          reason: modal.querySelector("#moderationReason").value,
          details: modal.querySelector("#moderationDetails").value.trim()
        };
        modal.remove();
        resolve(result);
      });
    });
  }

  async function updatePostStatus(postId, status) {
    const reason = ["hidden", "removed"].includes(status) ? await askReason("Motivo para cambiar publicacion") : { reason: status, details: "" };
    if (!reason) return;
    try {
      await Api.apiAdminUpdatePostStatus(Auth.token(), postId, status, [reason.reason, reason.details].filter(Boolean).join(" | "));
      UI.toast("Publicacion actualizada.", "success");
      Router.reload();
    } catch (error) {
      UI.toast(error.message, "error");
    }
  }

  async function updateCommentStatus(commentId, status) {
    const reason = ["hidden", "removed"].includes(status) ? await askReason("Motivo para cambiar comentario") : { reason: status, details: "" };
    if (!reason) return;
    try {
      await Api.apiAdminUpdateCommentStatus(Auth.token(), commentId, status, [reason.reason, reason.details].filter(Boolean).join(" | "));
      UI.toast("Comentario actualizado.", "success");
      Router.reload();
    } catch (error) {
      UI.toast(error.message, "error");
    }
  }

  async function removePost(postId, reasonArg, detailsArg = "") {
    const reason = reasonArg ? { reason: reasonArg, details: detailsArg } : await askReason("Motivo de remocion");
    if (!reason) return;
    try {
      await Api.apiAdminRemovePost(Auth.token(), postId, reason.reason, reason.details);
      UI.toast("Publicacion removida.", "success");
      Router.reload();
    } catch (error) {
      UI.toast(error.message, "error");
    }
  }

  async function hidePost(postId, reason = "Oculto por moderacion") {
    return updatePostStatus(postId, "hidden", reason);
  }

  async function restorePost(postId) {
    try {
      await Api.apiAdminRestorePost(Auth.token(), postId);
      UI.toast("Publicacion restaurada.", "success");
      Router.reload();
    } catch (error) {
      UI.toast(error.message, "error");
    }
  }

  async function removeComment(commentId, reasonArg, detailsArg = "") {
    const reason = reasonArg ? { reason: reasonArg, details: detailsArg } : await askReason("Motivo de remocion");
    if (!reason) return;
    try {
      await Api.apiAdminRemoveComment(Auth.token(), commentId, reason.reason, reason.details);
      UI.toast("Comentario removido.", "success");
      Router.reload();
    } catch (error) {
      UI.toast(error.message, "error");
    }
  }

  async function hideComment(commentId, reason = "Oculto por moderacion") {
    return updateCommentStatus(commentId, "hidden", reason);
  }

  async function restoreComment(commentId) {
    try {
      await Api.apiAdminRestoreComment(Auth.token(), commentId);
      UI.toast("Comentario restaurado.", "success");
      Router.reload();
    } catch (error) {
      UI.toast(error.message, "error");
    }
  }

  async function markReportReviewed(reportId) {
    try {
      await Api.apiAdminUpdateReportStatus(Auth.token(), reportId, "reviewed");
      UI.toast("Reporte marcado como revisado.", "success");
      loadReports();
    } catch (error) {
      UI.toast(error.message, "error");
    }
  }

  async function updateUserRole(userId, newRole) {
    try {
      await Api.apiAdminUpdateUserRole(Auth.token(), userId, newRole);
      UI.toast("Rol actualizado.", "success");
      loadAuditLog();
    } catch (error) {
      UI.toast(error.message, "error");
      loadUsers();
    }
  }

  async function updateUserStatus(userId, newStatus) {
    try {
      await Api.apiAdminUpdateUserStatus(Auth.token(), userId, newStatus);
      UI.toast("Estado actualizado.", "success");
      loadAuditLog();
    } catch (error) {
      UI.toast(error.message, "error");
      loadUsers();
    }
  }

  return {
    initAdminPanel,
    checkAdminAccess,
    renderAdminBadge,
    loadAdminDashboard,
    loadReportedPosts,
    loadReportedComments,
    loadReports,
    loadUsers,
    loadAuditLog,
    removePost,
    hidePost,
    restorePost,
    removeComment,
    hideComment,
    restoreComment,
    updateUserRole,
    updateUserStatus,
    renderAdminStats,
    renderReportedPosts,
    renderReportedComments,
    renderUsers,
    renderAuditLog
  };
})();
