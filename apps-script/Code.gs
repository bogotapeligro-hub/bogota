/**
 * Bogotá Alerta Urbana - Google Apps Script Backend
 * Base de datos: Google Sheets.
 * Despliegue: Implementar > Nueva implementación > Aplicación web.
 * Acceso recomendado para MVP: Cualquier usuario con el enlace.
 */

const SPREADSHEET_ID = "1KUbVWF4I4WNRj0jIhQ-pOBdgDGMeyfFQa_UC7NZkgUc";

const SHEETS = {
  Users: ["userId", "username", "passwordHash", "salt", "role", "status", "createdAt", "lastLoginAt", "ageConfirmed"],
  Posts: ["postId", "userId", "username", "category", "title", "description", "location", "mediaUrl", "mediaType", "tags", "createdAt", "status", "moderationFlags", "reactionCount", "commentCount", "reportCount", "isSensitive", "blurFaces", "anonymous", "alertLevel", "source", "verificationStatus", "confirmCount", "doubtCount", "viewCount", "removedBy", "removedAt", "removeReason", "reviewedBy", "reviewedAt"],
  Comments: ["commentId", "postId", "userId", "username", "text", "createdAt", "status", "reportCount", "removedBy", "removedAt", "removeReason", "reviewedBy", "reviewedAt"],
  Reactions: ["reactionId", "targetType", "targetId", "userId", "reaction", "createdAt"],
  Reports: ["reportId", "targetType", "targetId", "userId", "reason", "details", "createdAt", "status"],
  Sessions: ["sessionId", "userId", "tokenHash", "createdAt", "expiresAt", "active"],
  AuditLog: ["logId", "userId", "action", "targetType", "targetId", "details", "createdAt"],
  RuletaQueue: ["queueId", "userId", "username", "status", "matchId", "createdAt", "updatedAt"],
  RuletaMatches: ["matchId", "status", "player1Id", "player1Username", "player2Id", "player2Username", "stateJson", "createdAt", "updatedAt"],
  CasinoGameQueue: ["queueId", "gameType", "userId", "username", "status", "matchId", "createdAt", "updatedAt"],
  CasinoGameMatches: ["matchId", "gameType", "status", "player1Id", "player1Username", "player2Id", "player2Username", "stateJson", "createdAt", "updatedAt"],
  ChatMessages: ["messageId", "scope", "conversationId", "fromUserId", "fromUsername", "toUserId", "toUsername", "text", "mediaUrl", "mediaType", "createdAt", "readBy"]
};

const SESSION_DAYS = 7;
const MEDIA_FOLDER_NAME = "Bogota Alerta Urbana Media";
const MEDIA_FOLDER_ID = "1-m77wkfWBnl7YATQmyvXkvpQLGbyxSgq";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const DEFAULT_POST_STATUS = "active"; // Cambiar a "pending" si deseas revisión previa.
const ALLOWED_CATEGORIES = ["Manifestacion", "Reporte ciudadano", "Incidente", "Pelea / contenido sensible", "Accidente", "Denuncia", "Alerta", "Evento", "Trafico", "Seguridad", "Comunidad", "Juego / entretenimiento", "Short", "Movilidad", "Emergencia", "Otro", "Pelea", "Manifestación", "Robo / inseguridad", "Problema en la calle"];
const ALLOWED_REACTIONS = ["Me impacta", "Alerta", "Confirmo", "No confirmado", "Cuidado", "Apoyo"];
const ALLOWED_REPORT_REASONS = ["Violencia explicita", "Acoso", "Datos personales", "Menores de edad", "Contenido falso", "Amenazas", "Incitacion a violencia", "Spam", "Menores involucrados", "Contenido sexual", "Violencia contra menores", "Amenaza o incitación", "Contenido demasiado gráfico", "Otro"];
const ALLOWED_ROLES = ["user", "moderator", "admin"];
const ALLOWED_USER_STATUSES = ["active", "blocked", "deleted"];
const ALLOWED_CONTENT_STATUSES = ["active", "pending", "hidden", "removed", "reviewed"];
const ALLOWED_REPORT_STATUSES = ["open", "reviewed", "dismissed"];
const RULETA_POWER_IDS = ["manzana", "doble", "esposas", "escudo", "scanner", "cambio", "recarga", "curita"];
const SHEETS_READY_CACHE_KEY = "bau_sheets_ready_v5";

function doGet() {
  return jsonResponse({ success: true, message: "Bogotá Alerta Urbana API activa", data: { ok: true } });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}");
    const action = body.action;
    const payload = body.payload || {};
    let data;

    switch (action) {
      case "register": data = registerUser(payload); break;
      case "login": data = loginUser(payload); break;
      case "getCurrentUser": data = getCurrentUser(payload); break;
      case "uploadMedia": data = uploadMedia(payload); break;
      case "createPost": data = createPost(payload); break;
      case "listPosts": data = listPosts(); break;
      case "getPost": data = getPost(payload); break;
      case "createComment": data = createComment(payload); break;
      case "react": data = react(payload); break;
      case "report": data = reportContent(payload); break;
      case "adminDashboard": data = adminDashboard(payload); break;
      case "adminListReportedPosts": data = adminListReportedPosts(payload); break;
      case "adminListReportedComments": data = adminListReportedComments(payload); break;
      case "adminListReports": data = adminListReports(payload); break;
      case "adminUpdatePost": data = adminUpdatePost(payload); break;
      case "adminUpdatePostStatus": data = adminUpdatePostStatus(payload); break;
      case "adminUpdateCommentStatus": data = adminUpdateCommentStatus(payload); break;
      case "adminRemovePost": data = adminRemovePost(payload); break;
      case "adminRemoveComment": data = adminRemoveComment(payload); break;
      case "adminRestorePost": data = adminRestorePost(payload); break;
      case "adminRestoreComment": data = adminRestoreComment(payload); break;
      case "adminUpdateReportStatus": data = adminUpdateReportStatus(payload); break;
      case "adminListUsers": data = adminListUsers(payload); break;
      case "adminUpdateUser": data = adminUpdateUser(payload); break;
      case "adminUpdateUserRole": data = adminUpdateUserRole(payload); break;
      case "adminUpdateUserStatus": data = adminUpdateUserStatus(payload); break;
      case "adminListAuditLog": data = adminListAuditLog(payload); break;
      case "ruletaJoinMatch": data = ruletaJoinMatch(payload); break;
      case "ruletaGetMatch": data = ruletaGetMatch(payload); break;
      case "ruletaSaveMatch": data = ruletaSaveMatch(payload); break;
      case "ruletaCancelMatchmaking": data = ruletaCancelMatchmaking(payload); break;
      case "casinoJoinGameMatch": data = casinoJoinGameMatch(payload); break;
      case "casinoGetGameMatch": data = casinoGetGameMatch(payload); break;
      case "casinoSaveGameMatch": data = casinoSaveGameMatch(payload); break;
      case "casinoCancelGameMatchmaking": data = casinoCancelGameMatchmaking(payload); break;
      case "getUserProfile": data = getUserProfile(payload); break;
      case "listGlobalMessages": data = listGlobalMessages(payload); break;
      case "createGlobalMessage": data = createGlobalMessage(payload); break;
      case "listPrivateConversations": data = listPrivateConversations(payload); break;
      case "listPrivateMessages": data = listPrivateMessages(payload); break;
      case "createPrivateMessage": data = createPrivateMessage(payload); break;
      case "markPrivateRead": data = markPrivateRead(payload); break;
      default: throw new Error("Acción no soportada: " + action);
    }

    return jsonResponse({ success: true, data: data });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message || String(error) });
  }
}

/** Ejecuta esta función una vez para crear hojas y encabezados. */
function setupSheets() {
  const ss = getDatabaseSpreadsheet();
  Object.keys(SHEETS).forEach(function(name) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    const headers = SHEETS[name];
    const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const isEmpty = current.every(function(cell) { return !cell; });
    if (isEmpty) {
      sheet.clear();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      return;
    }
    headers.forEach(function(header, index) {
      const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
      if (existingHeaders.indexOf(header) === -1) {
        sheet.insertColumnBefore(index + 1);
        sheet.getRange(1, index + 1).setValue(header);
      }
    });
    sheet.setFrozenRows(1);
  });
  try {
    CacheService.getScriptCache().put(SHEETS_READY_CACHE_KEY, "1", 21600);
  } catch (error) {}
}

