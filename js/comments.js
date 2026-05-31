const Comments = (() => {
  function renderList(comments = []) {
    if (!comments.length) {
      return `<div class="comment-empty">Aún no hay comentarios. Sé preciso, no acuses sin evidencia y no publiques datos personales.</div>`;
    }
    return comments.map((comment) => {
      if (typeof Chat !== "undefined") Chat.rememberUser?.(comment);
      const modControls = Auth.isAdminOrModerator() ? `
        <button class="mini-btn" data-admin-comment-status="hidden" data-comment-id="${UI.escapeHTML(comment.commentId)}" type="button">Ocultar</button>
        <button class="mini-btn danger" data-admin-comment-remove="${UI.escapeHTML(comment.commentId)}" type="button">Remover</button>
      ` : "";
      return `
      <article class="comment-card" data-comment-id="${UI.escapeHTML(comment.commentId)}">
        <div class="comment-head">
          <a class="user-link" href="#/profile/${encodeURIComponent(comment.userId || comment.username)}">@${UI.escapeHTML(comment.username)}</a>
          <span class="muted">${UI.formatDate(comment.createdAt)}</span>
        </div>
        <p>${UI.escapeHTML(comment.text)}</p>
        <div class="comment-actions">
          ${Reactions.renderButtons("comment", comment.commentId)}
          <button class="mini-btn danger" data-report-target="comment" data-target-id="${UI.escapeHTML(comment.commentId)}" type="button">Reportar comentario</button>
          ${modControls}
        </div>
      </article>
    `;
    }).join("");
  }

  function renderForm(postId) {
    return `
      <form id="commentForm" class="comment-form" data-post-id="${UI.escapeHTML(postId)}">
        <textarea name="comment" rows="3" maxlength="500" placeholder="Comenta información verificable, sin doxxing ni amenazas."></textarea>
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
      try {
        UI.setLoading(button, true, "Comentando...");
        const result = await Api.apiCreateComment(Auth.token(), form.dataset.postId, text);
        const comment = result.comment || {
          commentId: `local_${Date.now()}`,
          postId: form.dataset.postId,
          userId: Auth.user()?.userId || "",
          username: Auth.user()?.username || "usuario",
          text,
          createdAt: new Date().toISOString(),
          status: "active",
          reportCount: 0
        };
        appendComment(comment);
        form.reset();
        options.onCreated?.(comment);
        if (typeof Notifications !== "undefined") {
          const postTitle = document.querySelector(".post-title")?.textContent || "una publicación";
          Notifications.add("comment", "Nuevo comentario", `Comentaste en ${postTitle}`, "", "💬");
        }
        UI.toast("Comentario publicado.", "success");
      } catch (error) {
        UI.toast(error.message, "error");
      } finally {
        UI.setLoading(button, false);
      }
    });
  }

  function appendComment(comment) {
    const list = document.getElementById("commentsList");
    if (!list || !comment?.commentId) return;
    if (list.querySelector(`[data-comment-id="${CSS.escape(String(comment.commentId))}"]`)) return;
    if (list.querySelector(".comment-empty")) list.innerHTML = "";
    list.insertAdjacentHTML("beforeend", renderList([comment]));
    Reactions.bind(list);
    Posts.bindReportButtons(list);
    bindModerationButtons(list);
    list.scrollIntoView({ block: "end", behavior: "smooth" });
  }

  function bindModerationButtons(root = document) {
    root.querySelectorAll("[data-admin-comment-status]").forEach((button) => {
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
      button.addEventListener("click", () => {
        if (!Auth.isAdminOrModerator()) return;
        if (typeof Admin !== "undefined" && Admin.removeComment) Admin.removeComment(button.dataset.adminCommentRemove);
      });
    });
  }

  return { renderList, renderForm, bindForm, appendComment, bindModerationButtons };
})();
