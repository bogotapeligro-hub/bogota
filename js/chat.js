const Chat = (() => {
  const GLOBAL_KEY = "bau_chat_global_v1";
  const LEGACY_PRIVATE_KEY = "bau_chat_private_v1";
  const PRIVATE_CHATS_KEY = "bau_private_chats_v2";
  const KNOWN_USERS_KEY = "bau_known_users_v1";
  const MAX_MESSAGES = 200;
  const RENDER_MESSAGE_LIMIT = 80;
  const SEND_COOLDOWN_MS = 700;
  const MAX_CHAT_IMAGE_BYTES = 4 * 1024 * 1024;
  const BACKEND_CHAT_ERROR = "El chat necesita que vuelvas a desplegar apps-script/Code.gs y ejecutes setupSheets() para crear ChatMessages.";

  let privateChatsCache = null;
  let lastSendAt = 0;
  let pollTimer = null;
  let lastToastAt = 0;
  let backendChatAvailable = true;
  let lastNotifiedMessageIds = new Set(readJson("bau_chat_notified_messages_v1", []));

  const currentUser = () => Auth.user();
  const safeUserId = (user = currentUser()) => String(user?.userId || user?.username || "guest");

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function dispatchChatUpdated(detail = {}) {
    window.dispatchEvent(new CustomEvent("bau-chat-updated", { detail }));
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

  function isUnsupportedBackendError(error) {
    const message = String(error?.message || "");
    return message.includes("soportada") || message.includes("ChatMessages") || message.includes("Falta la hoja");
  }

  function rememberUser(user = {}) {
    const userId = String(user.userId || user.fromUserId || user.toUserId || user.username || "");
    const username = String(user.username || user.fromUsername || user.toUsername || userId || "");
    if (!userId || !username) return;
    const users = readJson(KNOWN_USERS_KEY, {});
    users[userId] = { userId, username, role: user.role || "user", status: user.status || "active" };
    writeJson(KNOWN_USERS_KEY, users);
  }

  function knownUser(id, fallbackName = "") {
    const key = String(id || "");
    const found = readJson(KNOWN_USERS_KEY, {})[key];
    if (found) return found;
    return { userId: key, username: fallbackName || key.replace(/^usr_/, "usuario") || "usuario" };
  }

  function normalizeMessage(raw = {}) {
    const senderId = String(raw.senderId || raw.fromUserId || "");
    const receiverId = String(raw.receiverId || raw.toUserId || "");
    return {
      id: String(raw.id || raw.messageId || makeId("msg")),
      messageId: String(raw.messageId || raw.id || ""),
      senderId,
      receiverId,
      fromUserId: senderId,
      toUserId: receiverId,
      fromUsername: String(raw.fromUsername || raw.senderName || senderId || "usuario"),
      toUsername: String(raw.toUsername || raw.receiverName || receiverId || "usuario"),
      text: String(raw.text || ""),
      mediaUrl: String(raw.mediaUrl || ""),
      mediaType: String(raw.mediaType || ""),
      createdAt: raw.createdAt || new Date().toISOString(),
      readBy: Array.isArray(raw.readBy) ? raw.readBy : String(raw.readBy || senderId).split(",").filter(Boolean),
      status: String(raw.status || "")
    };
  }

  function normalizeChat(raw = {}) {
    const messages = (raw.messages || []).map(normalizeMessage).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const last = messages[messages.length - 1];
    const participants = Array.isArray(raw.participants) ? raw.participants.map(String) : String(raw.chatId || "").split("__").filter(Boolean);
    const chatId = raw.chatId || raw.conversationId || (participants.length >= 2 ? conversationId(participants[0], participants[1]) : "");
    return {
      chatId,
      conversationId: chatId,
      participants,
      peerNames: raw.peerNames || {},
      lastMessage: raw.lastMessage || last?.text || "",
      lastMessageAt: raw.lastMessageAt || last?.createdAt || raw.updatedAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || last?.createdAt || new Date().toISOString(),
      unreadBy: raw.unreadBy || {},
      messages
    };
  }

  function migrateLegacyPrivateChats() {
    const legacy = readJson(LEGACY_PRIVATE_KEY, {});
    if (!legacy || Array.isArray(legacy) || !Object.keys(legacy).length) return [];
    return Object.entries(legacy).map(([cid, messages]) => {
      const normalizedMessages = (messages || []).map(normalizeMessage);
      const participants = cid.split("__").filter(Boolean);
      const peerNames = {};
      normalizedMessages.forEach(message => {
        peerNames[message.senderId] = message.fromUsername;
        peerNames[message.receiverId] = message.toUsername;
      });
      const unreadBy = {};
      normalizedMessages.forEach(message => {
        if (!message.readBy.includes(message.receiverId)) unreadBy[message.receiverId] = (unreadBy[message.receiverId] || 0) + 1;
      });
      return normalizeChat({ chatId: cid, participants, peerNames, unreadBy, messages: normalizedMessages });
    });
  }

  function loadPrivateChats(force = false) {
    if (privateChatsCache && !force) return privateChatsCache;
    const stored = readJson(PRIVATE_CHATS_KEY, null);
    if (Array.isArray(stored)) {
      privateChatsCache = stored.map(normalizeChat).filter(chat => chat.chatId && chat.participants.length >= 2);
      return privateChatsCache;
    }
    privateChatsCache = migrateLegacyPrivateChats();
    savePrivateChats(privateChatsCache, { silent: true });
    return privateChatsCache;
  }

  function savePrivateChats(chats, options = {}) {
    privateChatsCache = chats.map(normalizeChat).filter(chat => chat.chatId && chat.participants.length >= 2);
    writeJson(PRIVATE_CHATS_KEY, privateChatsCache);
    if (!options.silent) dispatchChatUpdated({ source: "private-chats" });
  }

  function findChatByPeer(peerId) {
    const userId = safeUserId();
    const cid = conversationId(userId, peerId);
    return loadPrivateChats().find(chat => chat.chatId === cid);
  }

  function upsertChat(peer, updater) {
    const user = currentUser();
    if (!user) throw new Error("Debes iniciar sesion para chatear.");
    const userId = safeUserId(user);
    const peerId = String(peer.userId || peer.username || "");
    if (!peerId) throw new Error("No se encontro el usuario destino.");
    const cid = conversationId(userId, peerId);
    const chats = loadPrivateChats();
    let chat = chats.find(item => item.chatId === cid);
    if (!chat) {
      chat = normalizeChat({
        chatId: cid,
        participants: [userId, peerId].sort(),
        peerNames: { [userId]: user.username, [peerId]: peer.username || peerId },
        unreadBy: { [userId]: 0, [peerId]: 0 },
        messages: []
      });
      chats.push(chat);
    }
    chat.peerNames[userId] = user.username;
    chat.peerNames[peerId] = peer.username || chat.peerNames[peerId] || peerId;
    updater(chat, userId, peerId);
    chat.messages = chat.messages.slice(-MAX_MESSAGES);
    const last = chat.messages[chat.messages.length - 1];
    if (last) {
      chat.lastMessage = last.text || "Imagen";
      chat.lastMessageAt = last.createdAt;
      chat.updatedAt = last.createdAt;
    }
    savePrivateChats(chats);
    return chat;
  }

  async function loadBackendConversations() {
    if (!Api.apiListPrivateConversations || !Api.hasConfiguredApiUrl() || !backendChatAvailable || !Auth.token()) return [];
    try {
      const result = await Api.apiListPrivateConversations(Auth.token());
      const chats = (result.conversations || []).map(chat => normalizeChat({
        chatId: chat.chatId || chat.conversationId,
        participants: chat.participants,
        peerNames: chat.peerNames,
        unreadBy: chat.unreadBy,
        messages: chat.messages || []
      }));
      mergePrivateChats(chats);
      return chats;
    } catch (error) {
      if (isUnsupportedBackendError(error)) backendChatAvailable = false;
      return [];
    }
  }

  function mergePrivateChats(incoming = []) {
    if (!incoming.length) return;
    const byId = new Map(loadPrivateChats().map(chat => [chat.chatId, chat]));
    incoming.forEach(remote => {
      const existing = byId.get(remote.chatId);
      if (!existing) {
        byId.set(remote.chatId, remote);
        return;
      }
      const messagesById = new Map(existing.messages.map(message => [message.id || message.messageId, message]));
      remote.messages.forEach(message => {
        messagesById.set(message.id || message.messageId, { ...(messagesById.get(message.id || message.messageId) || {}), ...message });
      });
      existing.messages = Array.from(messagesById.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      existing.peerNames = { ...existing.peerNames, ...remote.peerNames };
      existing.unreadBy = { ...existing.unreadBy, ...remote.unreadBy };
      const last = existing.messages[existing.messages.length - 1];
      existing.lastMessage = last?.text || existing.lastMessage;
      existing.lastMessageAt = last?.createdAt || existing.lastMessageAt;
      existing.updatedAt = last?.createdAt || existing.updatedAt;
    });
    savePrivateChats(Array.from(byId.values()));
  }

  async function listGlobalMessages() {
    if (Api.apiListGlobalMessages && Api.hasConfiguredApiUrl()) {
      try {
        const result = await Api.apiListGlobalMessages(Auth.token());
        return (result.messages || []).slice(-MAX_MESSAGES);
      } catch (error) {
        if (isUnsupportedBackendError(error)) backendChatAvailable = false;
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
    dispatchChatUpdated({ source: "global" });

    if (Api.apiCreateGlobalMessage && Api.hasConfiguredApiUrl()) {
      try {
        const result = await Api.apiCreateGlobalMessage(Auth.token(), cleanText || "Imagen", media);
        const saved = result.message || message;
        writeJson(GLOBAL_KEY, [...readJson(GLOBAL_KEY, []).filter(item => item.messageId !== message.messageId && item.messageId !== saved.messageId), saved].slice(-MAX_MESSAGES));
        dispatchChatUpdated({ source: "global" });
        return saved;
      } catch (error) {
        if (isUnsupportedBackendError(error)) backendChatAvailable = false;
        throw error;
      }
    }
    return message;
  }

  async function listPrivateMessages(peerId) {
    const chat = findChatByPeer(peerId);
    if (chat) return chat.messages.slice(-MAX_MESSAGES);
    await loadBackendConversations();
    return findChatByPeer(peerId)?.messages.slice(-MAX_MESSAGES) || [];
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

    const createdAt = new Date().toISOString();
    const message = normalizeMessage({
      id: makeId("pmsg"),
      senderId: safeUserId(user),
      receiverId: peerId,
      fromUsername: user.username,
      toUsername: peer.username || peerId,
      text: cleanText || "Imagen",
      mediaUrl: media.mediaUrl || "",
      mediaType: media.mediaType || "",
      createdAt,
      readBy: [safeUserId(user)],
      status: "Enviando..."
    });
    const chat = upsertChat(peer, (item, userId) => {
      item.messages.push(message);
      item.unreadBy[userId] = 0;
      item.unreadBy[peerId] = (Number(item.unreadBy[peerId] || 0) + 1);
    });
    createPrivateMessageNotification(chat, message);

    if (Api.apiCreatePrivateMessage && Api.hasConfiguredApiUrl()) {
      Api.apiCreatePrivateMessage(Auth.token(), peerId, cleanText || "Imagen", media).then((result) => {
        const saved = normalizeMessage({ ...(result.message || {}), id: result.message?.messageId || message.id, status: "Mensaje enviado" });
        replacePrivateMessage(chat.chatId, message.id, { ...message, ...saved, id: saved.id || message.id, status: "Mensaje enviado" });
      }).catch((error) => {
        if (isUnsupportedBackendError(error)) {
          backendChatAvailable = false;
          replacePrivateMessage(chat.chatId, message.id, { ...message, status: "Guardado localmente" });
          return;
        }
        replacePrivateMessage(chat.chatId, message.id, { ...message, status: "Error al enviar" });
        UI.toast(error.message, "error");
      });
      return message;
    }
    replacePrivateMessage(chat.chatId, message.id, { ...message, status: "Mensaje enviado" });
    return message;
  }

  function replacePrivateMessage(chatId, tempId, next) {
    const chats = loadPrivateChats();
    const chat = chats.find(item => item.chatId === chatId);
    if (!chat) return;
    chat.messages = chat.messages.map(item => item.id === tempId || item.messageId === tempId ? normalizeMessage(next) : item);
    const last = chat.messages[chat.messages.length - 1];
    if (last) {
      chat.lastMessage = last.text || "Imagen";
      chat.lastMessageAt = last.createdAt;
      chat.updatedAt = last.createdAt;
    }
    savePrivateChats(chats);
  }

  function createPrivateMessageNotification(chat, message) {
    if (typeof Notifications === "undefined") return;
    Notifications.addForUser?.({
      toUserId: message.receiverId,
      type: "private_message",
      title: `Nuevo mensaje de ${message.fromUsername}`,
      message: message.text,
      link: `#/chat/${encodeURIComponent(message.senderId)}`,
      emoji: "Msg",
      meta: { chatId: chat.chatId, messageId: message.id, fromUserId: message.senderId }
    });
  }

  function markRead(scope, id) {
    const user = currentUser();
    if (!user) return;
    if (scope === "private") {
      const userId = safeUserId(user);
      const chats = loadPrivateChats();
      const chat = chats.find(item => item.chatId === conversationId(userId, id));
      if (chat) {
        chat.unreadBy[userId] = 0;
        chat.messages.forEach(message => {
          if (message.receiverId === userId && !message.readBy.includes(userId)) message.readBy.push(userId);
        });
        savePrivateChats(chats);
      }
      Notifications.markChatAsRead?.(conversationId(userId, id));
      Api.apiMarkPrivateRead?.(Auth.token(), id).catch?.(() => {});
    } else {
      writeJson(`bau_chat_read_${scope}_${id}_${safeUserId(user)}`, new Date().toISOString());
      dispatchChatUpdated({ source: "read" });
    }
    updateBadges();
  }

  function getGlobalLastRead() {
    return readJson(`bau_chat_read_global_main_${safeUserId()}`, "");
  }

  function renderMessage(message, mine = false) {
    const normalized = normalizeMessage(message);
    const avatarEl = typeof Profile !== "undefined" ? Profile.renderAvatar(normalized.fromUsername, 32) : `<div class="chat-avatar-initials">${UI.escapeHTML(String(normalized.fromUsername || "?").slice(0, 2).toUpperCase())}</div>`;
    return `
      <article class="chat-message ${mine ? "mine" : "theirs"} ${normalized.status === "Enviando..." ? "sending" : ""}" data-message-id="${UI.escapeHTML(normalized.id)}">
        <a class="chat-avatar-link" href="#/profile/${encodeURIComponent(normalized.senderId)}">${avatarEl}</a>
        <div class="chat-bubble">
          <div class="chat-meta">
            <a href="#/profile/${encodeURIComponent(normalized.senderId)}">@${UI.escapeHTML(normalized.fromUsername || "usuario")}</a>
            <span>${UI.formatDate(normalized.createdAt)}</span>
          </div>
          ${normalized.mediaType === "image" && normalized.mediaUrl ? `<a href="${UI.escapeHTML(normalized.mediaUrl)}" target="_blank" rel="noopener"><img class="chat-image" loading="lazy" src="${UI.escapeHTML(normalized.mediaUrl)}" alt="Imagen enviada por ${UI.escapeHTML(normalized.fromUsername || "usuario")}"></a>` : ""}
          <p>${UI.escapeHTML(normalized.text)}</p>
          ${normalized.status ? `<small class="chat-status">${UI.escapeHTML(normalized.status)}</small>` : ""}
        </div>
      </article>
    `;
  }

  function conversationsForCurrentUser() {
    const user = currentUser();
    if (!user) return [];
    const userId = safeUserId(user);
    return loadPrivateChats()
      .filter(chat => chat.participants.includes(userId))
      .map(chat => {
        const peerId = chat.participants.find(part => part !== userId) || "";
        const lastMsg = chat.messages[chat.messages.length - 1];
        return {
          ...chat,
          peerId,
          peerName: chat.peerNames?.[peerId] || knownUser(peerId).username || peerId,
          lastMsg,
          unread: Number(chat.unreadBy?.[userId] || 0)
        };
      })
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }

  function renderConversationItem(conv, compact = false) {
    return `
      <a class="${compact ? "chat-sidebar-item" : "chat-conv-item"} ${location.hash === `#/chat/${encodeURIComponent(conv.peerId)}` ? "active" : ""}" href="#/chat/${encodeURIComponent(conv.peerId)}" data-chat-id="${UI.escapeHTML(conv.chatId)}" data-peer-id="${UI.escapeHTML(conv.peerId)}">
        <div class="${compact ? "chat-sidebar-avatar" : "chat-conv-avatar"}">${typeof Profile !== "undefined" ? Profile.renderAvatar(conv.peerName, compact ? 28 : 36) : ""}</div>
        <div class="${compact ? "chat-sidebar-info" : "chat-conv-info"}">
          <strong>@${UI.escapeHTML(conv.peerName)}</strong>
          <small>${conv.lastMsg ? UI.escapeHTML((conv.lastMsg.text || "Imagen").slice(0, compact ? 25 : 44)) + ((conv.lastMsg.text || "").length > (compact ? 25 : 44) ? "..." : "") : "Sin mensajes"}</small>
        </div>
        <div class="chat-conv-meta">
          ${conv.lastMsg ? `<span class="chat-conv-time">${formatTimeAgo(conv.lastMsg.createdAt)}</span>` : ""}
          ${conv.unread > 0 ? `<span class="chat-unread-badge ${compact ? "small" : ""}">${Math.min(conv.unread, 99)}</span>` : ""}
        </div>
      </a>
    `;
  }

  function renderConversationList() {
    const conversations = conversationsForCurrentUser();
    const globalCount = unreadCounts().global;
    loadBackendConversations().then(() => updateConversationLists()).catch(() => {});
    return `
      <div class="chat-layout-inner">
        <aside class="chat-conversations" id="chatConversationList">
          <div class="chat-conv-header">
            <h2>Chats</h2>
            <span class="chat-global-badge ${globalCount > 0 ? "" : "hidden"}" data-chat-badge>${Math.min(globalCount, 99)}</span>
          </div>
          <a class="chat-conv-item ${location.hash === "#/chat-global" ? "active" : ""}" href="#/chat-global">
            <div class="chat-conv-avatar">Chat</div>
            <div class="chat-conv-info"><strong>Chat Global</strong><small>Comunidad en vivo</small></div>
            ${globalCount > 0 ? `<span class="chat-unread-badge">${Math.min(globalCount, 99)}</span>` : ""}
          </a>
          <div class="chat-conv-divider">Mensajes privados</div>
          <div data-private-chat-list>
            ${conversations.length ? conversations.map(conv => renderConversationItem(conv)).join("") : renderEmptyConversations()}
          </div>
        </aside>
        <section class="chat-panel-placeholder">
          <div class="chat-placeholder-inner">
            <span class="chat-placeholder-icon">Chat</span>
            <h3>Selecciona un chat</h3>
            <p>Elige una conversacion de la lista para comenzar.</p>
          </div>
        </section>
      </div>
    `;
  }

  function renderEmptyConversations() {
    return `
      <div class="chat-conv-empty">
        <span class="chat-conv-empty-icon">Chat</span>
        <p>No tienes conversaciones privadas todavia</p>
        <small>Ve al perfil de un usuario y haz clic en "Enviar mensaje".</small>
      </div>
    `;
  }

  function renderConversationsSidebar() {
    const items = conversationsForCurrentUser();
    return `<aside class="chat-sidebar" id="chatSidebarList">
      <div class="chat-sidebar-header">
        <h3>Conversaciones</h3>
        <a href="#/chat" class="chat-sidebar-all">Ver todas</a>
      </div>
      <div data-private-chat-list>
        ${items.length ? items.slice(0, 5).map(conv => renderConversationItem(conv, true)).join("") : `
          <div class="chat-sidebar-empty"><p>Sin conversaciones aun</p><small>Envia un mensaje desde un perfil</small></div>
        `}
      </div>
    </aside>`;
  }

  function updateConversationLists() {
    const lists = document.querySelectorAll("[data-private-chat-list]");
    if (!lists.length) return;
    const conversations = conversationsForCurrentUser();
    lists.forEach(list => {
      const compact = Boolean(list.closest("#chatSidebarList"));
      list.innerHTML = conversations.length
        ? conversations.slice(0, compact ? 5 : conversations.length).map(conv => renderConversationItem(conv, compact)).join("")
        : renderEmptyConversations();
    });
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
              <label class="chat-image-button" title="Adjuntar imagen"><input type="file" name="image" accept="image/*" />Foto</label>
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
      ? messages.map(message => renderMessage(normalizeMessage(message), message.fromUserId === userId)).join("")
      : `<div class="chat-empty">No hay mensajes todavia. Empieza la conversacion.</div>`;
    if (scroll) box.scrollTop = box.scrollHeight;
  }

  function bindGlobalForm() {
    const form = document.getElementById("globalChatForm");
    if (!form || form.dataset.bound === "true") return;
    form.dataset.bound = "true";
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
    const localPeer = resolvePeerLocal(peerId);
    if (localPeer.userId === safeUserId()) {
      UI.toast("No puedes chatear contigo mismo.", "warning");
      location.hash = "#/profile";
      return;
    }
    renderPrivateShell(localPeer);
    refreshPrivateMessages(localPeer, true).then(() => markRead("private", localPeer.userId));
    bindPrivateForm(localPeer);
    markRead("private", localPeer.userId);
    startPolling();
    resolvePeer(peerId).then(peer => {
      if (!peer?.userId || peer.userId !== localPeer.userId) return;
      rememberUser(peer);
      const panel = document.querySelector("[data-chat-scope='private']");
      if (panel) {
        panel.dataset.peerName = peer.username;
        panel.querySelector("[data-chat-peer-name]").textContent = `@${peer.username}`;
        panel.querySelector("[data-chat-peer-avatar]").innerHTML = Profile.renderAvatar(peer.username, 36);
      }
    }).catch(() => {});
  }

  function renderPrivateShell(peer) {
    UI.renderApp(`
      <div class="feed-layout chat-layout">
        ${Feed.sidebar("Chat")}
        <div class="chat-layout-inner">
          ${renderConversationsSidebar()}
          <section class="chat-panel" data-chat-scope="private" data-peer-id="${UI.escapeHTML(peer.userId)}" data-peer-name="${UI.escapeHTML(peer.username)}">
            <header class="chat-header">
              <div class="chat-header-peer">
                <a href="#/profile/${encodeURIComponent(peer.userId)}" class="chat-header-avatar" data-chat-peer-avatar>${typeof Profile !== "undefined" ? Profile.renderAvatar(peer.username, 36) : ""}</a>
                <div><h1 data-chat-peer-name>@${UI.escapeHTML(peer.username)}</h1><span class="chat-header-status">Conversacion privada</span></div>
              </div>
              <a class="ghost-btn" href="#/profile/${encodeURIComponent(peer.userId)}">Perfil</a>
            </header>
            <div id="chatMessages" class="chat-messages"><div class="chat-message-skeleton">Cargando mensajes...</div></div>
            <form id="privateChatForm" class="chat-compose">
              <input name="message" maxlength="700" autocomplete="off" placeholder="Escribe un mensaje privado..." />
              <label class="chat-image-button" title="Adjuntar imagen"><input type="file" name="image" accept="image/*" />Foto</label>
              <button class="warning-btn" type="submit">Enviar</button>
              <div class="chat-image-preview hidden" data-chat-image-preview></div>
            </form>
          </section>
        </div>
      </div>
    `);
  }

  function resolvePeerLocal(peerId) {
    const id = decodeURIComponent(String(peerId || ""));
    const existing = collectKnownUsers().find(user => user.userId === id || user.username === id);
    if (existing) return existing;
    const chat = conversationsForCurrentUser().find(item => item.peerId === id);
    if (chat) return { userId: chat.peerId, username: chat.peerName };
    return { userId: id, username: id.replace(/^usr_/, "usuario") || "usuario" };
  }

  async function resolvePeer(peerId) {
    const local = resolvePeerLocal(peerId);
    if (Api.apiGetUserProfile && Api.hasConfiguredApiUrl()) {
      try {
        const result = await Api.apiGetUserProfile(Auth.token(), local.userId);
        if (result.user) return result.user;
      } catch {}
    }
    return local;
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
    loadPrivateChats().forEach(chat => {
      chat.participants.forEach(id => add(id, chat.peerNames?.[id]));
      chat.messages.forEach(msg => {
        add(msg.senderId, msg.fromUsername);
        add(msg.receiverId, msg.toUsername);
      });
    });
    return users;
  }

  async function refreshPrivateMessages(peer, scroll = false) {
    const box = document.getElementById("chatMessages");
    const panel = box?.closest("[data-chat-scope='private']");
    if (!box || !panel || panel.dataset.peerId !== peer.userId) return;
    const messages = await listPrivateMessages(peer.userId);
    const userId = safeUserId();
    const visible = messages.slice(-RENDER_MESSAGE_LIMIT);
    box.innerHTML = visible.length
      ? visible.map(message => renderMessage(message, message.senderId === userId || message.fromUserId === userId)).join("")
      : `<div class="chat-empty">Aun no hay mensajes. Escribe el primero.</div>`;
    if (scroll) requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
    updateConversationLists();
    updateBadges();
  }

  function appendPrivateMessageToOpenChat(message) {
    const panel = document.querySelector("[data-chat-scope='private']");
    const box = document.getElementById("chatMessages");
    const isOpenPeer = panel?.dataset.peerId === message.receiverId || panel?.dataset.peerId === message.senderId;
    if (!panel || !box || !isOpenPeer) return false;
    const messageId = window.CSS?.escape ? CSS.escape(String(message.id)) : String(message.id).replace(/"/g, '\\"');
    if (box.querySelector(`[data-message-id="${messageId}"]`)) return true;
    if (box.querySelector(".chat-empty, .chat-message-skeleton")) box.innerHTML = "";
    box.insertAdjacentHTML("beforeend", renderMessage(message, message.senderId === safeUserId()));
    requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
    return true;
  }

  function bindPrivateForm(peer) {
    const form = document.getElementById("privateChatForm");
    if (!form || form.dataset.bound === "true") return;
    form.dataset.bound = "true";
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const button = form.querySelector("button");
      const text = normalizeText(form.message.value);
      if (!text && !form.image?.files?.[0]) return UI.toast("No puedes enviar mensajes vacios.", "warning");
      try {
        UI.setLoading(button, true, "Enviando...");
        const media = await prepareImageAttachment(form);
        const message = await sendPrivateMessage(peer, text, media);
        appendPrivateMessageToOpenChat(normalizeMessage(message));
        form.reset();
        clearImagePreview(form);
        markRead("private", peer.userId);
        updateConversationLists();
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
      preview.innerHTML = `<img src="${url}" alt="Vista previa de imagen"><button type="button" class="mini-btn" data-remove-chat-image>Quitar</button>`;
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
    const globalRead = getGlobalLastRead();
    const global = readJson(GLOBAL_KEY, []).filter(msg => msg.fromUserId !== userId && (!globalRead || new Date(msg.createdAt) > new Date(globalRead))).length;
    const privateCount = conversationsForCurrentUser().reduce((total, chat) => total + Number(chat.unreadBy?.[userId] || 0), 0);
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
    const userId = safeUserId();
    if (!userId || userId === "guest") return;
    const path = (location.hash || "").replace(/^#/, "").split("?")[0];
    let didNotify = false;
    conversationsForCurrentUser().forEach(chat => {
      const last = chat.messages[chat.messages.length - 1];
      if (!last || last.receiverId !== userId || last.readBy.includes(userId) || lastNotifiedMessageIds.has(last.id)) return;
      lastNotifiedMessageIds.add(last.id);
      didNotify = true;
      if (!path.startsWith(`/chat/${encodeURIComponent(last.senderId)}`)) {
        UI.toast(`Nuevo mensaje de ${last.fromUsername}`, "info");
        if (typeof Notifications !== "undefined") {
          Notifications.addForUser?.({
            toUserId: userId,
            type: "private_message",
            title: `Nuevo mensaje de ${last.fromUsername}`,
            message: last.text,
            link: `#/chat/${encodeURIComponent(last.senderId)}`,
            emoji: "Msg",
            meta: { chatId: chat.chatId, messageId: last.id, fromUserId: last.senderId }
          });
        }
      }
    });
    if (didNotify) {
      writeJson("bau_chat_notified_messages_v1", Array.from(lastNotifiedMessageIds).slice(-300));
      lastToastAt = Date.now();
    } else if (unreadCounts().private > 0 && Date.now() - lastToastAt > 8000 && !path.startsWith("/chat/")) {
      lastToastAt = Date.now();
      UI.toast("Tienes mensajes privados sin leer.", "info");
    }
  }

  function startPolling() {
    window.clearInterval(pollTimer);
    pollTimer = window.setInterval(async () => {
      if (Api.hasConfiguredApiUrl() && backendChatAvailable) await loadBackendConversations();
      const panel = document.querySelector("[data-chat-scope]");
      if (panel?.dataset.chatScope === "global") await refreshGlobalMessages(false);
      if (panel?.dataset.chatScope === "private") await refreshPrivateMessages({ userId: panel.dataset.peerId, username: panel.dataset.peerName }, false);
      updateConversationLists();
      updateBadges();
      notifyIfNeeded();
    }, 2500);
  }

  window.addEventListener("storage", event => {
    if ([PRIVATE_CHATS_KEY, GLOBAL_KEY, "bau_notifications_v2"].includes(event.key)) {
      loadPrivateChats(true);
      updateConversationLists();
      updateBadges();
      notifyIfNeeded();
    }
  });
  window.addEventListener("bau-chat-updated", () => {
    const panel = document.querySelector("[data-chat-scope='private']");
    if (panel?.dataset.peerId) {
      refreshPrivateMessages({ userId: panel.dataset.peerId, username: panel.dataset.peerName }, false);
    }
    updateConversationLists();
    updateBadges();
    notifyIfNeeded();
  });
  window.addEventListener("hashchange", updateBadges);
  document.addEventListener("DOMContentLoaded", () => {
    loadPrivateChats();
    updateBadges();
    startPolling();
  });

  return {
    renderGlobal,
    renderPrivate,
    renderConversationList,
    renderConversationsSidebar,
    updateBadges,
    markRead,
    collectKnownUsers,
    rememberUser,
    sendPrivateMessage,
    listPrivateMessages
  };
})();