function ensureSheetsReady() {
  try {
    const cache = CacheService.getScriptCache();
    const ss = getDatabaseSpreadsheet();
    const missing = Object.keys(SHEETS).some(function(name) {
      return !ss.getSheetByName(name);
    });
    if (cache.get(SHEETS_READY_CACHE_KEY) === "1" && !missing) return;
    if (missing) {
      setupSheets();
      return;
    }
    cache.put(SHEETS_READY_CACHE_KEY, "1", 21600);
  } catch (error) {
    // Si CacheService falla, no hacemos setup completo en cada request.
    const ss = getDatabaseSpreadsheet();
    const missing = Object.keys(SHEETS).some(function(name) {
      return !ss.getSheetByName(name);
    });
    if (missing) setupSheets();
  }
}

/** Crea un admin inicial. Cambia credenciales antes de ejecutar. */
function createAdminUser() {
  const username = "admin";
  const password = "CAMBIA_ESTA_CLAVE_ADMIN";
  setupSheets();
  const users = getSheet("Users");
  const rows = sheetToObjects(users);
  if (rows.some(function(u) { return u.username === username; })) throw new Error("El admin ya existe.");
  const salt = makeSalt();
  const user = {
    userId: makeId("usr"), username: username, passwordHash: hashPassword(password, salt), salt: salt,
    role: "admin", status: "active", createdAt: now(), lastLoginAt: "", ageConfirmed: true
  };
  appendObject(users, SHEETS.Users, user);
}

function registerUser(payload) {
  ensureSheetsReady();
  const username = normalizeUsername(payload.username);
  const password = String(payload.password || "");
  const ageConfirmed = payload.ageConfirmed === true;

  if (!/^[a-z0-9_.-]{3,20}$/i.test(username)) throw new Error("Usuario inválido. Usa 3 a 20 caracteres: letras, números, punto, guion o guion bajo.");
  if (password.length < 6) throw new Error("La contraseña debe tener mínimo 6 caracteres.");
  if (!ageConfirmed) throw new Error("Debes confirmar que tienes 18 años o más.");

  const sheet = getSheet("Users");
  const users = sheetToObjects(sheet);
  if (users.some(function(u) { return u.username === username; })) throw new Error("Ese usuario ya existe.");

  const salt = makeSalt();
  const user = {
    userId: makeId("usr"), username: username, passwordHash: hashPassword(password, salt), salt: salt,
    role: "user", status: "active", createdAt: now(), lastLoginAt: "", ageConfirmed: true
  };
  appendObject(sheet, SHEETS.Users, user);
  audit(user.userId, "register", "user", user.userId, "Cuenta creada");
  return { user: publicUser(user) };
}

function loginUser(payload) {
  ensureSheetsReady();
  const username = normalizeUsername(payload.username);
  const password = String(payload.password || "");
  const usersSheet = getSheet("Users");
  const users = sheetToObjects(usersSheet);
  const userIndex = users.findIndex(function(u) { return u.username === username; });
  if (userIndex === -1) throw new Error("Usuario o contraseña incorrectos.");
  const user = users[userIndex];
  user.role = normalizeRole(user.role);
  user.status = normalizeUserStatus(user.status || "active");
  if (user.status !== "active") throw new Error("Usuario bloqueado o inactivo.");
  if (hashPassword(password, user.salt) !== user.passwordHash) throw new Error("Usuario o contraseña incorrectos.");

  const rawToken = Utilities.getUuid() + ":" + Utilities.getUuid();
  const tokenHash = sha256(rawToken);
  const createdAt = now();
  const expiresAtDate = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const expiresAt = expiresAtDate.toISOString();
  const session = { sessionId: makeId("ses"), userId: user.userId, tokenHash: tokenHash, createdAt: createdAt, expiresAt: expiresAt, active: true };
  appendObject(getSheet("Sessions"), SHEETS.Sessions, session);

  const rowNumber = userIndex + 2;
  usersSheet.getRange(rowNumber, SHEETS.Users.indexOf("lastLoginAt") + 1).setValue(createdAt);
  audit(user.userId, "login", "user", user.userId, "Inicio de sesión");

  return { token: rawToken, user: publicUser(user), expiresAt: expiresAt };
}

function getCurrentUser(payload) {
  const user = requireUser(payload.token);
  return { user: publicUser(user) };
}

function uploadMedia(payload) {
  const user = requireUser(payload.token);
  const file = payload.file || {};
  const name = clean(file.name) || "media";
  const mimeType = clean(file.mimeType).toLowerCase();
  const mediaType = clean(file.mediaType).toLowerCase();
  const content = String(file.content || "");
  const size = Number(file.size || 0);

  if (["image", "video"].indexOf(mediaType) === -1) throw new Error("Tipo de multimedia invalido.");
  if (mediaType === "image" && mimeType.indexOf("image/") !== 0) throw new Error("El archivo seleccionado no es una imagen.");
  if (mediaType === "video" && mimeType.indexOf("video/") !== 0) throw new Error("El archivo seleccionado no es un video.");
  if (!content) throw new Error("Archivo multimedia vacio.");
  if (mediaType === "image" && size > MAX_IMAGE_BYTES) throw new Error("La foto no puede superar 8 MB.");
  if (mediaType === "video" && size > MAX_VIDEO_BYTES) throw new Error("El video no puede superar 25 MB.");

  const bytes = Utilities.base64Decode(content);
  const safeName = makeSafeFileName(user.username + "_" + Date.now() + "_" + name);
  const blob = Utilities.newBlob(bytes, mimeType, safeName);
  const folder = getMediaFolder();
  const driveFile = folder.createFile(blob);
  driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = driveFile.getId();
  const mediaUrl = mediaType === "image"
    ? "https://drive.google.com/thumbnail?id=" + encodeURIComponent(fileId) + "&sz=w1600"
    : "https://drive.google.com/uc?export=download&id=" + encodeURIComponent(fileId);
  audit(user.userId, "uploadMedia", "media", fileId, mediaType + " | " + safeName);
  return { mediaUrl: mediaUrl, mediaType: mediaType, fileId: fileId, name: safeName };
}

function authorizeDriveOnce() {
  const folder = getMediaFolder();
  return "Drive autorizado. Carpeta multimedia: " + folder.getName();
}

function createPost(payload) {
  const user = requireUser(payload.token);
  const data = payload.data || {};
  const title = clean(data.title);
  const description = clean(data.description);
  const category = clean(data.category);
  const location = clean(data.location);
  const mediaUrl = clean(data.mediaUrl);
  let mediaType = clean(data.mediaType).toLowerCase();
  const tags = clean(data.tags);
  const mediaItems = parsePostMediaItems(mediaUrl, mediaType);
  const moderation = validateServerContent([title, description, location, tags, mediaUrl].join(" "));

  if (!title || title.length < 5) throw new Error("El título debe tener al menos 5 caracteres.");
  if (!description || description.length < 15) throw new Error("La descripción debe tener al menos 15 caracteres.");
  if (!isAllowedPostCategory(category)) throw new Error("Categoría inválida.");
  if (!mediaUrl) mediaType = "none";
  if (mediaUrl && !mediaItems.length) throw new Error("La multimedia debe tener URLs https validas.");
  if (["image", "video", "mixed", "none"].indexOf(mediaType) === -1) throw new Error("Tipo de multimedia invalido.");
  if (mediaUrl && mediaType === "none") throw new Error("Selecciona image o video para la URL multimedia.");
  if (mediaItems.filter(function(item) { return item.type === "image"; }).length > 5) throw new Error("Solo puedes subir maximo 5 fotos.");
  if (mediaItems.filter(function(item) { return item.type === "video"; }).length > 1) throw new Error("Solo puedes subir 1 video por publicacion.");
  if (!moderation.allowed) throw new Error(moderation.message);

  const post = {
    postId: makeId("post"), userId: user.userId, username: user.username, category: category,
    title: title, description: description, location: location, mediaUrl: mediaUrl, mediaType: mediaType, tags: tags,
    createdAt: now(), status: clean(data.status) || DEFAULT_POST_STATUS,
    moderationFlags: moderation.flags.join(" | "), reactionCount: 0, commentCount: 0, reportCount: 0,
    isSensitive: data.isSensitive === true || String(data.isSensitive) === "true" || isSensitivePostCategory(category),
    blurFaces: data.blurFaces === true || String(data.blurFaces) === "true",
    anonymous: data.anonymous === true || String(data.anonymous) === "true",
    alertLevel: normalizeAlertLevel(data.alertLevel),
    source: clean(data.source),
    verificationStatus: "pending",
    confirmCount: 0,
    doubtCount: 0,
    viewCount: 0
  };
  appendObject(getSheet("Posts"), SHEETS.Posts, post);
  audit(user.userId, "createPost", "post", post.postId, post.title);
  return { post: post };
}

