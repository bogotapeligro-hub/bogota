const Router = (() => {
  const routes = {
    "/login": { view: "login", bind: () => Auth.bindLogin() },
    "/register": { view: "register", bind: () => Auth.bindRegister() },
    "/feed": { custom: () => Feed.render() },
    "/create-post": { view: "create-post", auth: true, bind: () => Posts.bindCreatePost() },
    "/casino": { view: "casino", auth: true, bind: () => Casino.bind() },
    "/ruleta-bogotana": { view: "ruleta-bogotana", auth: true, bind: () => RuletaBogotana.init() },
    "/revolver": { custom: () => renderLinkedGame("revolver", "css/revolver.css", "js/revolver.js", () => window.RevolverGame?.init()), auth: true },
    "/cartas-distrito": { custom: () => renderLinkedGame("cartas-distrito", "css/cartas.css", "js/cartas.js", () => window.CartasDistrito?.init()), auth: true },
    "/poker-fichas": { custom: () => renderLinkedGame("poker-fichas", "css/pokerFichas.css", "js/pokerFichas.js", () => window.PokerFichas?.init()), auth: true },
    "/profile": { custom: () => renderProfile(), auth: true },
    "/chat": { custom: () => renderChatList(), auth: true },
    "/chat-global": { custom: () => Chat.renderGlobal(), auth: true },
    "/shorts": { custom: () => Shorts.render(), auth: true },
    "/alertas": { custom: () => Alerts.render(), auth: true },
    "/mapa": { custom: () => MapaReportes.render(), auth: true },
    "/rules": { view: "rules" },
    "/admin": { view: "admin", auth: true, moderation: true, bind: () => Admin.initAdminPanel() }
  };

  function currentPath() {
    const hash = location.hash || APP_CONFIG.defaultRoute;
    return hash.replace(/^#/, "").split("?")[0];
  }

  async function render() {
    if (!AgeGate.isConfirmed()) {
      AgeGate.render();
      return;
    }

    UI.syncTopbar();
    const path = currentPath();
    if (path.startsWith("/post/")) return renderPostDetail(decodeURIComponent(path.replace("/post/", "")));
    if (path.startsWith("/profile/")) return renderProfile(decodeURIComponent(path.replace("/profile/", "")));
    if (path.startsWith("/chat/") && path !== "/chat-global") return Chat.renderPrivate(decodeURIComponent(path.replace("/chat/", "")));
    if (!["/revolver", "/cartas-distrito", "/poker-fichas"].includes(path)) clearGameStyles();
    const route = routes[path] || routes["/feed"];
    if (route.auth && !UI.requireSession()) return;
    if (route.moderation && !Auth.isAdminOrModerator()) {
      UI.renderApp(UI.emptyState("No tienes permisos para acceder a esta seccion.", "Esta vista esta reservada para administradores y moderadores.", `<a class="warning-btn inline-btn" href="#/feed">Volver al feed</a>`));
      return;
    }

    if (route.custom) return route.custom();

    const html = await UI.loadView(route.view);
    UI.renderApp(html);
    route.bind?.();
  }

  function clearGameStyles() {
    window.RevolverGame?.destroy?.();
    window.CartasDistrito?.destroy?.();
    window.PokerFichas?.destroy?.();
    document.querySelectorAll(".modal-overlay, #no-coins-modal").forEach(el => el.remove());
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    document.querySelectorAll("link[data-linked-game-style]").forEach(link => link.remove());
  }

  function loadStylesheet(href) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.linkedGameStyle = "true";
    document.head.appendChild(link);
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-game-script="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.dataset.gameScript = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error("No se pudo cargar el juego."));
      document.body.appendChild(script);
    });
  }

  async function renderLinkedGame(view, cssHref, scriptSrc, init) {
    if (!UI.requireSession()) return;
    clearGameStyles();
    if (typeof CasinoCoins !== "undefined") {
      CasinoCoins.initializeCoins();
      if (!CasinoCoins.canPlayCasinoGame()) {
        CasinoCoins.showNoCoinsMessage();
        location.hash = "#/casino";
        return;
      }
    }
    const html = await UI.loadView(view);
    UI.renderApp(html);
    loadStylesheet(cssHref);
    try {
      await loadScriptOnce(scriptSrc);
      init?.();
    } catch (error) {
      UI.toast(error.message || "No se pudo cargar el juego.", "error");
      location.hash = "#/casino";
    }
  }

  async function renderPostDetail(postId) {
    UI.renderApp(`
      <div class="feed-layout detail-layout">
        ${Feed.sidebar("Inicio")}
        <section class="feed-column">
          ${UI.skeletonPosts(1)}
        </section>
        <aside class="right-sidebar"><section class="trend-card"><h3>Detalle</h3><p class="muted">Cargando publicacion...</p></section></aside>
      </div>
    `);
    try {
      const data = await Api.apiGetPost(postId);
      const post = Posts.sanitizePostData(data.post);
      document.querySelector(".feed-column").innerHTML = `
        <section class="post-detail-panel">
          <div class="detail-toolbar">
            <a href="#/feed" class="back-link">Volver al feed</a>
            <a href="#/feed" class="detail-close" aria-label="Cerrar">X</a>
          </div>
          ${Posts.card(post)}
          <section class="comments-section">
            <div class="comments-title-row">
              <h2>Comentarios</h2>
              <span id="commentCounter">${Number(post.commentCount || 0)} comentarios</span>
            </div>
            <div id="commentsList">${Comments.renderList(data.comments)}</div>
            ${Comments.renderForm(post.postId)}
          </section>
        </section>
      `;
      Reactions.bind(document);
      Posts.bindReportButtons(document);
      Posts.bindShareButtons(document);
      Posts.bindSensitiveMedia(document);
      Posts.bindVerificationButtons(document);
      Posts.bindChatShareButtons(document);
      Posts.bindAdminInline(document);
      Comments.bindForm({
        onCreated: () => {
          const counter = document.getElementById("commentCounter");
          if (counter) {
            const current = Number((counter.textContent || "0").match(/\d+/)?.[0] || 0) + 1;
            counter.textContent = `${current} comentarios`;
          }
        }
      });
      Comments.bindModerationButtons(document);
    } catch (error) {
      document.querySelector(".feed-column").innerHTML = UI.emptyState("Publicacion no encontrada", error.message, `<a class="warning-btn inline-btn" href="#/feed">Volver al feed</a>`);
    }
  }

  async function renderProfile(userIdOrUsername = "") {
    if (!UI.requireSession()) return;
    const self = Auth.user();
    const requested = String(userIdOrUsername || self?.userId || self?.username || "");
    const html = await UI.loadView("profile");
    UI.renderApp(html);
    const avatarWrap = document.getElementById("profileAvatarWrap");
    const usernameEl = document.getElementById("profileUsername");
    const roleEl = document.getElementById("profileRole");
    const bioEl = document.getElementById("profileBio");
    const statsEl = document.getElementById("profileStats");
    const contentEl = document.getElementById("profileContent");
    if (!usernameEl || !contentEl) return;

    const isViewingSelf = !requested || requested === self.userId || requested === self.username;
    let profileUser = isViewingSelf
      ? self
      : { userId: requested, username: requested, role: "user", status: "active" };
    let posts = [];
    let profileError = "";
    try {
      if (!isViewingSelf && Api.apiGetUserProfile && Api.hasConfiguredApiUrl()) {
        const result = await Api.apiGetUserProfile(Auth.token(), requested);
        profileUser = result.user || profileUser;
        posts = result.posts || [];
      } else {
        const result = await Api.apiListPosts();
        posts = (result.posts || []).filter(post => String(post.userId) === String(profileUser.userId) || post.username === profileUser.username);
      }
    } catch (error) {
      profileError = String(error.message || "");
    }

    const isSelf = String(profileUser.userId) === String(self.userId) || String(profileUser.username) === String(self.username);
    const username = profileUser.username || "usuario";

    if (avatarWrap) {
      avatarWrap.innerHTML = Profile.renderAvatar(username, 80);
    }
    if (usernameEl) usernameEl.textContent = `@${username}`;
    if (roleEl) roleEl.textContent = profileUser.role || "Vecino";
    if (bioEl) {
      const bio = isViewingSelf ? Profile.getBio() : profileUser.bio || "Sin biografía.";
      bioEl.textContent = bio;
    }

    if (statsEl && isViewingSelf) {
      const stats = Profile.getStats();
      statsEl.querySelector("#statPosts").textContent = stats.posts || posts.length;
      statsEl.querySelector("#statReactions").textContent = stats.reactions || 0;
      statsEl.querySelector("#statReports").textContent = stats.reports || 0;
      statsEl.querySelector("#statGames").textContent = stats.games || 0;
    }

    if (!isViewingSelf) {
      document.getElementById("editProfileBtn")?.remove();
    } else {
      document.getElementById("profileMessageBtn")?.remove();
      document.getElementById("profileFollowBtn")?.remove();
      document.getElementById("profileReportBtn")?.remove();
    }

    const activePosts = posts.filter(p => p.status === "active").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    _cachedProfilePosts = activePosts;
    _cachedProfileUser = profileUser;
    contentEl.innerHTML = activePosts.length
      ? activePosts.map(post => Posts.card(post)).join("")
      : UI.emptyState("Sin publicaciones", profileError || "Este usuario no ha publicado aún.", "", "📭");

    Feed.bindFeedActions();
    Profile.bind();
    bindProfileActions(profileUser, isSelf);
    bindProfileTabs();
  }

  function renderChatList() {
    if (!UI.requireSession()) return;
    const html = Chat.renderConversationList();
    const sidebar = Feed.sidebar("Chat");
    UI.renderApp(`
      <div class="feed-layout chat-layout">
        ${sidebar}
        ${html}
      </div>
    `);
    Notifications.bind();
    document.querySelector(".chat-layout")?.addEventListener("click", (e) => {
      const item = e.target.closest(".chat-conv-item");
      if (item && item.getAttribute("href")) {
        location.hash = item.getAttribute("href");
      }
    });
  }

  let _cachedProfilePosts = [];
  let _cachedProfileUser = null;

  function bindProfileTabs() {
    const tabs = document.querySelectorAll(".profile-tab");
    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const tabName = tab.dataset.tab;
        const content = document.getElementById("profileContent");
        if (!content) return;
        if (tabName === "saved") {
          const saved = JSON.parse(localStorage.getItem("bau_saved_posts") || "[]");
          if (!saved.length) {
            content.innerHTML = UI.emptyState("Sin guardados", "No has guardado ninguna publicación todavía. Usa el botón bookmark en las publicaciones.", "", "🔖");
            return;
          }
          content.innerHTML = `<div class="loading-skeleton">Cargando guardados...</div>`;
          Api.apiListPosts().then(result => {
            const allPosts = (result.posts || []).map(Posts.sanitizePostData);
            const savedPosts = allPosts.filter(p => saved.includes(p.postId));
            content.innerHTML = savedPosts.length
              ? savedPosts.map(post => Posts.card(post)).join("")
              : UI.emptyState("Sin guardados", "Las publicaciones guardadas ya no están disponibles.", "", "🔖");
            Feed.bindFeedActions();
          }).catch(() => {
            content.innerHTML = UI.emptyState("Error", "No se pudieron cargar las publicaciones guardadas.");
          });
        } else if (tabName === "shorts") {
          const user = _cachedProfileUser || Auth.user();
          const shorts = typeof Shorts !== "undefined" ? Shorts.getAll().filter(short => String(short.userId) === String(user.userId || user.username) || short.username === user.username) : [];
          content.innerHTML = shorts.length
            ? shorts.map(short => `<article class="post-card"><span class="category-pill">${UI.escapeHTML(short.category || "Short")}</span><h2>${UI.escapeHTML(short.title)}</h2><p class="muted">${UI.escapeHTML(short.description || "Sin descripcion")}</p><a class="warning-btn inline-btn" href="#/shorts">Ver shorts</a></article>`).join("")
            : UI.emptyState("Sin shorts", "Aun no hay shorts publicados por este perfil.", `<a class="warning-btn inline-btn" href="#/shorts">Crear short</a>`, "!");
        } else if (tabName === "reports") {
          const reports = _cachedProfilePosts.filter(post => ["Alerta", "Reporte ciudadano", "Denuncia", "Incidente", "Seguridad"].includes(post.category));
          content.innerHTML = reports.length
            ? reports.map(post => Posts.card(post, true)).join("")
            : UI.emptyState("Sin reportes ciudadanos", "Aqui apareceran denuncias, alertas y reportes con contexto.", "", "!");
          Feed.bindFeedActions();
        } else if (tabName === "privacy") {
          content.innerHTML = `
            <section class="privacy-settings-card">
              <h2>Configuracion de privacidad</h2>
              <p>Usa zona aproximada, evita nombres reales y marca como sensible cualquier material fuerte.</p>
              <label class="check-row"><input type="checkbox" checked disabled /> <span>No mostrar ubicacion exacta por defecto</span></label>
              <label class="check-row"><input type="checkbox" checked disabled /> <span>Advertir antes de publicar personas identificables</span></label>
              <label class="check-row"><input type="checkbox" checked disabled /> <span>Bloquear telefonos, correos, cedulas y direcciones exactas</span></label>
            </section>
          `;
        } else {
          content.innerHTML = _cachedProfilePosts.length
            ? _cachedProfilePosts.map(post => Posts.card(post)).join("")
            : UI.emptyState("Sin publicaciones", "Este usuario no ha publicado aun.", "", "!");
          Feed.bindFeedActions();
        }
      });
    });
  }

  function bindProfileActions(profileUser, isSelf) {
    if (isSelf) return;
    document.getElementById("profileMessageBtn")?.addEventListener("click", () => {
      location.hash = `#/chat/${encodeURIComponent(profileUser.userId || profileUser.username)}`;
    });
    document.getElementById("profileFollowBtn")?.addEventListener("click", (event) => {
      event.currentTarget.textContent = "Siguiendo";
      UI.toast("Ahora sigues este perfil.", "success");
    });
    document.getElementById("profileReportBtn")?.addEventListener("click", () => {
      UI.toast("Reporte de usuario recibido para revision.", "success");
    });
  }

  function reload() { render(); }

  window.addEventListener("hashchange", render);
  document.addEventListener("DOMContentLoaded", () => {
    UI.bindGlobalNavigation();
    if (!location.hash) location.hash = APP_CONFIG.defaultRoute;
    render();
  });

  return { render, reload };
})();
