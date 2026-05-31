const Chat = (() => {
  const GLOBAL_KEY = "bau_chat_global_v1";
  const PRIVATE_KEY = "bau_chat_private_v1";
  const READ_KEY = "bau_chat_read_v1";
  const KNOWN_USERS_KEY = "bau_known_users_v1";
  const MAX_MESSAGES = 200;
  const SEND_COOLDOWN_MS = 900;
  const MAX_CHAT_IMAGE_BYTES = 4 * 1024 * 1024;
  const BACKEND_CHAT_ERROR = "El chat necesita que vuelvas a desplegar apps-script/Code.gs y ejecutes setupSheets() para crear ChatMessages.";
  let lastSendAt = 0;
  let pollTimer = null;
  let lastToastAt = 0;
  let backendChatAvailable = true;

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

  function getConversationLabel(cid, userId) {
    return cid.split("__").find(part => part !== userId) || cid;
  }

  function rememberUser(user = {}) {
    const userId = String(user.userId || user.username || "");
    const username = String(user.username || userId || "");
    if (!userId || !username) return;
    const users = readJson(KNOWN_USERS_KEY, {});
    users[userId] = { userId, username, role: user.role || "user", status: user.status || "active" };
    writeJson(KNOWN_USERS_KEY, users);
  }

  function isUnsupportedBackendError(error) {
    const message = String(error?.message || "");
    return message.includes("soportada") || message.includes("ChatMessages") || message.includes("Falta la hoja");
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
      } catch (error) {
        if (isUnsupportedBackendError(error)) backendChatAvailable = false;
        return readJson(GLOBAL_KEY, []);
      }
    }
    return readJson(GLOBAL_KEY, []);
  }

  async function sendGlobalMessage(text, media = {}) {
    const user = currentUser();
    if (!user) throw new Error("Debes iniciar sesion para chatear.");
    const cleanText = normalizeText(text);
    if (!cleanText && !media.mediaUrl) throw new Error("No puedes enviar mensajes vacios.");
    if (Date.now() - lastSendAt < SEND_COOLDOWN_MS) throw new Error("Espera un momento antes de enviar otro mensaje.");
    lastSendAt = Date.now();

    const message = {
      messageId: makeId("gmsg"),
      scope: "global",
      fromUserId: safeUserId(user),
      fromUsername: user.username,
      text: cleanText || "Imagen",
      mediaUrl: media.mediaUrl || "",
      mediaType: media.mediaType || "",
      createdAt: new Date().toISOString()
    };
    writeJson(GLOBAL_KEY, [...readJson(GLOBAL_KEY, []), message].slice(-MAX_MESSAGES));

    if (Api.apiCreateGlobalMessage && Api.hasConfiguredApiUrl()) {
      try {
        const result = await Api.apiCreateGlobalMessage(Auth.token(), cleanText || "Imagen", media);
        const saved = result.message || message;
        writeJson(GLOBAL_KEY, [...readJson(GLOBAL_KEY, []).filter(item => item.messageId !== message.messageId && item.messageId !== saved.messageId), saved].slice(-MAX_MESSAGES));
        return saved;
      } catch (error) {
        writeJson(GLOBAL_KEY, readJson(GLOBAL_KEY, []).filter(item => item.messageId !== message.messageId));
        if (isUnsupportedBackendError(error)) {
          backendChatAvailable = false;
          throw new Error(BACKEND_CHAT_ERROR);
        }
        throw error;
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
      } catch (error) {
        if (isUnsupportedBackendError(error)) backendChatAvailable = false;
        return readJson(PRIVATE_KEY, {})[cid] || [];
      }
    }
    return readJson(PRIVATE_KEY, {})[cid] || [];
  }

  async function sendPrivateMessage(peer, text, media = {}) {
    const user = currentUser();
    if (!user) throw new Error("Debes iniciar sesion para chatear.");
    const peerId = String(peer.userId || peer.username || "");
    if (!peerId) throw new Error("No se encontro el usuario destino.");
    if (peerId === safeUserId(user)) throw new Error("No puedes chatear contigo mismo.");
    const cleanText = normalizeText(text);
    if (!cleanText && !media.mediaUrl) throw new Error("No puedes enviar mensajes vacios.");
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
      text: cleanText || "Imagen",
      mediaUrl: media.mediaUrl || "",
      mediaType: media.mediaType || "",
      createdAt: new Date().toISOString(),
      status: "Enviando..."
    };
    const all = readJson(PRIVATE_KEY, {});
    all[message.conversationId] = [...(all[message.conversationId] || []), message].slice(-MAX_MESSAGES);
    writeJson(PRIVATE_KEY, all);

    if (Api.apiCreatePrivateMessage && Api.hasConfiguredApiUrl()) {
      try {
        const result = await Api.apiCreatePrivateMessage(Auth.token(), peerId, cleanText || "Imagen", media);
        replacePrivateMessage(message.conversationId, message.messageId, { ...(result.message || message), status: "Mensaje enviado" });
        return result.message || message;
      } catch (error) {
        if (isUnsupportedBackendError(error)) {
          backendChatAvailable = false;
          replacePrivateMessage(message.conversationId, message.messageId, { ...message, status: "Error: backend de chat no actualizado" });
          throw new Error(BACKEND_CHAT_ERROR);
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
    const avatarEl = typeof Profile !== "undefined" ? Profile.renderAvatar(message.fromUsername, 32) : `<div class="chat-avatar-initials">${UI.escapeHTML(String(message.fromUsername || "?").slice(0, 2).toUpperCase())}</div>`;
    return `
      <article class="chat-message ${mine ? "mine" : "theirs"}" data-message-id="${UI.escapeHTML(message.messageId)}">
        <a class="chat-avatar-link" href="#/profile/${encodeURIComponent(message.fromUserId || message.fromUsername)}">${avatarEl}</a>
        <div class="chat-bubble">
          <div class="chat-meta">
            <a href="#/profile/${encodeURIComponent(message.fromUserId || message.fromUsername)}">@${UI.escapeHTML(message.fromUsername || "usuario")}</a>
            <span>${UI.formatDate(message.createdAt)}</span>
          </div>
          ${message.mediaType === "image" && message.mediaUrl ? `<a href="${UI.escapeHTML(message.mediaUrl)}" target="_blank" rel="noopener"><img class="chat-image" src="${UI.escapeHTML(message.mediaUrl)}" alt="Imagen enviada por ${UI.escapeHTML(message.fromUsername || "usuario")}"></a>` : ""}
          <p>${UI.escapeHTML(message.text)}</p>
          ${message.status ? `<small class="chat-status">${UI.escapeHTML(message.status)}</small>` : ""}
        </div>
      </article>
    `;
  }

  function renderConversationList() {
    const user = currentUser();
    if (!user) return;
    const userId = safeUserId(user);
    const allPrivate = readJson(PRIVATE_KEY, {});
    const globalCount = unreadCounts().global;

    const conversations = Object.entries(allPrivate)
      .filter(([cid]) => cid.includes(userId))
      .map(([cid, messages]) => {
        const peerId = getConversationLabel(cid, userId);
        const lastMsg = messages[messages.length - 1];
        const lastRead = getLastRead("private", peerId);
        const unread = messages.filter(msg =>
          msg.fromUserId !== userId && msg.toUserId === userId && (!lastRead || new Date(msg.createdAt) > new Date(lastRead))
        ).length;
        const peerName = lastMsg
          ? (lastMsg.fromUserId === peerId ? lastMsg.fromUsername : lastMsg.toUsername)
          : peerId;
        return { cid, peerId, peerName, lastMsg, unread };
      })
      .sort((a, b) => {
        const aTime = a.lastMsg ? new Date(a.lastMsg.createdAt).getTime() : 0;
        const bTime = b.lastMsg ? new Date(b.lastMsg.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    return `
      <div class="chat-layout-inner">
        <aside class="chat-conversations">
          <div class="chat-conv-header">
            <h2>Chats</h2>
            <span class="chat-global-badge" data-chat-badge>${Math.min(globalCount, 99)}</span>
          </div>
          <a class="chat-conv-item ${location.hash === "#/chat-global" ? "active" : ""}" href="#/chat-global">
            <div class="chat-conv-avatar">💬</div>
            <div class="chat-conv-info">
              <strong>Chat Global</strong>
              <small>Comunidad en vivo</small>
            </div>
            ${globalCount > 0 ? `<span class="chat-unread-badge">${Math.min(globalCount, 99)}</span>` : ""}
          </a>
          <div class="chat-conv-divider">Mensajes privados</div>
          ${conversations.length === 0 ? `
            <div class="chat-conv-empty">
              <span class="chat-conv-empty-icon">💌</span>
              <p>Todavía no tienes conversaciones privadas</p>
              <small>Ve al perfil de un usuario y haz clic en "Mensaje"</small>
            </div>
          ` : conversations.map(conv => `
            <a class="chat-conv-item ${location.hash === `#/chat/${encodeURIComponent(conv.peerId)}` ? "active" : ""}" href="#/chat/${encodeURIComponent(conv.peerId)}">
              <div class="chat-conv-avatar">${typeof Profile !== "undefined" ? Profile.renderAvatar(conv.peerName, 36) : `<span class="chat-avatar-init">${UI.escapeHTML(conv.peerName.slice(0, 2).toUpperCase())}</span>`}</div>
              <div class="chat-conv-info">
                <strong>@${UI.escapeHTML(conv.peerName)}</strong>
                <small>${conv.lastMsg ? UI.escapeHTML(conv.lastMsg.text.slice(0, 40)) + (conv.lastMsg.text.length > 40 ? "..." : "") : "Sin mensajes"}</small>
              </div>
              <div class="chat-conv-meta">
                ${conv.lastMsg ? `<span class="chat-conv-time">${formatTimeAgo(conv.lastMsg.createdAt)}</span>` : ""}
                ${conv.unread > 0 ? `<span class="chat-unread-badge">${Math.min(conv.unread, 99)}</span>` : ""}
              </div>
            </a>
          `).join("")}
        </aside>
        <section class="chat-panel-placeholder">
          <div class="chat-placeholder-inner">
            <span class="chat-placeholder-icon">💬</span>
            <h3>Selecciona un chat</h3>
            <p>Elige una conversación de la lista para comenzar</p>
          </div>
        </section>
      </div>
    `;
  }

  function renderConversationsSidebar() {
    const user = currentUser();
    if (!user) return "";
    const userId = safeUserId(user);
    const allPrivate = readJson(PRIVATE_KEY, {});

    const items = Object.entries(allPrivate)
      .filter(([cid]) => cid.includes(userId))
      .map(([cid, messages]) => {
        const peerId = getConversationLabel(cid, userId);
        const lastMsg = messages[messages.length - 1];
        const lastRead = getLastRead("private", peerId);
        const unread = messages.filter(msg =>
          msg.fromUserId !== userId && msg.toUserId === userId && (!lastRead || new Date(msg.createdAt) > new Date(lastRead))
        ).length;
        const peerName = lastMsg
          ? (lastMsg.fromUserId === peerId ? lastMsg.fromUsername : lastMsg.toUsername)
          : peerId;
        return { peerId, peerName, lastMsg, unread };
      })
      .sort((a, b) => {
        const aTime = a.lastMsg ? new Date(a.lastMsg.createdAt).getTime() : 0;
        const bTime = b.lastMsg ? new Date(b.lastMsg.createdAt).getTime() : 0;
        return bTime - aTime;
      });

    return `<aside class="chat-sidebar">
      <div class="chat-sidebar-header">
        <h3>Conversaciones</h3>
        <a href="#/chat" class="chat-sidebar-all">Ver todas</a>
      </div>
      ${items.length === 0 ? `
        <div class="chat-sidebar-empty">
          <p>Sin conversaciones aún</p>
          <small>Envía un mensaje desde un perfil</small>
        </div>
      ` : items.slice(0, 5).map(conv => `
        <a class="chat-sidebar-item" href="#/chat/${encodeURIComponent(conv.peerId)}">
          <div class="chat-sidebar-avatar">${typeof Profile !== "undefined" ? Profile.renderAvatar(conv.peerName, 28) : ""}</div>
          <div class="chat-sidebar-info">
            <strong>@${UI.escapeHTML(conv.peerName)}</strong>
            <small>${conv.lastMsg ? UI.escapeHTML(conv.lastMsg.text.slice(0, 25)) + (conv.lastMsg.text.length > 25 ? "..." : "") : ""}</small>
          </div>
          ${conv.unread > 0 ? `<span class="chat-unread-badge small">${Math.min(conv.unread, 9)}</span>` : ""}
        </a>
      `).join("")}
    </aside>`;
  }

  function formatTimeAgo(isoString) {
    if (!isoString) return "";
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(isoString).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  }

  async function renderGlobal() {
    if (!UI.requireSession()) return;
    UI.renderApp(`
      <div class="feed-layout chat-layout">
        ${Feed.sidebar("Chat")}
        <div class="chat-layout-inner">
          <section class="chat-panel" data-chat-scope="global">
            <header class="chat-header">
              <div><span class="badge-alert">Comunidad</span><h1>Chat Global</h1></div>
              <a class="ghost-btn" href="#/chat">Volver</a>
            </header>
            <div id="chatMessages" class="chat-messages">${UI.skeletonPosts(1)}</div>
            <form id="globalChatForm" class="chat-compose">
              <input name="message" maxlength="700" autocomplete="off" placeholder="Escribe un mensaje para la comunidad..." />
              <label class="chat-image-button" title="Adjuntar imagen">
                <input type="file" name="image" accept="image/*" />
                📷
              </label>
              <button class="warning-btn" type="submit">Enviar</button>
              <div class="chat-image-preview hidden" data-chat-image-preview></div>
            </form>
          </section>
          ${renderConversationsSidebar()}
        </div>
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
      : `<div class="chat-empty">No hay mensajes todavía. Empieza la conversación.</div>`;
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
        const media = await prepareImageAttachment(form);
        await sendGlobalMessage(form.message.value, media);
        form.reset();
        clearImagePreview(form);
        await refreshGlobalMessages(true);
        markRead("global", "main");
      } catch (error) {
        UI.toast(error.message, "error");
      } finally {
        UI.setLoading(button, false);
      }
    });
    bindImagePreview(form);
  }

  async function renderPrivate(peerId) {
    if (!UI.requireSession()) return;
    const peer = await resolvePeer(peerId);
    if (!peer?.userId) {
      UI.renderApp(UI.emptyState("Usuario no encontrado", "No se pudo abrir esta conversación.", `<a class="warning-btn inline-btn" href="#/chat">Volver</a>`));
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
        <div class="chat-layout-inner">
          ${renderConversationsSidebar()}
          <section class="chat-panel" data-chat-scope="private" data-peer-id="${UI.escapeHTML(peer.userId)}" data-peer-name="${UI.escapeHTML(peer.username)}">
            <header class="chat-header">
              <div class="chat-header-peer">
                <a href="#/profile/${encodeURIComponent(peer.userId)}" class="chat-header-avatar">${typeof Profile !== "undefined" ? Profile.renderAvatar(peer.username, 36) : ""}</a>
                <div>
                  <h1>@${UI.escapeHTML(peer.username)}</h1>
                  <span class="chat-header-status">En línea</span>
                </div>
              </div>
              <a class="ghost-btn" href="#/profile/${encodeURIComponent(peer.userId)}">Perfil</a>
            </header>
            <div id="chatMessages" class="chat-messages">${UI.skeletonPosts(1)}</div>
            <form id="privateChatForm" class="chat-compose">
              <input name="message" maxlength="700" autocomplete="off" placeholder="Escribe un mensaje privado..." />
              <label class="chat-image-button" title="Adjuntar imagen">
                <input type="file" name="image" accept="image/*" />
                📷
              </label>
              <button class="warning-btn" type="submit">Enviar</button>
              <div class="chat-image-preview hidden" data-chat-image-preview></div>
            </form>
          </section>
        </div>
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
      : `<div class="chat-empty">No hay mensajes todavía. Empieza la conversación.</div>`;
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
        const media = await prepareImageAttachment(form);
        await sendPrivateMessage(peer, form.message.value, media);
        form.reset();
        clearImagePreview(form);
        await refreshPrivateMessages(peer, true);
        markRead("private", peer.userId);
      } catch (error) {
        await refreshPrivateMessages(peer, true);
        UI.toast(error.message, "error");
      } finally {
        UI.setLoading(button, false);
      }
    });
    bindImagePreview(form);
  }

  function bindImagePreview(form) {
    if (!form || form.dataset.imagePreviewBound === "true") return;
    form.dataset.imagePreviewBound = "true";
    form.image?.addEventListener("change", () => {
      const file = form.image.files?.[0];
      const preview = form.querySelector("[data-chat-image-preview]");
      if (!preview) return;
      if (!file) return clearImagePreview(form);
      const validation = validateImage(file);
      if (!validation.allowed) {
        UI.toast(validation.message, "warning");
        form.image.value = "";
        clearImagePreview(form);
        return;
      }
      const url = URL.createObjectURL(file);
      preview.classList.remove("hidden");
      preview.innerHTML = `
        <img src="${url}" alt="Vista previa de imagen">
        <button type="button" class="mini-btn" data-remove-chat-image>Quitar</button>
      `;
      preview.querySelector("[data-remove-chat-image]")?.addEventListener("click", () => {
        URL.revokeObjectURL(url);
        form.image.value = "";
        clearImagePreview(form);
      });
    });
  }

  async function prepareImageAttachment(form) {
    const file = form?.image?.files?.[0];
    if (!file) return {};
    const validation = validateImage(file);
    if (!validation.allowed) throw new Error(validation.message);
    if (Api.hasConfiguredApiUrl()) {
      const uploaded = await Api.apiUploadMedia(Auth.token(), {
        name: file.name,
        mimeType: file.type,
        mediaType: "image",
        size: file.size,
        content: await readFileAsBase64(file)
      });
      return { mediaUrl: uploaded.mediaUrl, mediaType: "image" };
    }
    return { mediaUrl: await readFileAsDataUrl(file), mediaType: "image" };
  }

  function validateImage(file) {
    if (!file.type.startsWith("image/")) return { allowed: false, message: "Solo puedes enviar imagenes validas." };
    if (file.size > MAX_CHAT_IMAGE_BYTES) return { allowed: false, message: "La imagen del chat no puede superar 4 MB." };
    return { allowed: true };
  }

  function clearImagePreview(form) {
    const preview = form?.querySelector("[data-chat-image-preview]");
    if (!preview) return;
    preview.classList.add("hidden");
    preview.innerHTML = "";
  }

  function readFileAsBase64(file) {
    return readFileAsDataUrl(file).then(value => String(value).split(",")[1] || "");
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
      reader.readAsDataURL(file);
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
    if (path !== "/chat" && path !== "/chat-global" && counts.global > 0) {
      if (typeof Notifications !== "undefined") {
        Notifications.add("chat", "Chat global", "Hay mensajes nuevos en el chat comunitario", "#/chat-global", "💬");
      }
      UI.toast("Hay mensajes nuevos en el chat global.", "info");
      lastToastAt = Date.now();
    } else if (counts.private > 0 && !path.startsWith("/chat/")) {
      if (typeof Notifications !== "undefined") {
        Notifications.add("chat", "Mensaje privado", "Tienes mensajes privados sin leer", "#/chat", "✉️");
      }
      UI.toast("Tienes mensajes privados nuevos.", "info");
      lastToastAt = Date.now();
    }
  }

  function startPolling() {
    window.clearInterval(pollTimer);
    pollTimer = window.setInterval(async () => {
      if (Api.hasConfiguredApiUrl() && !backendChatAvailable) {
        updateBadges();
        return;
      }
      const panel = document.querySelector("[data-chat-scope]");
      if (panel?.dataset.chatScope === "global") await refreshGlobalMessages(false);
      if (panel?.dataset.chatScope === "private") await refreshPrivateMessages({ userId: panel.dataset.peerId, username: panel.dataset.peerName }, false);
      updateBadges();
    }, 3000);
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

  return { renderGlobal, renderPrivate, renderConversationList, renderConversationsSidebar, updateBadges, markRead, collectKnownUsers, rememberUser };
})();
