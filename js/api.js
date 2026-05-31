const Api = (() => {
  const cache = new Map();
  const CACHE_TTL_MS = {
    listPosts: 45000,
    getPost: 15000,
    getUserProfile: 30000
  };

  function hasConfiguredApiUrl() {
    return Boolean(API_URL && !API_URL.includes("PEGA_AQUI") && API_URL.trim() !== "");
  }

  function assertApiConfigured() {
    if (!hasConfiguredApiUrl()) {
      throw new Error("No se pudo conectar con la base de datos. Revisa la URL de Apps Script en config.js.");
    }
  }

  function cacheKey(action, payload) {
    return `${action}:${JSON.stringify(payload)}`;
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getCached(action, payload) {
    const ttl = CACHE_TTL_MS[action];
    if (!ttl) return null;
    const key = cacheKey(action, payload);
    let item = cache.get(key);
    if (!item) {
      try {
        item = JSON.parse(sessionStorage.getItem(`api_cache_${key}`) || "null");
      } catch {
        item = null;
      }
    }
    if (!item || Date.now() - item.savedAt > ttl) return null;
    return cloneData(item.data);
  }

  function setCached(action, payload, data) {
    if (!CACHE_TTL_MS[action]) return;
    const item = { data: cloneData(data), savedAt: Date.now() };
    const key = cacheKey(action, payload);
    cache.set(key, item);
    try {
      sessionStorage.setItem(`api_cache_${key}`, JSON.stringify(item));
    } catch {}
  }

  function clearCache(prefix = "") {
    Array.from(cache.keys()).forEach((key) => {
      if (!prefix || key.startsWith(prefix)) cache.delete(key);
    });
    try {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith(`api_cache_${prefix}`) || (!prefix && key.startsWith("api_cache_"))) {
          sessionStorage.removeItem(key);
        }
      });
    } catch {}
  }

  async function apiRequest(action, payload = {}) {
    assertApiConfigured();
    const cached = getCached(action, payload);
    if (cached) return cached;

    let response;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 18000);
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action, payload }),
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("La base de datos esta tardando demasiado. Intenta de nuevo en unos segundos.");
      }
      throw new Error("No se pudo conectar con la base de datos. Revisa la URL de Apps Script en config.js.");
    } finally {
      window.clearTimeout(timeoutId);
    }

    const raw = await response.text();
    let json;
    try {
      json = JSON.parse(raw);
    } catch (error) {
      throw new Error("El backend no devolvio JSON valido. Revisa la URL del Apps Script y el despliegue Web App.");
    }

    if (!response.ok) {
      throw new Error(json.message || "Error HTTP al consultar la base de datos.");
    }

    if (!json.success) {
      throw new Error(json.message || "Error en la solicitud.");
    }

    const data = json.data || {};
    setCached(action, payload, data);
    return data;
  }

  function apiRegister(username, password, ageConfirmed) {
    return apiRequest("register", { username, password, ageConfirmed });
  }

  function apiLogin(username, password) {
    return apiRequest("login", { username, password });
  }

  function apiGetCurrentUser(token) {
    return apiRequest("getCurrentUser", { token });
  }

  function apiCreatePost(token, data) {
    clearCache("listPosts:");
    return apiRequest("createPost", { token, data });
  }

  function apiUploadMedia(token, file) {
    return apiRequest("uploadMedia", { token, file });
  }

  function apiListPosts() {
    return apiRequest("listPosts", {});
  }

  function apiGetPost(postId) {
    return apiRequest("getPost", { postId });
  }

  function apiCreateComment(token, postId, text) {
    clearCache("getPost:");
    clearCache("listPosts:");
    return apiRequest("createComment", { token, postId, text });
  }

  function apiReact(token, targetType, targetId, reaction) {
    return apiRequest("react", { token, targetType, targetId, reaction });
  }

  function apiReport(token, targetType, targetId, reason, details) {
    return apiRequest("report", { token, targetType, targetId, reason, details });
  }

  function apiAdminListReports(token) {
    return apiRequest("adminListReports", { token });
  }

  function apiAdminDashboard(token) {
    return apiRequest("adminDashboard", { token });
  }

  function apiAdminListReportedPosts(token) {
    return apiRequest("adminListReportedPosts", { token });
  }

  function apiAdminListReportedComments(token) {
    return apiRequest("adminListReportedComments", { token });
  }

  function apiAdminUpdatePost(token, postId, status, reason = "") {
    return apiRequest("adminUpdatePostStatus", { token, postId, status, reason });
  }

  function apiAdminUpdatePostStatus(token, postId, status, reason = "") {
    return apiRequest("adminUpdatePostStatus", { token, postId, status, reason });
  }

  function apiAdminUpdateCommentStatus(token, commentId, status, reason = "") {
    return apiRequest("adminUpdateCommentStatus", { token, commentId, status, reason });
  }

  function apiAdminRemovePost(token, postId, reason, details = "") {
    return apiRequest("adminRemovePost", { token, postId, reason, details });
  }

  function apiAdminRemoveComment(token, commentId, reason, details = "") {
    return apiRequest("adminRemoveComment", { token, commentId, reason, details });
  }

  function apiAdminRestorePost(token, postId) {
    return apiRequest("adminRestorePost", { token, postId });
  }

  function apiAdminRestoreComment(token, commentId) {
    return apiRequest("adminRestoreComment", { token, commentId });
  }

  function apiAdminUpdateReportStatus(token, reportId, status) {
    return apiRequest("adminUpdateReportStatus", { token, reportId, status });
  }

  function apiAdminListUsers(token) {
    return apiRequest("adminListUsers", { token });
  }

  function apiAdminUpdateUser(token, userId, status) {
    return apiRequest("adminUpdateUserStatus", { token, userId, status });
  }

  function apiAdminUpdateUserStatus(token, userId, status) {
    return apiRequest("adminUpdateUserStatus", { token, userId, status });
  }

  function apiAdminUpdateUserRole(token, userId, role) {
    return apiRequest("adminUpdateUserRole", { token, userId, role });
  }

  function apiAdminListAuditLog(token) {
    return apiRequest("adminListAuditLog", { token });
  }

  function apiRuletaJoinMatch(token) {
    const user = (typeof Auth !== 'undefined') ? Auth.user() : null;
    return apiRequest("ruletaJoinMatch", {
      token,
      status: 'searching',
      userId: user?.userId || '',
      username: user?.username || '',
      joinedAt: Date.now()
    });
  }

  function apiRuletaGetMatch(token, matchId) {
    return apiRequest("ruletaGetMatch", { token, matchId });
  }

  function apiRuletaSaveMatch(token, matchId, state) {
    return apiRequest("ruletaSaveMatch", { token, matchId, state });
  }

  function apiRuletaCancelMatchmaking(token) {
    return apiRequest("ruletaCancelMatchmaking", { token });
  }

  function apiCasinoJoinGameMatch(token, gameType) {
    const user = (typeof Auth !== 'undefined') ? Auth.user() : null;
    return apiRequest("casinoJoinGameMatch", {
      token, gameType,
      status: 'searching',
      userId: user?.userId || '',
      username: user?.username || '',
      joinedAt: Date.now()
    });
  }

  function apiCasinoGetGameMatch(token, matchId) {
    return apiRequest("casinoGetGameMatch", { token, matchId });
  }

  function apiCasinoSaveGameMatch(token, matchId, state) {
    return apiRequest("casinoSaveGameMatch", { token, matchId, state });
  }

  function apiCasinoCancelGameMatchmaking(token, gameType) {
    return apiRequest("casinoCancelGameMatchmaking", { token, gameType });
  }

  function apiGetUserProfile(token, userIdOrUsername) {
    return apiRequest("getUserProfile", { token, userIdOrUsername });
  }

  function apiListGlobalMessages(token) {
    return apiRequest("listGlobalMessages", { token });
  }

  function apiCreateGlobalMessage(token, text, media = {}) {
    return apiRequest("createGlobalMessage", { token, text, mediaUrl: media.mediaUrl || "", mediaType: media.mediaType || "" });
  }

  function apiListPrivateMessages(token, peerUserId) {
    return apiRequest("listPrivateMessages", { token, peerUserId });
  }

  function apiCreatePrivateMessage(token, peerUserId, text, media = {}) {
    return apiRequest("createPrivateMessage", { token, peerUserId, text, mediaUrl: media.mediaUrl || "", mediaType: media.mediaType || "" });
  }

  function apiMarkPrivateRead(token, peerUserId) {
    return apiRequest("markPrivateRead", { token, peerUserId });
  }

  return {
    apiRegister,
    apiLogin,
    apiGetCurrentUser,
    apiCreatePost,
    apiUploadMedia,
    apiListPosts,
    apiGetPost,
    apiCreateComment,
    apiReact,
    apiReport,
    apiAdminDashboard,
    apiAdminListReportedPosts,
    apiAdminListReportedComments,
    apiAdminListReports,
    apiAdminUpdatePost,
    apiAdminUpdatePostStatus,
    apiAdminUpdateCommentStatus,
    apiAdminRemovePost,
    apiAdminRemoveComment,
    apiAdminRestorePost,
    apiAdminRestoreComment,
    apiAdminUpdateReportStatus,
    apiAdminListUsers,
    apiAdminUpdateUser,
    apiAdminUpdateUserStatus,
    apiAdminUpdateUserRole,
    apiAdminListAuditLog,
    apiRuletaJoinMatch,
    apiRuletaGetMatch,
    apiRuletaSaveMatch,
    apiRuletaCancelMatchmaking,
    apiCasinoJoinGameMatch,
    apiCasinoGetGameMatch,
    apiCasinoSaveGameMatch,
    apiCasinoCancelGameMatchmaking,
    apiGetUserProfile,
    apiListGlobalMessages,
    apiCreateGlobalMessage,
    apiListPrivateMessages,
    apiCreatePrivateMessage,
    apiMarkPrivateRead,
    clearCache,
    hasConfiguredApiUrl
  };
})();
