const Chat = (() => {
  const GLOBAL_KEY = "bau_chat_global_v1";
  const PRIVATE_KEY = "bau_chat_private_v1";
  const READ_KEY = "bau_chat_read_v1";
  const KNOWN_USERS_KEY = "bau_known_users_v1";
  const MAX_MESSAGES = 200;
  const SEND_COOLDOWN_MS = 900;
  let lastSendAt = 0;
  let pollTimer = null;
  let lastToastAt = 0;

  const currentUser = () => Auth.user();
  const safeUserId = (user = currentUser()) => String(user?.userId || user?.username || "guest");

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bau-chat-updated"));
  }

  function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 700);
  }

  function makeId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function conversationId(a, b) {
    return [String(a), String(b)].sort().join("__");
  }

  function avatar(username = "") {
    return UI.escapeHTML(String(username || "?").slice(0, 2).toUpperCase());
  }

  function rememberUser(user = {}) {
    const userId = String(user.userId || user.username || "");
    const username = String(user.username || userId || "");
    if (!userId || !username) return;
    const users = readJson(KNOWN_USERS_KEY, {});
    users[userId] = { userId, username, role: user.role || "user", status: user.status || "active" };
    writeJson(KNOWN_USERS_KEY, users);
  }

  function markRead(scope, id) {
    const user = currentUser();
    if (!user) return;
    const read = readJson(READ_KEY, {});
    read[safeUserId(user)] = read[safeUserId(user)] || {};
    read[safeUserId(user)][`${scope}:${id}`] = new Date().toISOString();
    writeJson(READ_KEY, read);
    updateBadges();
  }

  function getLastRead(scope, id) {
    const user = currentUser();
    if (!user) return "";
    return readJson(READ_KEY, {})[safeUserId(user)]?.[`${scope}:${id}`] || "";
  }

  async function listGlobalMessages() {
    if (Api.apiListGlobalMessages && Api.hasConfiguredApiUrl()) {
      try {
        const result = await Api.apiListGlobalMessages(Auth.token());
        return (result.messages || []).slice(-MAX_MESSAGES);
      } catch {
        return readJson(GLOBAL_KEY, []);
      }
    }
    return readJson(GLOBAL_KEY, []);
  }

  async function sendGlobalMessage(text) {
    const user = currentUser();
    if (!user) throw new Error("Debes iniciar sesion para chatear.");
    const cleanText = normalizeText(text);
    if (!cleanText) throw new Error("No puedes enviar mensajes vacios.");
    if (Date.now() - lastSendAt < SEND_COOLDOWN_MS) throw new Error("Espera un momento antes de enviar otro mensaje.");
    lastSendAt = Date.now();

    const message = {
      messageId: makeId("gmsg"),
      scope: "global",
      fromUserId: safeUserId(user),
      fromUsername: user.username,
      text: cleanText,
      createdAt: new Date().toISOString()
    };
    writeJson(GLOBAL_KEY, [...readJson(GLOBAL_KEY, []), message].slice(-MAX_MESSAGES));

    if (Api.apiCreateGlobalMessage && Api.hasConfiguredApiUrl()) {
      try {
        const result = await Api.apiCreateGlobalMessage(Auth.token(), cleanText);
        const saved = result.message || message;
        writeJson(GLOBAL_KEY, [...readJson(GLOBAL_KEY, []).filter(item => item.messageId !== message.messageId && item.messageId !== saved.messageId), saved].slice(-MAX_MESSAGES));
        return saved;
      } catch (error) {
        if (!String(error.message || "").includes("soportada")) throw error;
      }
    }
    return message;
  }

  async function listPrivateMessages(peerId) {
    const user = currentUser();
    if (!user) return [];
    const cid = conversationId(safeUserId(user), peerId);
    if (Api.apiListPrivateMessages && Api.hasConfiguredApiUrl()) {
      try {
        const result = await Api.apiListPrivateMessages(Auth.token(), peerId);
        return (result.messages || []).slice(-MAX_MESSAGES);
      } catch {
        return readJson(PRIVATE_KEY, {})[cid] || [];
      }
    }
    return readJson(PRIVATE_KEY, {})[cid] || [];
  }

  async function sendPrivateMessage(peer, text) {
    const user = currentUser();
    if (!user) throw new Error("Debes iniciar sesion para chatear.");
    const peerId = String(peer.userId || peer.username || "");
    if (!peerId) throw new Error("No se encontro el usuario destino.");
    if (peerId === safeUserId(user)) throw new Error("No puedes chatear contigo mismo.");
    const cleanText = normalizeText(text);
    if (!cleanText) throw new Error("No puedes enviar mensajes vacios.");
    if (Date.now() - lastSendAt < SEND_COOLDOWN_MS) throw new Error("Espera un momento antes de enviar otro mensaje.");
    lastSendAt = Date.now();

    const message = {
      messageId: makeId("pmsg"),
      scope: "private",
      conversationId: conversationId(safeUserId(user), peerId),
      fromUserId: safeUserId(user),
      fromUsername: user.username,
      toUserId: peerId,
      toUsername: peer.username || peerId,
      text: cleanText,
      createdAt: new Date().toISOString(),
      status: "Enviando..."
    };
    const all = readJson(PRIVATE_KEY, {});
    all[message.conversationId] = [...(all[message.conversationId] || []), message].slice(-MAX_MESSAGES);
    writeJson(PRIVATE_KEY, all);

    if (Api.apiCreatePrivateMessage && Api.hasConfiguredApiUrl()) {
      try {
        const result = await Api.apiCreatePrivateMessage(Auth.token(), peerId, cleanText);
        replacePrivateMessage(message.conversationId, message.messageId, { ...(result.message || message), status: "Mensaje enviado" });
        return result.message || message;
      } catch (error) {
        if (String(error.message || "").includes("soportada")) {
          replacePrivateMessage(message.conversationId, message.messageId, { ...message, status: "Mensaje enviado" });
          return message;
        }
        replacePrivateMessage(message.conversationId, message.messageId, { ...message, status: "Error al enviar" });
        throw error;
      }
    }
    replacePrivateMessage(message.conversationId, message.messageId, { ...message, status: "Mensaje enviado" });
    return message;
  }

  function replacePrivateMessage(cid, tempId, next) {
    const all = readJson(PRIVATE_KEY, {});
    all[cid] = (all[cid] || []).map(item => item.messageId === tempId ? next : item);
    writeJson(PRIVATE_KEY, all);
  }

  function renderMessage(message, mine = false) {
    return `
      <article class="chat-message ${mine ? "mine" : "theirs"}" data-message-id="${UI.escapeHTML(message.messageId)}">
        <a class="chat-avatar" href="#/profile/${encodeURIComponent(message.fromUserId || message.fromUsername)}">${avatar(message.fromUsername)}</a>
        <div class="chat-bubble">
          <div class="chat-meta">
            <a href="#/profile/${encodeURIComponent(message.fromUserId || message.fromUsername)}">@${UI.escapeHTML(message.fromUsername || "usuario")}</a>
            <span>${UI.formatDate(message.createdAt)}</span>
          </div>
          <p>${UI.escapeHTML(message.text)}</p>
          ${message.status ? `<small>${UI.escapeHTML(message.status)}</small>` : ""}
        </div>
      </article>
    `;
  }

  async function renderGlobal() {
    if (!UI.requireSession()) return;
    UI.renderApp(`
      <div class="feed-layout chat-layout">
        ${Feed.sidebar("Chat")}
        <section class="chat-panel" data-chat-scope="global">
          <header class="chat-header">
            <div><span class="badge-alert">Comunidad</span><h1>Chat Global</h1></div>
            <a class="ghost-btn" href="#/feed">Volver</a>
          </header>
          <div id="chatMessages" class="chat-messages">${UI.skeletonPosts(1)}</div>
          <form id="globalChatForm" class="chat-compose">
            <input name="message" maxlength="700" autocomplete="off" placeholder="Escribe un mensaje para la comunidad..." />
            <button class="warning-btn" type="submit">Enviar</button>
          </form>
        </section>
      </div>
    `);
    await refreshGlobalMessages(true);
    bindGlobalForm();
    markRead("global", "main");
    startPolling();
  }

  async function refreshGlobalMessages(scroll = false) {
    const box = document.getElementById("chatMessages");
    if (!box || box.closest("[data-chat-scope]")?.dataset.chatScope !== "global") return;
    const messages = await listGlobalMessages();
    const userId = safeUserId();
    box.innerHTML = messages.length
      ? messages.map(message => renderMessage(message, message.fromUserId === userId)).join("")
      : `<div class="chat-empty">No hay mensajes todavia. Empieza la conversacion.</div>`;
    if (scroll) box.scrollTop = box.scrollHeight;
  }

  function bindGlobalForm() {
    const form = document.getElementById("globalChatForm");
    if (!form) return;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const button = form.querySelector("button");
      try {
        UI.setLoading(button, true, "Enviando...");
        await sendGlobalMessage(form.message.value);
        form.reset();
        await refreshGlobalMessages(true);
        markRead("global", "main");
      } catch (error) {
        UI.toast(error.message, "error");
      } finally {
        UI.setLoading(button, false);
      }
    });
  }

  async function renderPrivate(peerId) {
    if (!UI.requireSession()) return;
    const peer = await resolvePeer(peerId);
    if (!peer?.userId) {
      UI.renderApp(UI.emptyState("Usuario no encontrado", "No se pudo abrir esta conversacion.", `<a class="warning-btn inline-btn" href="#/feed">Volver</a>`));
      return;
    }
    if (peer.userId === safeUserId()) {
      UI.toast("No puedes chatear contigo mismo.", "warning");
      location.hash = "#/profile";
      return;
    }
    UI.renderApp(`
      <div class="feed-layout chat-layout">
        ${Feed.sidebar("Chat")}
        <section class="chat-panel" data-chat-scope="private" data-peer-id="${UI.escapeHTML(peer.userId)}" data-peer-name="${UI.escapeHTML(peer.username)}">
          <header class="chat-header">
            <div><span class="badge-alert">Mensaje privado</span><h1>@${UI.escapeHTML(peer.username)}</h1></div>
            <a class="ghost-btn" href="#/profile/${encodeURIComponent(peer.userId)}">Perfil</a>
          </header>
          <div id="chatMessages" class="chat-messages">${UI.skeletonPosts(1)}</div>
          <form id="privateChatForm" class="chat-compose">
            <input name="message" maxlength="700" autocomplete="off" placeholder="Escribe un mensaje privado..." />
            <button class="warning-btn" type="submit">Enviar</button>
          </form>
        </section>
      </div>
    `);
    await refreshPrivateMessages(peer, true);
    bindPrivateForm(peer);
    markRead("private", peer.userId);
    startPolling();
  }

  async function resolvePeer(peerId) {
    const id = decodeURIComponent(String(peerId || ""));
    if (Api.apiGetUserProfile && Api.hasConfiguredApiUrl()) {
      try {
        const result = await Api.apiGetUserProfile(Auth.token(), id);
        if (result.user) return result.user;
      } catch {}
    }
    return collectKnownUsers().find(user => user.userId === id || user.username === id) || { userId: id, username: id.replace(/^usr_/, "usuario") };
  }

  function collectKnownUsers() {
    const users = [];
    const seen = new Set();
    const add = (userId, username) => {
      const id = String(userId || username || "");
      if (!id || seen.has(id)) return;
      seen.add(id);
      users.push({ userId: id, username: String(username || id) });
    };
    const current = currentUser();
    if (current) add(safeUserId(current), current.username);
    Object.values(readJson(KNOWN_USERS_KEY, {})).forEach(user => add(user.userId, user.username));
    readJson(GLOBAL_KEY, []).forEach(msg => add(msg.fromUserId, msg.fromUsername));
    Object.values(readJson(PRIVATE_KEY, {})).flat().forEach(msg => {
      add(msg.fromUserId, msg.fromUsername);
      add(msg.toUserId, msg.toUsername);
    });
    return users;
  }

  async function refreshPrivateMessages(peer, scroll = false) {
    const box = document.getElementById("chatMessages");
    const panel = box?.closest("[data-chat-scope='private']");
    if (!box || !panel || panel.dataset.peerId !== peer.userId) return;
    const messages = await listPrivateMessages(peer.userId);
    const userId = safeUserId();
    box.innerHTML = messages.length
      ? messages.map(message => renderMessage(message, message.fromUserId === userId)).join("")
      : `<div class="chat-empty">No hay mensajes todavia. Empieza la conversacion.</div>`;
    if (scroll) box.scrollTop = box.scrollHeight;
  }

  function bindPrivateForm(peer) {
    const form = document.getElementById("privateChatForm");
    if (!form) return;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const button = form.querySelector("button");
      try {
        UI.setLoading(button, true, "Enviando...");
        await sendPrivateMessage(peer, form.message.value);
        form.reset();
        await refreshPrivateMessages(peer, true);
        markRead("private", peer.userId);
      } catch (error) {
        await refreshPrivateMessages(peer, true);
        UI.toast(error.message, "error");
      } finally {
        UI.setLoading(button, false);
      }
    });
  }

  function unreadCounts() {
    const user = currentUser();
    if (!user) return { total: 0, global: 0, private: 0 };
    const userId = safeUserId(user);
    const globalRead = getLastRead("global", "main");
    const global = readJson(GLOBAL_KEY, []).filter(msg =>
      msg.fromUserId !== userId && (!globalRead || new Date(msg.createdAt) > new Date(globalRead))
    ).length;
    let privateCount = 0;
    Object.entries(readJson(PRIVATE_KEY, {})).forEach(([cid, messages]) => {
      if (!cid.includes(userId)) return;
      const peerId = cid.split("__").find(part => part !== userId) || "";
      const lastRead = getLastRead("private", peerId);
      privateCount += messages.filter(msg =>
        msg.toUserId === userId && msg.fromUserId !== userId && (!lastRead || new Date(msg.createdAt) > new Date(lastRead))
      ).length;
    });
    return { total: global + privateCount, global, private: privateCount };
  }

  function updateBadges() {
    const counts = unreadCounts();
    document.querySelectorAll("[data-chat-badge], #topChatBadge").forEach(badge => {
      badge.textContent = String(Math.min(counts.total, 99));
      badge.classList.toggle("hidden", counts.total <= 0);
    });
  }

  function notifyIfNeeded() {
    const counts = unreadCounts();
    if (counts.total <= 0 || Date.now() - lastToastAt < 5000) return;
    const path = (location.hash || "").replace(/^#/, "").split("?")[0];
    if (path !== "/chat" && counts.global > 0) {
      UI.toast("Hay mensajes nuevos en el chat global.", "info");
      lastToastAt = Date.now();
    } else if (counts.private > 0 && !path.startsWith("/chat/")) {
      UI.toast("Tienes mensajes privados nuevos.", "info");
      lastToastAt = Date.now();
    }
  }

  function startPolling() {
    window.clearInterval(pollTimer);
    pollTimer = window.setInterval(async () => {
      const panel = document.querySelector("[data-chat-scope]");
      if (panel?.dataset.chatScope === "global") await refreshGlobalMessages(false);
      if (panel?.dataset.chatScope === "private") await refreshPrivateMessages({ userId: panel.dataset.peerId, username: panel.dataset.peerName }, false);
      updateBadges();
    }, 1600);
  }

  window.addEventListener("storage", () => {
    updateBadges();
    notifyIfNeeded();
  });
  window.addEventListener("bau-chat-updated", updateBadges);
  window.addEventListener("hashchange", updateBadges);
  document.addEventListener("DOMContentLoaded", () => {
    updateBadges();
    startPolling();
  });

  return { renderGlobal, renderPrivate, updateBadges, markRead, collectKnownUsers, rememberUser };
})();
