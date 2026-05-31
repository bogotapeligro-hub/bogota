const Notifications = (() => {
  const KEY = "bau_notifications_v2";
  const LEGACY_KEY = "bau_notifications_v1";
  const MAX = 160;
  let bound = false;

  function currentUserId() {
    const user = Auth.user();
    return String(user?.userId || user?.username || "");
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function getRawAll() {
    const stored = readJson(KEY, null);
    if (Array.isArray(stored)) return stored;
    const legacy = readJson(LEGACY_KEY, []);
    const userId = currentUserId();
    return legacy.map(item => ({ ...item, toUserId: item.toUserId || userId }));
  }

  function getAll() {
    const userId = currentUserId();
    return getRawAll()
      .filter(item => !item.toUserId || item.toUserId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function saveRawAll(list) {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    updateBadge();
    refreshOpenPanel();
    window.dispatchEvent(new CustomEvent("bau-notifications-updated"));
  }

  function saveAllForCurrentUser(userList) {
    const userId = currentUserId();
    const others = getRawAll().filter(item => item.toUserId && item.toUserId !== userId);
    saveRawAll([...userList, ...others].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  function makeNotification({ toUserId = currentUserId(), type, title, message, link = "", emoji = "!", meta = {} }) {
    return {
      id: `notif_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      notificationId: `notif_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type,
      title,
      message,
      link,
      emoji,
      read: false,
      createdAt: new Date().toISOString(),
      toUserId,
      username: Auth.user()?.username || "",
      ...meta
    };
  }

  function add(type, title, message, link = "", emoji = "!") {
    return addForUser({ toUserId: currentUserId(), type, title, message, link, emoji });
  }

  function addForUser(input) {
    const notif = makeNotification(input);
    if (!notif.toUserId) return null;
    const all = getRawAll();
    const duplicate = all.some(item =>
      item.toUserId === notif.toUserId &&
      item.type === notif.type &&
      item.messageId &&
      notif.messageId &&
      item.messageId === notif.messageId
    );
    if (duplicate) return null;
    all.unshift(notif);
    saveRawAll(all);
    if (notif.toUserId === currentUserId()) showToast(notif);
    return notif;
  }

  function showToast(notif) {
    const toastRoot = document.getElementById("toastRoot");
    if (!toastRoot) return;
    const item = document.createElement("div");
    item.className = `toast toast-notif toast-${notif.type}`;
    item.innerHTML = `<span class="toast-notif-emoji">${UI.escapeHTML(notif.emoji || "!")}</span><div><strong>${UI.escapeHTML(notif.title)}</strong><p>${UI.escapeHTML(notif.message)}</p></div>`;
    if (notif.link) {
      item.style.cursor = "pointer";
      item.addEventListener("click", () => {
        markAsRead(notif.id);
        location.hash = notif.link;
        item.remove();
      });
    }
    toastRoot.appendChild(item);
    window.setTimeout(() => {
      item.classList.add("toast-out");
      window.setTimeout(() => item.remove(), 250);
    }, 4200);
  }

  function markAsRead(id) {
    const all = getRawAll();
    const found = all.find(n => n.id === id || n.notificationId === id);
    if (found) found.read = true;
    saveRawAll(all);
  }

  function markChatAsRead(chatId) {
    const userId = currentUserId();
    if (!userId || !chatId) return;
    const all = getRawAll();
    all.forEach(item => {
      if (item.toUserId === userId && item.chatId === chatId) item.read = true;
    });
    saveRawAll(all);
  }

  function markAllAsRead() {
    const current = getAll();
    current.forEach(n => n.read = true);
    saveAllForCurrentUser(current);
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
      <button class="notif-bell-btn" id="notifBell" aria-label="Notificaciones" title="Notificaciones">
        <span class="notif-bell-icon" aria-hidden="true">&#128276;</span>
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
          ${count > 0 ? `<button class="mini-btn" id="notifMarkAllRead">Marcar leidas</button>` : ""}
        </div>
        <div class="notif-panel-body">
          ${all.length === 0 ? `
            <div class="notif-empty">
              <span class="notif-empty-icon">!</span>
              <p>Sin notificaciones</p>
              <small>Las novedades apareceran aqui</small>
            </div>
          ` : all.map(n => `
            <div class="notif-item ${n.read ? "read" : "unread"}" data-notif-id="${n.id}" ${n.link ? `data-notif-link="${UI.escapeHTML(n.link)}"` : ""}>
              <span class="notif-item-emoji">${UI.escapeHTML(n.emoji || "!")}</span>
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

  function bindPanelActions(panel) {
    if (!panel) return;
    panel.querySelector("#notifMarkAllRead")?.addEventListener("click", () => {
      markAllAsRead();
      panel.remove();
    });
    panel.querySelectorAll("[data-notif-id]").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.dataset.notifId;
        const link = el.dataset.notifLink;
        markAsRead(id);
        if (link) location.hash = link;
        panel.remove();
      });
    });
  }

  function refreshOpenPanel() {
    const panel = document.getElementById("notifPanel");
    if (!panel) return;
    panel.outerHTML = renderPanel();
    bindPanelActions(document.getElementById("notifPanel"));
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
    document.addEventListener("click", (event) => {
      const bell = document.getElementById("notifBell");
      const panel = document.getElementById("notifPanel");
      if (bell && (event.target.closest("#notifBell") || event.target.closest(".notif-bell") || event.target.closest(".notif-bell-btn"))) {
        event.stopPropagation();
        if (panel) {
          panel.remove();
          return;
        }
        document.querySelector(".notif-panel")?.remove();
        bell.insertAdjacentHTML("afterend", renderPanel());
        bindPanelActions(document.getElementById("notifPanel"));
      }
      if (panel && !event.target.closest(".notif-panel") && !event.target.closest("#notifBell")) panel.remove();
    });
  }

  window.addEventListener("bau-notifications-updated", updateBadge);
  window.addEventListener("storage", event => {
    if (event.key === KEY) updateBadge();
  });

  return {
    add,
    addForUser,
    getAll,
    markAsRead,
    markChatAsRead,
    markAllAsRead,
    unreadCount,
    updateBadge,
    renderBell,
    renderPanel,
    bind
  };
})();