function listPosts() {
  ensureSheetsReady();
  const posts = sheetToObjects(getSheet("Posts"))
    .filter(function(post) { return post.status === "active"; })
    .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })
    .slice(0, 80);
  return { posts: posts };
}

function getPost(payload) {
  ensureSheetsReady();
  const postId = clean(payload.postId);
  const posts = sheetToObjects(getSheet("Posts"));
  const post = posts.find(function(p) { return p.postId === postId; });
  if (!post) throw new Error("Publicación no encontrada.");
  const comments = sheetToObjects(getSheet("Comments"))
    .filter(function(c) { return c.postId === postId && c.status === "active"; })
    .sort(function(a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
  return { post: post, comments: comments };
}

function createComment(payload) {
  const user = requireUser(payload.token);
  const postId = clean(payload.postId);
  const text = clean(payload.text);
  const moderation = validateServerContent(text, true);
  if (!text || text.length < 2) throw new Error("El comentario es demasiado corto.");
  if (!moderation.allowed) throw new Error(moderation.message);

  const postsSheet = getSheet("Posts");
  const posts = sheetToObjects(postsSheet);
  const postIndex = posts.findIndex(function(p) { return p.postId === postId; });
  if (postIndex === -1) throw new Error("Publicación no encontrada.");

  const comment = { commentId: makeId("com"), postId: postId, userId: user.userId, username: user.username, text: text, createdAt: now(), status: "active", reportCount: 0 };
  appendObject(getSheet("Comments"), SHEETS.Comments, comment);
  incrementCell(postsSheet, postIndex + 2, "Posts", "commentCount", 1);
  audit(user.userId, "createComment", "post", postId, comment.commentId);
  return { comment: comment };
}

function getUserProfile(payload) {
  const requester = requireUser(payload.token);
  const lookup = clean(payload.userIdOrUsername);
  const users = sheetToObjects(getSheet("Users"));
  const user = users.find(function(u) {
    return String(u.userId) === lookup || String(u.username).toLowerCase() === lookup.toLowerCase();
  });
  if (!user) throw new Error("Usuario no encontrado.");
  const posts = sheetToObjects(getSheet("Posts"))
    .filter(function(post) { return post.status === "active" && post.userId === user.userId; })
    .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  audit(requester.userId, "getUserProfile", "user", user.userId, "Consulta perfil");
  return { user: publicUser(user), posts: posts };
}

function listGlobalMessages(payload) {
  requireUser(payload.token);
  ensureSheetsReady();
  const messages = sheetToObjects(getSheet("ChatMessages"))
    .filter(function(message) { return message.scope === "global"; })
    .sort(function(a, b) { return new Date(a.createdAt) - new Date(b.createdAt); })
    .slice(-200);
  return { messages: messages };
}

function createGlobalMessage(payload) {
  const user = requireUser(payload.token);
  const media = cleanChatMedia(payload.mediaUrl, payload.mediaType);
  const text = cleanChatText(payload.text || (media.mediaUrl ? "Imagen" : ""));
  const message = {
    messageId: makeId("gmsg"),
    scope: "global",
    conversationId: "global",
    fromUserId: user.userId,
    fromUsername: user.username,
    toUserId: "",
    toUsername: "",
    text: text,
    mediaUrl: media.mediaUrl,
    mediaType: media.mediaType,
    createdAt: now(),
    readBy: user.userId
  };
  appendObject(getSheet("ChatMessages"), SHEETS.ChatMessages, message);
  audit(user.userId, "createGlobalMessage", "chat", message.messageId, "Global");
  return { message: message };
}

function listPrivateConversations(payload) {
  const user = requireUser(payload.token);
  ensureSheetsReady();
  const messages = sheetToObjects(getSheet("ChatMessages"))
    .filter(function(message) {
      return message.scope === "private" && (message.fromUserId === user.userId || message.toUserId === user.userId);
    })
    .sort(function(a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });

  const conversationsById = {};
  messages.forEach(function(message) {
    const cid = message.conversationId || chatConversationId(message.fromUserId, message.toUserId);
    if (!conversationsById[cid]) {
      conversationsById[cid] = {
        chatId: cid,
        conversationId: cid,
        participants: cid.split("__"),
        peerNames: {},
        unreadBy: {},
        messages: []
      };
    }
    const conversation = conversationsById[cid];
    conversation.peerNames[message.fromUserId] = message.fromUsername || message.fromUserId;
    conversation.peerNames[message.toUserId] = message.toUsername || message.toUserId;
    conversation.messages.push(message);

    const readBy = String(message.readBy || "").split(",").filter(Boolean);
    if (message.toUserId === user.userId && readBy.indexOf(user.userId) === -1) {
      conversation.unreadBy[user.userId] = Number(conversation.unreadBy[user.userId] || 0) + 1;
    }
  });

  const conversations = Object.keys(conversationsById)
    .map(function(cid) {
      const conversation = conversationsById[cid];
      const last = conversation.messages[conversation.messages.length - 1] || {};
      conversation.lastMessage = last.text || (last.mediaUrl ? "Imagen" : "");
      conversation.lastMessageAt = last.createdAt || "";
      conversation.updatedAt = conversation.lastMessageAt;
      conversation.messages = conversation.messages.slice(-80);
      return conversation;
    })
    .sort(function(a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });

  return { conversations: conversations };
}

function listPrivateMessages(payload) {
  const user = requireUser(payload.token);
  const peer = findChatPeer(clean(payload.peerUserId));
  const cid = chatConversationId(user.userId, peer.userId);
  const messages = sheetToObjects(getSheet("ChatMessages"))
    .filter(function(message) { return message.scope === "private" && message.conversationId === cid; })
    .sort(function(a, b) { return new Date(a.createdAt) - new Date(b.createdAt); })
    .slice(-200);
  return { peer: publicUser(peer), conversationId: cid, messages: messages };
}

function createPrivateMessage(payload) {
  const user = requireUser(payload.token);
  const peer = findChatPeer(clean(payload.peerUserId));
  if (peer.userId === user.userId) throw new Error("No puedes chatear contigo mismo.");
  const media = cleanChatMedia(payload.mediaUrl, payload.mediaType);
  const text = cleanChatText(payload.text || (media.mediaUrl ? "Imagen" : ""));
  const cid = chatConversationId(user.userId, peer.userId);
  const message = {
    messageId: makeId("pmsg"),
    scope: "private",
    conversationId: cid,
    fromUserId: user.userId,
    fromUsername: user.username,
    toUserId: peer.userId,
    toUsername: peer.username,
    text: text,
    mediaUrl: media.mediaUrl,
    mediaType: media.mediaType,
    createdAt: now(),
    readBy: user.userId
  };
  appendObject(getSheet("ChatMessages"), SHEETS.ChatMessages, message);
  audit(user.userId, "createPrivateMessage", "chat", cid, "Privado a " + peer.userId);
  return { message: message, conversationId: cid };
}

function markPrivateRead(payload) {
  const user = requireUser(payload.token);
  const peer = findChatPeer(clean(payload.peerUserId));
  const cid = chatConversationId(user.userId, peer.userId);
  const sheet = getSheet("ChatMessages");
  const messages = sheetToObjects(sheet);
  messages.forEach(function(message, idx) {
    if (message.scope === "private" && message.conversationId === cid && message.toUserId === user.userId) {
      const readBy = String(message.readBy || "").split(",").filter(Boolean);
      if (readBy.indexOf(user.userId) === -1) {
        readBy.push(user.userId);
        sheet.getRange(idx + 2, SHEETS.ChatMessages.indexOf("readBy") + 1).setValue(readBy.join(","));
      }
    }
  });
  return { ok: true };
}

function findChatPeer(lookup) {
  const users = sheetToObjects(getSheet("Users"));
  const peer = users.find(function(u) {
    return String(u.userId) === lookup || String(u.username).toLowerCase() === lookup.toLowerCase();
  });
  if (!peer || normalizeUserStatus(peer.status || "active") !== "active") throw new Error("Usuario destino no encontrado.");
  return peer;
}

function chatConversationId(a, b) {
  return [String(a), String(b)].sort().join("__");
}

function cleanChatText(value) {
  const text = clean(value).replace(/\s+/g, " ").trim().slice(0, 700);
  if (!text) throw new Error("No puedes enviar mensajes vacios.");
  const moderation = validateServerContent(text, true);
  if (!moderation.allowed) throw new Error(moderation.message);
  return text;
}

function cleanChatMedia(mediaUrl, mediaType) {
  const url = clean(mediaUrl);
  const type = clean(mediaType).toLowerCase();
  if (!url && !type) return { mediaUrl: "", mediaType: "" };
  if (type !== "image") throw new Error("Por ahora el chat solo permite imagenes.");
  if (!isValidMediaUrl(url)) throw new Error("La imagen del chat debe tener una URL https valida.");
  return { mediaUrl: url, mediaType: type };
}

function react(payload) {
  const user = requireUser(payload.token);
  const targetType = clean(payload.targetType);
  const targetId = clean(payload.targetId);
  const reaction = clean(payload.reaction);
  if (["post", "comment"].indexOf(targetType) === -1) throw new Error("Tipo de destino inválido.");
  if (ALLOWED_REACTIONS.indexOf(reaction) === -1) throw new Error("Reacción inválida.");

  const sheet = getSheet("Reactions");
  const reactions = sheetToObjects(sheet);
  const existingIndex = reactions.findIndex(function(r) { return r.targetType === targetType && r.targetId === targetId && r.userId === user.userId; });
  if (existingIndex >= 0) {
    sheet.getRange(existingIndex + 2, SHEETS.Reactions.indexOf("reaction") + 1).setValue(reaction);
  } else {
    appendObject(sheet, SHEETS.Reactions, { reactionId: makeId("rea"), targetType: targetType, targetId: targetId, userId: user.userId, reaction: reaction, createdAt: now() });
  }

  if (targetType === "post") recalcPostCount(targetId, "reactionCount", "Reactions");
  audit(user.userId, "react", targetType, targetId, reaction);
  return { ok: true };
}

function reportContent(payload) {
  const user = requireUser(payload.token);
  const targetType = clean(payload.targetType);
  const targetId = clean(payload.targetId);
  const reason = clean(payload.reason);
  const details = clean(payload.details);

  if (["post", "comment"].indexOf(targetType) === -1) throw new Error("Tipo de reporte inválido.");
  if (!isAllowedReportReason(reason)) throw new Error("Motivo de reporte inválido.");

  const report = { reportId: makeId("rep"), targetType: targetType, targetId: targetId, userId: user.userId, reason: reason, details: details, createdAt: now(), status: "open" };
  appendObject(getSheet("Reports"), SHEETS.Reports, report);

  if (targetType === "post") {
    const postsSheet = getSheet("Posts");
    const posts = sheetToObjects(postsSheet);
    const idx = posts.findIndex(function(p) { return p.postId === targetId; });
    if (idx >= 0) {
      const newCount = incrementCell(postsSheet, idx + 2, "Posts", "reportCount", 1);
      if (newCount >= 3) postsSheet.getRange(idx + 2, SHEETS.Posts.indexOf("status") + 1).setValue("pending");
    }
  }

  if (targetType === "comment") {
    const commentsSheet = getSheet("Comments");
    const comments = sheetToObjects(commentsSheet);
    const idx = comments.findIndex(function(c) { return c.commentId === targetId; });
    if (idx >= 0) incrementCell(commentsSheet, idx + 2, "Comments", "reportCount", 1);
  }

  audit(user.userId, "report", targetType, targetId, reason);
  return { report: report };
}

function adminListReports(payload) {
  const user = requireAdmin(payload.token);
  const reports = sheetToObjects(getSheet("Reports")).sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  const posts = sheetToObjects(getSheet("Posts"))
    .filter(function(p) { return p.status === "reported" || p.status === "pending" || Number(p.reportCount || 0) > 0; })
    .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  audit(user.userId, "adminListReports", "system", "reports", "Consulta admin");
  return { reports: reports, posts: posts };
}

function adminUpdatePost(payload) {
  const user = requireAdmin(payload.token);
  const postId = clean(payload.postId);
  const status = clean(payload.status);
  if (["active", "pending", "hidden", "reported", "reviewed"].indexOf(status) === -1) throw new Error("Estado inválido.");
  const sheet = getSheet("Posts");
  const posts = sheetToObjects(sheet);
  const idx = posts.findIndex(function(p) { return p.postId === postId; });
  if (idx === -1) throw new Error("Publicación no encontrada.");
  sheet.getRange(idx + 2, SHEETS.Posts.indexOf("status") + 1).setValue(status);
  audit(user.userId, "adminUpdatePost", "post", postId, status);
  return { postId: postId, status: status };
}

function adminListUsers(payload) {
  const user = requireAdmin(payload.token);
  const users = sheetToObjects(getSheet("Users")).map(publicUser);
  audit(user.userId, "adminListUsers", "system", "users", "Consulta admin");
  return { users: users };
}

function adminUpdateUser(payload) {
  const user = requireAdmin(payload.token);
  const userId = clean(payload.userId);
  const status = clean(payload.status);
  if (["active", "blocked", "inactive"].indexOf(status) === -1) throw new Error("Estado inválido.");
  const sheet = getSheet("Users");
  const users = sheetToObjects(sheet);
  const idx = users.findIndex(function(u) { return u.userId === userId; });
  if (idx === -1) throw new Error("Usuario no encontrado.");
  sheet.getRange(idx + 2, SHEETS.Users.indexOf("status") + 1).setValue(status);
  audit(user.userId, "adminUpdateUser", "user", userId, status);
  return { userId: userId, status: status };
}

function adminDashboard(payload) {
  requireAdminOrModerator(payload.token);
  const posts = sheetToObjects(getSheet("Posts"));
  const comments = sheetToObjects(getSheet("Comments"));
  const users = sheetToObjects(getSheet("Users"));
  return {
    stats: {
      totalPosts: posts.length,
      reportedPosts: posts.filter(function(p) { return Number(p.reportCount || 0) > 0 || normalizeContentStatus(p.status) === "pending"; }).length,
      reportedComments: comments.filter(function(c) { return Number(c.reportCount || 0) > 0; }).length,
      activeUsers: users.filter(function(u) { return normalizeUserStatus(u.status || "active") === "active"; }).length,
      blockedUsers: users.filter(function(u) { return normalizeUserStatus(u.status || "active") === "blocked"; }).length
    }
  };
}

function adminListReportedPosts(payload) {
  requireAdminOrModerator(payload.token);
  const posts = sheetToObjects(getSheet("Posts"))
    .filter(function(p) {
      const status = normalizeContentStatus(p.status || "active");
      return Number(p.reportCount || 0) > 0 || ["pending", "hidden", "removed", "reviewed"].indexOf(status) !== -1;
    })
    .map(function(post) { return decorateReportedTarget(post, "post", post.postId); })
    .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  return { posts: posts };
}

function adminListReportedComments(payload) {
  requireAdminOrModerator(payload.token);
  const comments = sheetToObjects(getSheet("Comments"))
    .filter(function(c) {
      const status = normalizeContentStatus(c.status || "active");
      return Number(c.reportCount || 0) > 0 || ["hidden", "removed", "reviewed"].indexOf(status) !== -1;
    })
    .map(function(comment) { return decorateReportedTarget(comment, "comment", comment.commentId); })
    .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  return { comments: comments };
}

function adminListReports(payload) {
  const user = requireAdminOrModerator(payload.token);
  const reports = sheetToObjects(getSheet("Reports")).sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  const posts = adminListReportedPosts(payload).posts;
  const comments = adminListReportedComments(payload).comments;
  audit(user.userId, "admin_list_reports", "system", "reports", "Consulta admin");
  return { reports: reports, posts: posts, comments: comments };
}

function adminUpdatePost(payload) {
  return adminUpdatePostStatus(payload);
}

function adminUpdatePostStatus(payload) {
  const user = requireAdminOrModerator(payload.token);
  const postId = clean(payload.postId);
  const status = normalizeContentStatus(payload.status);
  if (ALLOWED_CONTENT_STATUSES.indexOf(status) === -1) throw new Error("Estado invalido.");
  updateContentStatus("Posts", "postId", postId, status, user, clean(payload.reason || payload.details));
  audit(user.userId, "admin_update_post_status", "post", postId, status);
  return { postId: postId, status: status };
}

function adminUpdateCommentStatus(payload) {
  const user = requireAdminOrModerator(payload.token);
  const commentId = clean(payload.commentId);
  const status = normalizeContentStatus(payload.status);
  if (ALLOWED_CONTENT_STATUSES.indexOf(status) === -1) throw new Error("Estado invalido.");
  updateContentStatus("Comments", "commentId", commentId, status, user, clean(payload.reason || payload.details));
  audit(user.userId, "admin_update_comment_status", "comment", commentId, status);
  return { commentId: commentId, status: status };
}

function adminRemovePost(payload) {
  const user = requireAdminOrModerator(payload.token);
  const postId = clean(payload.postId);
  removeContent("Posts", "postId", postId, user, clean(payload.reason || "Otro"), clean(payload.details));
  audit(user.userId, "admin_remove_post", "post", postId, clean(payload.reason || "Otro"));
  return { postId: postId, status: "removed" };
}

function adminRemoveComment(payload) {
  const user = requireAdminOrModerator(payload.token);
  const commentId = clean(payload.commentId);
  removeContent("Comments", "commentId", commentId, user, clean(payload.reason || "Otro"), clean(payload.details));
  audit(user.userId, "admin_remove_comment", "comment", commentId, clean(payload.reason || "Otro"));
  return { commentId: commentId, status: "removed" };
}

function adminRestorePost(payload) {
  const user = requireAdminOrModerator(payload.token);
  const postId = clean(payload.postId);
  updateContentStatus("Posts", "postId", postId, "active", user, "Restaurado");
  audit(user.userId, "admin_restore_post", "post", postId, "Restaurado");
  return { postId: postId, status: "active" };
}

function adminRestoreComment(payload) {
  const user = requireAdminOrModerator(payload.token);
  const commentId = clean(payload.commentId);
  updateContentStatus("Comments", "commentId", commentId, "active", user, "Restaurado");
  audit(user.userId, "admin_restore_comment", "comment", commentId, "Restaurado");
  return { commentId: commentId, status: "active" };
}

function adminUpdateReportStatus(payload) {
  const user = requireAdminOrModerator(payload.token);
  const reportId = clean(payload.reportId);
  const status = clean(payload.status).toLowerCase();
  if (ALLOWED_REPORT_STATUSES.indexOf(status) === -1) throw new Error("Estado de reporte invalido.");
  const found = findRowById("Reports", "reportId", reportId);
  setCellByHeader(found.sheet, found.rowNumber, "Reports", "status", status);
  audit(user.userId, "admin_review_report", "report", reportId, status);
  return { reportId: reportId, status: status };
}

function adminListUsers(payload) {
  const user = requireAdmin(payload.token);
  const users = sheetToObjects(getSheet("Users")).map(publicUser);
  audit(user.userId, "admin_list_users", "system", "users", "Consulta admin");
  return { users: users };
}

function adminUpdateUser(payload) {
  return adminUpdateUserStatus(payload);
}

function adminUpdateUserRole(payload) {
  const actor = requireAdmin(payload.token);
  const userId = clean(payload.userId);
  const role = normalizeRole(payload.role);
  if (ALLOWED_ROLES.indexOf(role) === -1) throw new Error("Rol invalido.");
  const found = findRowById("Users", "userId", userId);
  setCellByHeader(found.sheet, found.rowNumber, "Users", "role", role);
  audit(actor.userId, "admin_update_user_role", "user", userId, role);
  return { userId: userId, role: role };
}

function adminUpdateUserStatus(payload) {
  const actor = requireAdmin(payload.token);
  const userId = clean(payload.userId);
  const status = normalizeUserStatus(payload.status);
  if (ALLOWED_USER_STATUSES.indexOf(status) === -1) throw new Error("Estado invalido.");
  const found = findRowById("Users", "userId", userId);
  const target = found.object;
  if (normalizeRole(target.role) === "admin" && target.userId !== actor.userId && status !== "active") {
    throw new Error("No puedes bloquear o eliminar a otro administrador.");
  }
  setCellByHeader(found.sheet, found.rowNumber, "Users", "status", status);
  audit(actor.userId, "admin_update_user_status", "user", userId, status);
  return { userId: userId, status: status };
}

function adminListAuditLog(payload) {
  requireAdmin(payload.token);
  const logs = sheetToObjects(getSheet("AuditLog"))
    .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })
    .slice(0, 200);
  return { logs: logs };
}

