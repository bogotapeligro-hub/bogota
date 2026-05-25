const UI = (() => {
  const app = () => document.getElementById("app");
  const toastRoot = () => document.getElementById("toastRoot");
  let busyCount = 0;
  let navigationBound = false;

  function escapeHTML(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toast(message, type = "info") {
    const root = toastRoot();
    if (!root) return;
    const item = document.createElement("div");
    item.className = `toast toast-${type}`;
    item.textContent = message;
    root.appendChild(item);
    window.setTimeout(() => {
      item.classList.add("toast-out");
      window.setTimeout(() => item.remove(), 250);
    }, 3600);
  }

  function setLoading(target, isLoading, text = "Cargando...") {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return;
    if (isLoading) {
      if (!el.dataset.originalText) el.dataset.originalText = el.textContent;
      if (!el.dataset.originalHtml) el.dataset.originalHtml = el.innerHTML;
      el.textContent = text;
      el.disabled = true;
      el.classList.add("is-loading");
    } else {
      if (el.dataset.originalHtml) el.innerHTML = el.dataset.originalHtml;
      else el.textContent = el.dataset.originalText || el.textContent;
      delete el.dataset.originalText;
      delete el.dataset.originalHtml;
      el.disabled = false;
      el.classList.remove("is-loading");
    }
  }

  function showBusy(message = "Estamos cargando, espera...") {
    busyCount += 1;
    let overlay = document.getElementById("busyOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "busyOverlay";
      overlay.className = "busy-overlay";
      overlay.innerHTML = `
        <div class="busy-card">
          <div class="busy-spinner" aria-hidden="true"></div>
          <strong id="busyMessage"></strong>
          <span>Por favor no cierres esta ventana.</span>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.querySelector("#busyMessage").textContent = message;
    overlay.classList.remove("hidden");
  }

  function hideBusy() {
    busyCount = Math.max(0, busyCount - 1);
    if (busyCount > 0) return;
    document.getElementById("busyOverlay")?.classList.add("hidden");
  }

  function renderApp(html) {
    const root = app();
    if (!root) return;
    root.innerHTML = html;
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function loadView(name) {
    try {
      const response = await fetch(`view/${name}.html`, { cache: "no-cache" });
      if (!response.ok) throw new Error(`No se pudo cargar view/${name}.html`);
      return await response.text();
    } catch (error) {
      return `
        <section class="error-view">
          <h1>Vista no disponible</h1>
          <p>${escapeHTML(error.message)}</p>
          <p class="muted">Abre el proyecto con un servidor local, por ejemplo Live Server de VS Code. Algunos navegadores bloquean fetch cuando se abre como archivo local.</p>
        </section>
      `;
    }
  }

  function formatDate(value) {
    if (!value) return "Sin fecha";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function chips(list = []) {
    return list
      .filter(Boolean)
      .map((item) => `<span class="chip">#${escapeHTML(String(item).trim().replace(/^#/, ""))}</span>`)
      .join("");
  }

  function skeletonPosts(count = 3) {
    return Array.from({ length: count }).map(() => `
      <article class="post-card skeleton-card">
        <div class="skeleton line w-40"></div>
        <div class="skeleton line w-80"></div>
        <div class="skeleton block"></div>
        <div class="skeleton line w-60"></div>
      </article>
    `).join("");
  }

  function emptyState(title, message, actionHtml = "") {
    return `
      <section class="empty-state">
        <h2>${escapeHTML(title)}</h2>
        <p>${escapeHTML(message)}</p>
        ${actionHtml}
      </section>
    `;
  }

  function bindGlobalNavigation() {
    if (navigationBound) return;
    navigationBound = true;
    document.getElementById("rulesShortcut")?.addEventListener("click", () => location.hash = "#/rules");
    document.getElementById("chatShortcut")?.addEventListener("click", () => location.hash = "#/chat");
    document.getElementById("casinoShortcut")?.addEventListener("click", () => location.hash = "#/casino");
    document.getElementById("adminShortcut")?.addEventListener("click", () => location.hash = "#/admin");
    document.getElementById("publishShortcut")?.addEventListener("click", () => location.hash = "#/create-post");
    document.getElementById("logoutBtn")?.addEventListener("click", () => Auth.logout());
    document.getElementById("menuToggle")?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleSidebar();
    });
    document.addEventListener("click", (event) => {
      if (!document.body.classList.contains("sidebar-open")) return;
      const sidebar = document.querySelector(".left-sidebar");
      if (sidebar?.contains(event.target) || event.target.closest("#menuToggle")) return;
      closeSidebar();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeSidebar();
    });
    window.addEventListener("hashchange", closeSidebar);
  }

  function toggleSidebar(force) {
    const next = typeof force === "boolean" ? force : !document.body.classList.contains("sidebar-open");
    document.body.classList.toggle("sidebar-open", next);
    document.getElementById("menuToggle")?.setAttribute("aria-expanded", String(next));
  }

  function closeSidebar() {
    toggleSidebar(false);
  }

  function syncTopbar() {
    const logout = document.getElementById("logoutBtn");
    if (logout) logout.classList.toggle("hidden", !Auth.isLoggedIn());
    const adminShortcut = document.getElementById("adminShortcut");
    const roleBadge = document.getElementById("roleBadge");
    const canModerate = Auth.isLoggedIn() && Auth.isAdminOrModerator?.();
    if (adminShortcut) {
      adminShortcut.classList.toggle("hidden", !canModerate);
      adminShortcut.textContent = Auth.isAdmin?.() ? "Panel Admin" : "Moderacion";
    }
    if (roleBadge) {
      roleBadge.classList.toggle("hidden", !canModerate);
      roleBadge.textContent = canModerate ? Auth.roleLabel() : "";
    }
    if (typeof Chat !== "undefined") Chat.updateBadges?.();
  }

  function requireSession() {
    if (!Auth.isLoggedIn()) {
      toast("Debes iniciar sesión para continuar.", "warning");
      location.hash = "#/login";
      return false;
    }
    return true;
  }

  return {
    escapeHTML,
    toast,
    setLoading,
    showBusy,
    hideBusy,
    renderApp,
    loadView,
    formatDate,
    chips,
    skeletonPosts,
    emptyState,
    bindGlobalNavigation,
    closeSidebar,
    syncTopbar,
    requireSession
  };
})();
