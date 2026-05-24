const Reactions = (() => {
  const emoji = {
    "Me impacta": "⚡",
    "Alerta": "🚨",
    "Confirmo": "✅",
    "No confirmado": "❔",
    "Cuidado": "⚠️",
    "Apoyo": "✊"
  };

  function renderButtons(targetType, targetId) {
    return `
      <div class="reaction-group" data-reaction-group="${UI.escapeHTML(targetId)}">
        ${APP_CONFIG.reactions.map((reaction) => `
          <button class="reaction-btn" data-reaction="${UI.escapeHTML(reaction)}" data-target-type="${UI.escapeHTML(targetType)}" data-target-id="${UI.escapeHTML(targetId)}" title="${UI.escapeHTML(reaction)}" type="button">
            <span class="reaction-emoji" aria-hidden="true">${emoji[reaction] || "•"}</span>
            <span class="reaction-label">${UI.escapeHTML(reaction)}</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  function bind(root = document) {
    root.querySelectorAll("[data-reaction]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!UI.requireSession()) return;
        const group = button.closest(".reaction-group");
        const buttons = group ? Array.from(group.querySelectorAll("[data-reaction]")) : [button];
        try {
          buttons.forEach((item) => item.disabled = true);
          UI.setLoading(button, true, "Enviando...");
          await Api.apiReact(Auth.token(), button.dataset.targetType, button.dataset.targetId, button.dataset.reaction);
          buttons.forEach((item) => item.classList.remove("selected"));
          button.classList.add("selected");
          UI.toast(`Reaccionaste: ${button.dataset.reaction}`, "success");
        } catch (error) {
          UI.toast(error.message, "error");
        } finally {
          UI.setLoading(button, false);
          buttons.forEach((item) => item.disabled = false);
        }
      });
    });
  }

  return { renderButtons, bind };
})();