function ruletaJoinMatch(payload) {
  const user = requireUser(payload.token);
  ensureSheetsReady();
  expireOldRuletaQueue();

  const active = findRuletaMatchForUser(user.userId);
  if (active) return { status: "matched", match: publicRuletaMatch(active, user) };

  const queueSheet = getSheet("RuletaQueue");
  const queue = sheetToObjects(queueSheet);
  const ownWaitingIndex = queue.findIndex(function(q) {
    return q.userId === user.userId && q.status === "waiting";
  });
  if (ownWaitingIndex >= 0) {
    return { status: "waiting", matchId: "", queueId: queue[ownWaitingIndex].queueId };
  }

  const otherIndex = queue.findIndex(function(q) {
    return q.userId !== user.userId && q.status === "waiting";
  });

  if (otherIndex >= 0) {
    const other = queue[otherIndex];
    const match = createRuletaMatch(
      { userId: other.userId, username: other.username },
      { userId: user.userId, username: user.username }
    );
    queueSheet.getRange(otherIndex + 2, SHEETS.RuletaQueue.indexOf("status") + 1).setValue("matched");
    queueSheet.getRange(otherIndex + 2, SHEETS.RuletaQueue.indexOf("matchId") + 1).setValue(match.matchId);
    queueSheet.getRange(otherIndex + 2, SHEETS.RuletaQueue.indexOf("updatedAt") + 1).setValue(now());
    audit(user.userId, "ruletaJoinMatch", "ruleta", match.matchId, "Partida creada");
    return { status: "matched", match: publicRuletaMatch(match, user) };
  }

  const queueRow = {
    queueId: makeId("rq"),
    userId: user.userId,
    username: user.username,
    status: "waiting",
    matchId: "",
    createdAt: now(),
    updatedAt: now()
  };
  appendObject(queueSheet, SHEETS.RuletaQueue, queueRow);
  audit(user.userId, "ruletaJoinQueue", "ruleta", queueRow.queueId, "Esperando rival");
  return { status: "waiting", queueId: queueRow.queueId, matchId: "" };
}

