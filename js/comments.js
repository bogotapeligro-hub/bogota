const Comments = (() => {
  function renderList(comments = []) {
    if (!comments.length) {
      return `<div class="comment-empty">Aun no hay comentarios. Se preciso, no acuses sin evidencia y no publiques datos personales.</div>`;
    }
    return comments.map((comment) => {
      if (typeof Chat !== "undefined") Chat.rememberUser?.(comment);
      const commentId = comment.commentId || comment.id || "";
      const status = comment.status === "sending"
        ? `<span class="comment-status">Enviando...</span>`
        : comment.status === "failed"
          ? `<span class="comment-status error">No se pudo enviar</span>`
          : "";
      const modControls = Auth.isAdminOrModerator() && comment.status !== "sending" ? `
        <button class="mini-btn" data-admin-comment-status="hidden" data-comment-id="${UI.escapeHTML(commentId)}" type="button">Ocultar</button>
        <button class="mini-btn danger" data-admin-comment-remove="${UI.escapeHTML(commentId)}" type="button">Remover</button>
      ` : "";
      const reportButton = comment.status === "sending" ? "" : `
        <button class="mini-btn danger" data-report-target="comment" data-target-id="${UI.escapeHTML(commentId)}" type="button">Reportar comentario</button>
      `;
      const reactions = comment.status === "sending" ? "" : Reactions.renderButtons("comment", commentId);
      return `
      <article class="comment-card ${UI.escapeHTML(comment.status || "")}" data-comment-id="${UI.escapeHTML(commentId)}">
        <div class="comment-head">
          <a class="user-link" href="#/profile/${encodeURIComponent(comment.userId || comment.username)}">@${UI.escapeHTML(comment.username)}</a>
          <span class="muted">${UI.formatDate(comment.createdAt)} ${status}</span>
        </div>
        <p>${UI.escapeHTML(comment.text)}</p>
        <div class="comment-actions">
          ${reactions}
          ${reportButton}
          ${modControls}
        </div>
      </article>
    `;
    }).join("");
  }

  function renderForm(postId) {
    return `
      <form id="commentForm" class="comment-form" data-post-id="${UI.escapeHTML(postId)}">
        <textarea name="comment" rows="3" maxlength="500" placeholder="Comenta informacion verificable, sin doxxing ni amenazas."></textarea>
        <button class="warning-btn" type="submit">Comentar</button>
      </form>
    `;
  }

  function bindForm(options = {}) {
    const form = document.getElementById("commentForm");
    if (!form) return;
    if (form.dataset.bound === "true") return;
    form.dataset.bound = "true";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!UI.requireSession()) return;

      const text = form.comment.value.trim();
      const validation = Moderation.validateComment(text);
      if (!validation.allowed) return UI.toast(validation.message, "error");

      const button = form.querySelector("button[type='submit']");
      const tempId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const optimisticComment = {
        commentId: tempId,
        postId: form.dataset.postId,
        userId: Auth.user()?.userId || "",
        username: Auth.user()?.username || "usuario",
        text,
        createdAt: new Date().toISOString(),
        status: "sending",
        reportCount: 0
      };

      appendComment(optimisticComment, { scroll: true });
      form.reset();

      try {
        UI.setLoading(button, true, "Enviando...");
        const result = await Api.apiCreateComment(Auth.token(), form.dataset.postId, text);
        const comment = result.comment || { ...optimisticComment, status: "active" };
        replaceComment(tempId, comment);
        options.onCreated?.(comment);
        if (typeof Notifications !== "undefined") {
          const postTitle = document.querySelector(".post-title")?.textContent || "una publicacion";
          Notifications.add("comment", "Nuevo comentario", `Comentaste en ${postTitle}`, "", "CM");
        }
        UI.toast("Comentario publicado.", "success");
      } catch (error) {
        markCommentFailed(tempId, error.message);
        UI.toast(error.message, "error");
      } finally {
        UI.setLoading(button, false);
      }
    });
  }

  function safeCommentSelector(commentId) {
    const id = String(commentId || "");
    if (window.CSS?.escape) return `[data-comment-id="${CSS.escape(id)}"]`;
    return `[data-comment-id="${id.replace(/"/g, '\\"')}"]`;
  }

  function appendComment(comment, options = {}) {
    const list = document.getElementById("commentsList");
    const commentId = comment?.commentId || comment?.id;
    if (!list || !commentId) return;
    if (list.querySelector(safeCommentSelector(commentId))) return;
    if (list.querySelector(".comment-empty")) list.innerHTML = "";
    list.insertAdjacentHTML("beforeend", renderList([comment]));
    bindCommentEnhancements(list);
    if (options.scroll !== false) list.scrollIntoView({ block: "end", behavior: "smooth" });
  }

  function replaceComment(tempId, comment) {
    const list = document.getElementById("commentsList");
    if (!list) return;
    const node = list.querySelector(safeCommentSelector(tempId));
    if (!node) return appendComment(comment);
    node.outerHTML = renderList([comment]);
    bindCommentEnhancements(list);
  }

  function markCommentFailed(tempId, reason) {
    const list = document.getElementById("commentsList");
    const node = list?.querySelector(safeCommentSelector(tempId));
    if (!node) return;
    node.classList.remove("sending");
    node.classList.add("failed");
    const status = node.querySelector(".comment-status");
    if (status) {
      status.textContent = reason ? "No se pudo enviar" : "Error";
      status.classList.add("error");
    }
  }

  function bindCommentEnhancements(root = document) {
    Reactions.bind(root);
    Posts.bindReportButtons(root);
    bindModerationButtons(root);
  }

  function bindModerationButtons(root = document) {
    root.querySelectorAll("[data-admin-comment-status]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        if (!Auth.isAdminOrModerator()) return;
        try {
          if (button.dataset.adminCommentStatus === "hidden" && typeof Admin !== "undefined" && Admin.hideComment) {
            await Admin.hideComment(button.dataset.commentId);
            return;
          }
          await Api.apiAdminUpdateCommentStatus(Auth.token(), button.dataset.commentId, button.dataset.adminCommentStatus);
          UI.toast("Comentario actualizado.", "success");
          Router.reload();
        } catch (error) {
          UI.toast(error.message, "error");
        }
      });
    });
    root.querySelectorAll("[data-admin-comment-remove]").forEach((button) => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        if (!Auth.isAdminOrModerator()) return;
        if (typeof Admin !== "undefined" && Admin.removeComment) Admin.removeComment(button.dataset.adminCommentRemove);
      });
    });
  }

  return { renderList, renderForm, bindForm, appendComment, replaceComment, bindModerationButtons };
})();
