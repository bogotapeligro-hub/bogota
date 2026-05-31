const Notifications = (() => {
  const KEY = "bau_notifications_v1";
  const MAX = 100;
  let bound = false;

  function getAll() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveAll(list) {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    updateBadge();
    window.dispatchEvent(new CustomEvent("bau-notifications-updated"));
  }

  function add(type, title, message, link = "", emoji = "🔔") {
    const user = Auth.user();
    if (!user) return;
    const notif = {
      id: `notif_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type,
      title,
      message,
      link,
      emoji,
      read: false,
      createdAt: new Date().toISOString(),
      username: user.username
    };
    const all = getAll();
    all.unshift(notif);
    saveAll(all);
    showToast(notif);
    return notif;
  }

  function showToast(notif) {
    const toastRoot = document.getElementById("toastRoot");
    if (!toastRoot) return;
    const item = document.createElement("div");
    item.className = `toast toast-notif toast-${notif.type}`;
    item.innerHTML = `<span class="toast-notif-emoji">${notif.emoji}</span><div><strong>${UI.escapeHTML(notif.title)}</strong><p>${UI.escapeHTML(notif.message)}</p></div>`;
    if (notif.link) {
      item.style.cursor = "pointer";
      item.addEventListener("click", () => { location.hash = notif.link; item.remove(); });
    }
    toastRoot.appendChild(item);
    window.setTimeout(() => {
      item.classList.add("toast-out");
      window.setTimeout(() => item.remove(), 250);
    }, 4000);
  }

  function markAsRead(id) {
    const all = getAll();
    const found = all.find(n => n.id === id);
    if (found) found.read = true;
    saveAll(all);
  }

  function markAllAsRead() {
    const all = getAll();
    all.forEach(n => n.read = true);
    saveAll(all);
  }

  function unreadCount() {
    return getAll().filter(n => !n.read).length;
  }

  function updateBadge() {
    const count = unreadCount();
    document.querySelectorAll("[data-notif-badge]").forEach(el => {
      el.textContent = String(Math.min(count, 99));
      el.classList.toggle("hidden", count <= 0);
    });
  }

  function renderBell() {
    const count = unreadCount();
    return `
      <button class="notif-bell" id="notifBell" aria-label="Notificaciones">
        🔔
        <span class="notif-badge ${count > 0 ? "" : "hidden"}" data-notif-badge>${Math.min(count, 99)}</span>
      </button>
    `;
  }

  function renderPanel() {
    const all = getAll();
    const count = unreadCount();
    return `
      <div class="notif-panel" id="notifPanel">
        <div class="notif-panel-header">
          <h3>Notificaciones</h3>
          ${count > 0 ? `<button class="mini-btn" id="notifMarkAllRead">Marcar leídas</button>` : ""}
        </div>
        <div class="notif-panel-body">
          ${all.length === 0 ? `
            <div class="notif-empty">
              <span class="notif-empty-icon">🔔</span>
              <p>Sin notificaciones</p>
              <small>Las novedades aparecerán aquí</small>
            </div>
          ` : all.map(n => `
            <div class="notif-item ${n.read ? "read" : "unread"}" data-notif-id="${n.id}" ${n.link ? `data-notif-link="${UI.escapeHTML(n.link)}"` : ""}>
              <span class="notif-item-emoji">${n.emoji}</span>
              <div class="notif-item-content">
                <strong>${UI.escapeHTML(n.title)}</strong>
                <p>${UI.escapeHTML(n.message)}</p>
                <small>${formatTimeAgo(n.createdAt)}</small>
              </div>
              ${!n.read ? `<span class="notif-dot"></span>` : ""}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function formatTimeAgo(isoString) {
    if (!isoString) return "";
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Hace ${days}d`;
    return new Date(isoString).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  }

  function bind() {
    if (bound) return;
    bound = true;

    document.addEventListener("click", (e) => {
      const bell = document.getElementById("notifBell");
      const panel = document.getElementById("notifPanel");
      if (bell && (e.target.closest("#notifBell") || e.target.closest(".notif-bell"))) {
        e.stopPropagation();
        if (panel) {
          panel.remove();
          return;
        }
        const existing = document.querySelector(".notif-panel");
        if (existing) existing.remove();
        bell.insertAdjacentHTML("afterend", renderPanel());
        const newPanel = document.getElementById("notifPanel");
        if (newPanel) {
          newPanel.querySelector("#notifMarkAllRead")?.addEventListener("click", () => {
            markAllAsRead();
            newPanel.remove();
          });
          newPanel.querySelectorAll("[data-notif-id]").forEach(el => {
            el.addEventListener("click", () => {
              const id = el.dataset.notifId;
              const link = el.dataset.notifLink;
              markAsRead(id);
              if (link) location.hash = link;
            });
          });
        }
      }
      if (panel && !e.target.closest(".notif-panel") && !e.target.closest("#notifBell")) {
        panel.remove();
      }
    });
  }

  function onNewNotification(notif) {
    const path = (location.hash || "").replace(/^#/, "").split("?")[0];
    const ignorePaths = ["/chat", "/chat-global"];
    if (!ignorePaths.includes(path) && !path.startsWith("/chat/")) {
      showToast(notif);
    }
  }

  window.addEventListener("bau-notifications-updated", updateBadge);

  return {
    add,
    getAll,
    markAsRead,
    markAllAsRead,
    unreadCount,
    updateBadge,
    renderBell,
    renderPanel,
    bind
  };
})();