function ruletaGetMatch(payload) {
  const user = requireUser(payload.token);
  const matchId = clean(payload.matchId);
  const match = getRuletaMatchById(matchId);
  if (!match) throw new Error("Partida no encontrada.");
  assertRuletaMatchUser(match, user.userId);
  return { match: publicRuletaMatch(match, user) };
}

function ruletaSaveMatch(payload) {
  const user = requireUser(payload.token);
  const matchId = clean(payload.matchId);
  const match = getRuletaMatchById(matchId);
  if (!match) throw new Error("Partida no encontrada.");
  assertRuletaMatchUser(match, user.userId);

  const state = payload.state || {};
  const stateJson = JSON.stringify(state);
  if (stateJson.length > 45000) throw new Error("El estado de la partida es demasiado grande.");

  const sheet = getSheet("RuletaMatches");
  const matches = sheetToObjects(sheet);
  const idx = matches.findIndex(function(m) { return m.matchId === matchId; });
  const status = state.gameOver ? "finished" : "active";
  const updatedAt = now();
  sheet.getRange(idx + 2, SHEETS.RuletaMatches.indexOf("status") + 1).setValue(status);
  sheet.getRange(idx + 2, SHEETS.RuletaMatches.indexOf("stateJson") + 1).setValue(stateJson);
  sheet.getRange(idx + 2, SHEETS.RuletaMatches.indexOf("updatedAt") + 1).setValue(updatedAt);

  const updated = getRuletaMatchById(matchId);
  return { match: publicRuletaMatch(updated, user) };
}

function ruletaCancelMatchmaking(payload) {
  const user = requireUser(payload.token);
  const sheet = getSheet("RuletaQueue");
  const queue = sheetToObjects(sheet);
  queue.forEach(function(q, idx) {
    if (q.userId === user.userId && q.status === "waiting") {
      sheet.getRange(idx + 2, SHEETS.RuletaQueue.indexOf("status") + 1).setValue("cancelled");
      sheet.getRange(idx + 2, SHEETS.RuletaQueue.indexOf("updatedAt") + 1).setValue(now());
    }
  });
  audit(user.userId, "ruletaCancelQueue", "ruleta", user.userId, "Cancelo busqueda");
  return { ok: true };
}

function casinoJoinGameMatch(payload) {
  const user = requireUser(payload.token);
  ensureSheetsReady();
  expireOldCasinoGameQueue();
  const gameType = normalizeCasinoGameType(payload.gameType);

  const active = findCasinoGameMatchForUser(user.userId, gameType);
  if (active) return { status: "matched", match: publicCasinoGameMatch(active, user) };

  const queueSheet = getSheet("CasinoGameQueue");
  const queue = sheetToObjects(queueSheet);
  const ownWaitingIndex = queue.findIndex(function(q) {
    return q.gameType === gameType && q.userId === user.userId && q.status === "waiting";
  });
  if (ownWaitingIndex >= 0) {
    return { status: "waiting", matchId: "", queueId: queue[ownWaitingIndex].queueId };
  }

  const otherIndex = queue.findIndex(function(q) {
    return q.gameType === gameType && q.userId !== user.userId && q.status === "waiting";
  });

  if (otherIndex >= 0) {
    const other = queue[otherIndex];
    const match = createCasinoGameMatch(gameType,
      { userId: other.userId, username: other.username },
      { userId: user.userId, username: user.username }
    );
    queueSheet.getRange(otherIndex + 2, SHEETS.CasinoGameQueue.indexOf("status") + 1).setValue("matched");
    queueSheet.getRange(otherIndex + 2, SHEETS.CasinoGameQueue.indexOf("matchId") + 1).setValue(match.matchId);
    queueSheet.getRange(otherIndex + 2, SHEETS.CasinoGameQueue.indexOf("updatedAt") + 1).setValue(now());
    audit(user.userId, "casinoJoinGameMatch", "casino", match.matchId, gameType);
    return { status: "matched", match: publicCasinoGameMatch(match, user) };
  }

  const queueRow = {
    queueId: makeId("cgq"),
    gameType: gameType,
    userId: user.userId,
    username: user.username,
    status: "waiting",
    matchId: "",
    createdAt: now(),
    updatedAt: now()
  };
  appendObject(queueSheet, SHEETS.CasinoGameQueue, queueRow);
  audit(user.userId, "casinoJoinGameQueue", "casino", queueRow.queueId, gameType);
  return { status: "waiting", queueId: queueRow.queueId, matchId: "" };
}

function casinoGetGameMatch(payload) {
  const user = requireUser(payload.token);
  const matchId = clean(payload.matchId);
  const match = getCasinoGameMatchById(matchId);
  if (!match) throw new Error("Partida no encontrada.");
  assertCasinoGameMatchUser(match, user.userId);
  return { match: publicCasinoGameMatch(match, user) };
}

function casinoSaveGameMatch(payload) {
  const user = requireUser(payload.token);
  const matchId = clean(payload.matchId);
  const match = getCasinoGameMatchById(matchId);
  if (!match) throw new Error("Partida no encontrada.");
  assertCasinoGameMatchUser(match, user.userId);

  const state = payload.state || {};
  const stateJson = JSON.stringify(state);
  if (stateJson.length > 45000) throw new Error("El estado de la partida es demasiado grande.");

  const sheet = getSheet("CasinoGameMatches");
  const matches = sheetToObjects(sheet);
  const idx = matches.findIndex(function(m) { return m.matchId === matchId; });
  const status = state.gameOver ? "finished" : "active";
  const updatedAt = now();
  sheet.getRange(idx + 2, SHEETS.CasinoGameMatches.indexOf("status") + 1).setValue(status);
  sheet.getRange(idx + 2, SHEETS.CasinoGameMatches.indexOf("stateJson") + 1).setValue(stateJson);
  sheet.getRange(idx + 2, SHEETS.CasinoGameMatches.indexOf("updatedAt") + 1).setValue(updatedAt);
  return { match: publicCasinoGameMatch(getCasinoGameMatchById(matchId), user) };
}

function casinoCancelGameMatchmaking(payload) {
  const user = requireUser(payload.token);
  const gameType = normalizeCasinoGameType(payload.gameType);
  const sheet = getSheet("CasinoGameQueue");
  const queue = sheetToObjects(sheet);
  queue.forEach(function(q, idx) {
    if (q.gameType === gameType && q.userId === user.userId && q.status === "waiting") {
      sheet.getRange(idx + 2, SHEETS.CasinoGameQueue.indexOf("status") + 1).setValue("cancelled");
      sheet.getRange(idx + 2, SHEETS.CasinoGameQueue.indexOf("updatedAt") + 1).setValue(now());
    }
  });
  audit(user.userId, "casinoCancelGameQueue", "casino", user.userId, gameType);
  return { ok: true };
}

function createRuletaMatch(player1, player2) {
  const match = {
    matchId: makeId("rm"),
    status: "active",
    player1Id: player1.userId,
    player1Username: player1.username,
    player2Id: player2.userId,
    player2Username: player2.username,
    stateJson: JSON.stringify(createRuletaInitialState(player1, player2)),
    createdAt: now(),
    updatedAt: now()
  };
  appendObject(getSheet("RuletaMatches"), SHEETS.RuletaMatches, match);
  return match;
}

function createRuletaInitialState(player1, player2) {
  const chamber = generateRuletaChamber(4);
  return {
    mode: "online",
    round: 1,
    maxLives: 5,
    currentTurn: "player",
    players: {
      player: { userId: player1.userId, name: player1.username, lives: 5, powers: randomRuletaPowers(2), shield: false, doubleDamage: false, skipTurn: false },
      enemy: { userId: player2.userId, name: player2.username, lives: 5, powers: randomRuletaPowers(2), shield: false, doubleDamage: false, skipTurn: false }
    },
    chamber: chamber,
    realCount: chamber.filter(function(c) { return c === "real"; }).length,
    fakeCount: chamber.filter(function(c) { return c === "fake"; }).length,
    roundSize: 4,
    log: ["🌐 Partida online creada. Orden de cargas oculto."],
    gameOver: false
  };
}

function generateRuletaChamber(size) {
  const real = Math.max(1, Math.floor(Math.random() * (size - 1)) + 1);
  const fake = size - real;
  const arr = [];
  for (let i = 0; i < real; i++) arr.push("real");
  for (let j = 0; j < fake; j++) arr.push("fake");
  return arr.sort(function() { return Math.random() - 0.5; });
}

function randomRuletaPowers(count) {
  return RULETA_POWER_IDS.slice().sort(function() { return Math.random() - 0.5; }).slice(0, count);
}

function getRuletaMatchById(matchId) {
  return sheetToObjects(getSheet("RuletaMatches")).find(function(m) { return m.matchId === matchId; });
}

function findRuletaMatchForUser(userId) {
  return sheetToObjects(getSheet("RuletaMatches")).find(function(m) {
    return m.status === "active" && (m.player1Id === userId || m.player2Id === userId);
  });
}

function assertRuletaMatchUser(match, userId) {
  if (match.player1Id !== userId && match.player2Id !== userId) throw new Error("No perteneces a esta partida.");
}

function publicRuletaMatch(match, user) {
  const state = match.stateJson ? JSON.parse(match.stateJson) : {};
  return {
    matchId: match.matchId,
    status: match.status,
    mySlot: match.player1Id === user.userId ? "player" : "enemy",
    state: state,
    createdAt: match.createdAt,
    updatedAt: match.updatedAt
  };
}

function expireOldRuletaQueue() {
  const sheet = getSheet("RuletaQueue");
  const queue = sheetToObjects(sheet);
  const cutoff = Date.now() - 2 * 60 * 1000;
  queue.forEach(function(q, idx) {
    if (q.status === "waiting" && new Date(q.updatedAt || q.createdAt).getTime() < cutoff) {
      sheet.getRange(idx + 2, SHEETS.RuletaQueue.indexOf("status") + 1).setValue("expired");
      sheet.getRange(idx + 2, SHEETS.RuletaQueue.indexOf("updatedAt") + 1).setValue(now());
    }
  });
}

function normalizeCasinoGameType(value) {
  const gameType = clean(value).toLowerCase();
  if (["revolver", "cartas-distrito"].indexOf(gameType) === -1) throw new Error("Juego de casino invalido.");
  return gameType;
}

function createCasinoGameMatch(gameType, player1, player2) {
  const match = {
    matchId: makeId("cgm"),
    gameType: gameType,
    status: "active",
    player1Id: player1.userId,
    player1Username: player1.username,
    player2Id: player2.userId,
    player2Username: player2.username,
    stateJson: JSON.stringify(createCasinoGameInitialState(gameType, player1, player2)),
    createdAt: now(),
    updatedAt: now()
  };
  appendObject(getSheet("CasinoGameMatches"), SHEETS.CasinoGameMatches, match);
  return match;
}

function createCasinoGameInitialState(gameType, player1, player2) {
  const names = casinoGameNames();
  return {
    gameType: gameType,
    mode: "online",
    title: names[gameType] || "Duelo Bogotano",
    round: 1,
    maxRounds: 3,
    currentTurn: "player",
    players: {
      player: { userId: player1.userId, name: player1.username, score: 0 },
      enemy: { userId: player2.userId, name: player2.username, score: 0 }
    },
    roundData: {},
    log: ["Partida online creada. Esperando primera jugada."],
    statusMessage: "Tu turno",
    gameOver: false,
    winner: ""
  };
}

function casinoGameNames() {
  return {
    "revolver": "Revolver de la Suerte",
    "cartas-distrito": "Cartas del Distrito"
  };
}

function getCasinoGameMatchById(matchId) {
  return sheetToObjects(getSheet("CasinoGameMatches")).find(function(m) { return m.matchId === matchId; });
}

function findCasinoGameMatchForUser(userId, gameType) {
  return sheetToObjects(getSheet("CasinoGameMatches")).find(function(m) {
    return m.gameType === gameType && m.status === "active" && (m.player1Id === userId || m.player2Id === userId);
  });
}

function assertCasinoGameMatchUser(match, userId) {
  if (match.player1Id !== userId && match.player2Id !== userId) throw new Error("No perteneces a esta partida.");
}

function publicCasinoGameMatch(match, user) {
  const state = match.stateJson ? JSON.parse(match.stateJson) : {};
  return {
    matchId: match.matchId,
    gameType: match.gameType,
    status: match.status,
    mySlot: match.player1Id === user.userId ? "player" : "enemy",
    state: state,
    createdAt: match.createdAt,
    updatedAt: match.updatedAt
  };
}

function expireOldCasinoGameQueue() {
  const sheet = getSheet("CasinoGameQueue");
  const queue = sheetToObjects(sheet);
  const cutoff = Date.now() - 2 * 60 * 1000;
  queue.forEach(function(q, idx) {
    if (q.status === "waiting" && new Date(q.updatedAt || q.createdAt).getTime() < cutoff) {
      sheet.getRange(idx + 2, SHEETS.CasinoGameQueue.indexOf("status") + 1).setValue("expired");
      sheet.getRange(idx + 2, SHEETS.CasinoGameQueue.indexOf("updatedAt") + 1).setValue(now());
    }
  });
}

function requireUser(token) {
  ensureSheetsReady();
  const tokenHash = sha256(String(token || ""));
  const sessions = sheetToObjects(getSheet("Sessions"));
  const session = sessions.find(function(s) { return s.tokenHash === tokenHash && String(s.active) === "true" && new Date(s.expiresAt) > new Date(); });
  if (!session) throw new Error("Sesión inválida o expirada.");
  const user = sheetToObjects(getSheet("Users")).find(function(u) { return u.userId === session.userId; });
  if (!user || user.status !== "active") throw new Error("Usuario no autorizado o bloqueado.");
  return user;
}

function requireAdmin(token) {
  const user = requireUser(token);
  if (user.role !== "admin") throw new Error("No tienes permisos de administrador.");
  return user;
}

function requireUser(token) {
  ensureSheetsReady();
  const tokenHash = sha256(String(token || ""));
  const sessions = sheetToObjects(getSheet("Sessions"));
  const session = sessions.find(function(s) {
    return s.tokenHash === tokenHash && String(s.active) === "true" && new Date(s.expiresAt) > new Date();
  });
  if (!session) throw new Error("Sesion invalida o expirada.");
  const user = sheetToObjects(getSheet("Users")).find(function(u) { return u.userId === session.userId; });
  if (user) {
    user.role = normalizeRole(user.role);
    user.status = normalizeUserStatus(user.status || "active");
  }
  if (!user || user.status !== "active") throw new Error("Usuario no autorizado o bloqueado.");
  return user;
}

function requireAdminOrModerator(token) {
  const user = requireUser(token);
  if (["admin", "moderator"].indexOf(user.role) === -1) throw new Error("No autorizado.");
  return user;
}

function requireAdmin(token) {
  const user = requireUser(token);
  if (normalizeRole(user.role) !== "admin") throw new Error("Solo admin puede realizar esta accion.");
  return user;
}

function validateServerContent(text, isComment) {
  const normalized = normalizeText(text);
  const flags = [];
  const minorTerms = ["nino", "nina", "ninos", "ninas", "menor", "menores", "infante", "infantil", "colegio", "colegial", "escuela"];
  const abuseTerms = ["abuso", "sexual", "violacion", "desnudo", "desnuda", "explotacion", "pornografia", "maltrato", "tocamiento"];
  const threatTerms = ["te voy a matar", "los voy a matar", "matar a", "amenazo", "bomba", "hacer dano", "apunalar"];
  const crimeTerms = ["fabricar arma", "hacer explosivo", "fabricar explosivo", "como robar", "como hackear"];

  const hasMinor = minorTerms.some(function(t) { return normalized.indexOf(t) !== -1; });
  const hasAbuse = abuseTerms.some(function(t) { return normalized.indexOf(t) !== -1; });
  if (hasMinor && hasAbuse) flags.push("Bloqueado: posible contenido de menores con violencia, abuso o sexualidad.");
  if (threatTerms.some(function(t) { return normalized.indexOf(t) !== -1; })) flags.push("Bloqueado: amenaza directa o lenguaje de daño físico.");
  if (crimeTerms.some(function(t) { return normalized.indexOf(t) !== -1; })) flags.push("Bloqueado: instrucciones para cometer delitos o causar daño.");
  return { allowed: flags.length === 0, flags: flags, message: flags[0] || "Contenido permitido." };
}

function recalcPostCount(postId, countColumn, sourceSheetName) {
  const postsSheet = getSheet("Posts");
  const posts = sheetToObjects(postsSheet);
  const idx = posts.findIndex(function(p) { return p.postId === postId; });
  if (idx === -1) return;
  let count = 0;
  if (sourceSheetName === "Reactions") {
    count = sheetToObjects(getSheet("Reactions")).filter(function(r) { return r.targetType === "post" && r.targetId === postId; }).length;
  }
  postsSheet.getRange(idx + 2, SHEETS.Posts.indexOf(countColumn) + 1).setValue(count);
}

function incrementCell(sheet, row, sheetName, colName, amount) {
  const col = SHEETS[sheetName].indexOf(colName) + 1;
  const current = Number(sheet.getRange(row, col).getValue() || 0);
  const next = current + amount;
  sheet.getRange(row, col).setValue(next);
  return next;
}

function sheetToObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(function(row) { return row.some(function(cell) { return cell !== ""; }); }).map(function(row) {
    const obj = {};
    headers.forEach(function(header, idx) { obj[header] = row[idx]; });
    return obj;
  });
}

function appendObject(sheet, headers, obj) {
  sheet.appendRow(headers.map(function(header) { return obj[header] !== undefined ? obj[header] : ""; }));
}

function getDatabaseSpreadsheet() {
  return SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getMediaFolder() {
  if (MEDIA_FOLDER_ID) return DriveApp.getFolderById(MEDIA_FOLDER_ID);
  const folders = DriveApp.getFoldersByName(MEDIA_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(MEDIA_FOLDER_NAME);
}

function getSheet(name) {
  const sheet = getDatabaseSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error("Falta la hoja: " + name + ". Ejecuta setupSheets().");
  return sheet;
}

function normalizeRole(value) {
  const role = String(value || "user").trim().toLowerCase();
  return ALLOWED_ROLES.indexOf(role) === -1 ? "user" : role;
}

function normalizeUserStatus(value) {
  const status = String(value || "active").trim().toLowerCase();
  if (status === "inactive") return "blocked";
  return ALLOWED_USER_STATUSES.indexOf(status) === -1 ? "active" : status;
}

function normalizeContentStatus(value) {
  const status = String(value || "active").trim().toLowerCase();
  if (status === "reported") return "pending";
  return ALLOWED_CONTENT_STATUSES.indexOf(status) === -1 ? "active" : status;
}

function isAllowedPostCategory(category) {
  const modern = ["Manifestacion", "Reporte ciudadano", "Incidente", "Pelea / contenido sensible", "Accidente", "Denuncia", "Alerta", "Evento", "Trafico", "Seguridad", "Comunidad", "Juego / entretenimiento", "Short", "Movilidad", "Emergencia", "Otro"];
  return ALLOWED_CATEGORIES.indexOf(category) !== -1 || modern.indexOf(category) !== -1;
}

function isSensitivePostCategory(category) {
  return ["Incidente", "Pelea / contenido sensible", "Accidente", "Denuncia", "Seguridad", "Emergencia", "Pelea"].indexOf(category) !== -1;
}

function normalizeAlertLevel(value) {
  const level = clean(value);
  return ["Bajo", "Medio", "Alto"].indexOf(level) === -1 ? "" : level;
}

function isAllowedReportReason(reason) {
  const modern = ["Violencia explicita", "Acoso", "Datos personales", "Menores de edad", "Contenido falso", "Amenazas", "Incitacion a violencia", "Spam", "Otro"];
  return ALLOWED_REPORT_REASONS.indexOf(reason) !== -1 || modern.indexOf(reason) !== -1;
}

function findRowById(sheetName, idColumn, id) {
  const sheet = getSheet(sheetName);
  const rows = sheetToObjects(sheet);
  const idx = rows.findIndex(function(row) { return String(row[idColumn]) === String(id); });
  if (idx === -1) throw new Error("Registro no encontrado.");
  return { sheet: sheet, rowNumber: idx + 2, object: rows[idx] };
}

function setCellByHeader(sheet, rowNumber, sheetName, colName, value) {
  const column = SHEETS[sheetName].indexOf(colName) + 1;
  if (column <= 0) throw new Error("Columna no encontrada: " + colName);
  sheet.getRange(rowNumber, column).setValue(value);
}

function updateContentStatus(sheetName, idColumn, id, status, user, reason) {
  const found = findRowById(sheetName, idColumn, id);
  setCellByHeader(found.sheet, found.rowNumber, sheetName, "status", status);
  if (status === "reviewed" || status === "active") {
    setCellByHeader(found.sheet, found.rowNumber, sheetName, "reviewedBy", user.userId);
    setCellByHeader(found.sheet, found.rowNumber, sheetName, "reviewedAt", now());
  }
  if (reason) {
    setCellByHeader(found.sheet, found.rowNumber, sheetName, "removeReason", reason);
  }
}

function removeContent(sheetName, idColumn, id, user, reason, details) {
  const found = findRowById(sheetName, idColumn, id);
  setCellByHeader(found.sheet, found.rowNumber, sheetName, "status", "removed");
  setCellByHeader(found.sheet, found.rowNumber, sheetName, "removedBy", user.userId);
  setCellByHeader(found.sheet, found.rowNumber, sheetName, "removedAt", now());
  setCellByHeader(found.sheet, found.rowNumber, sheetName, "removeReason", [reason, details].filter(Boolean).join(" | "));
}

function primaryReportForTarget(targetType, targetId) {
  const reports = sheetToObjects(getSheet("Reports")).filter(function(report) {
    return report.targetType === targetType && report.targetId === targetId;
  });
  if (!reports.length) return { mainReason: "", reportCount: 0 };
  const counts = {};
  reports.forEach(function(report) { counts[report.reason] = (counts[report.reason] || 0) + 1; });
  const mainReason = Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; })[0];
  return { mainReason: mainReason || "", reportCount: reports.length };
}

function decorateReportedTarget(row, targetType, targetId) {
  const summary = primaryReportForTarget(targetType, targetId);
  row.status = targetType === "post" ? normalizeContentStatus(row.status || "active") : normalizeContentStatus(row.status || "active");
  row.mainReason = summary.mainReason;
  row.reportCount = Math.max(Number(row.reportCount || 0), summary.reportCount);
  return row;
}

function publicUser(user) {
  return {
    userId: user.userId,
    username: user.username,
    role: normalizeRole(user.role),
    status: normalizeUserStatus(user.status || "active"),
    createdAt: user.createdAt || "",
    lastLoginAt: user.lastLoginAt || ""
  };
}

function audit(userId, action, targetType, targetId, details) {
  appendObject(getSheet("AuditLog"), SHEETS.AuditLog, {
    logId: makeId("log"), userId: userId || "system", action: action, targetType: targetType || "system", targetId: targetId || "", details: details || "", createdAt: now()
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function clean(value) {
  return String(value || "").trim().slice(0, 3000);
}

function makeSafeFileName(value) {
  return String(value || "media")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 140) || "media";
}

function normalizeText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function isValidMediaUrl(value) {
  const url = String(value || "").trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(url) && !/^javascript:/i.test(url) && !/^data:/i.test(url);
}

function parsePostMediaItems(mediaUrl, mediaType) {
  const value = String(mediaUrl || "").trim();
  const type = String(mediaType || "").trim().toLowerCase();
  if (!value) return [];

  if (value.charAt(0) === "[") {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(function(item) {
          const itemType = String(item.type || "").trim().toLowerCase();
          return ["image", "video"].indexOf(itemType) !== -1 && isValidMediaUrl(item.url);
        })
        .map(function(item) {
          return {
            url: String(item.url || "").trim(),
            type: String(item.type || "").trim().toLowerCase(),
            name: clean(item.name || "")
          };
        });
    } catch (error) {
      return [];
    }
  }

  if (["image", "video"].indexOf(type) === -1 || !isValidMediaUrl(value)) return [];
  return [{ url: value, type: type, name: "" }];
}

function now() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return prefix + "_" + Utilities.getUuid().replace(/-/g, "").slice(0, 18);
}

function makeSalt() {
  return Utilities.getUuid() + Utilities.getUuid();
}

function hashPassword(password, salt) {
  return sha256(String(password) + ":" + String(salt));
}

function sha256(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return bytes.map(function(byte) {
    const v = (byte < 0 ? byte + 256 : byte).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}
