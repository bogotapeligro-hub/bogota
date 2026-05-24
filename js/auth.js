const Auth = (() => {
  function normalizeRole(value) {
    const role = String(value || "user").trim().toLowerCase();
    return ["user", "moderator", "admin"].includes(role) ? role : "user";
  }

  function normalizeStatus(value) {
    const status = String(value || "active").trim().toLowerCase();
    if (status === "inactive") return "blocked";
    return ["active", "blocked", "deleted"].includes(status) ? status : "active";
  }

  function normalizeUser(rawUser = {}) {
    return {
      ...rawUser,
      userId: String(rawUser.userId || ""),
      username: String(rawUser.username || ""),
      role: normalizeRole(rawUser.role),
      status: normalizeStatus(rawUser.status)
    };
  }

  function normalizeSession(session) {
    if (!session) return null;
    return {
      ...session,
      token: String(session.token || ""),
      user: normalizeUser(session.user || {})
    };
  }

  function getSession() {
    try {
      return normalizeSession(JSON.parse(localStorage.getItem(APP_CONFIG.sessionKey) || "null"));
    } catch {
      return null;
    }
  }

  function setSession(session) {
    const normalized = normalizeSession(session);
    if (!normalized?.token || !normalized?.user?.userId) return;
    localStorage.setItem(APP_CONFIG.sessionKey, JSON.stringify(normalized));
    localStorage.setItem("currentUser", JSON.stringify(normalized.user));
    localStorage.setItem("authToken", normalized.token);
    UI.syncTopbar();
  }

  function clearSession() {
    localStorage.removeItem(APP_CONFIG.sessionKey);
    localStorage.removeItem("currentUser");
    localStorage.removeItem("authToken");
    localStorage.removeItem("usuarioActual");
    sessionStorage.removeItem(APP_CONFIG.sessionKey);
    sessionStorage.removeItem("currentUser");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("usuarioActual");
    UI.syncTopbar();
  }

  function isLoggedIn() {
    const session = getSession();
    return Boolean(session?.token && session?.user);
  }

  function token() {
    return getSession()?.token || "";
  }

  function user() {
    return getSession()?.user || null;
  }

  function roleLabel() {
    const role = user()?.role;
    if (role === "admin") return "Modo Admin";
    if (role === "moderator") return "Modo Moderador";
    return "";
  }

  function isAdmin() {
    return user()?.role === "admin";
  }

  function isModerator() {
    return user()?.role === "moderator";
  }

  function isAdminOrModerator() {
    return ["admin", "moderator"].includes(user()?.role);
  }

  async function refreshCurrentUser() {
    if (!token()) return null;
    const result = await Api.apiGetCurrentUser(token());
    const current = getSession();
    setSession({ ...current, user: result.user });
    return result.user;
  }

  async function login(username, password) {
    const result = await Api.apiLogin(username, password);
    setSession(result);
    UI.toast("Sesion iniciada.", "success");
    location.hash = "#/feed";
  }

  async function register(username, password, ageConfirmed) {
    await Api.apiRegister(username, password, ageConfirmed);
    UI.toast("Cuenta creada. Ahora inicia sesion.", "success");
    location.hash = "#/login";
  }

  function logout() {
    clearSession();
    UI.toast("Sesion cerrada.", "info");
    location.hash = "#/login";
  }

  function bindLogin() {
    const form = document.getElementById("loginForm");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const username = form.username.value.trim();
      const password = form.password.value;
      if (!username || !password) return UI.toast("Completa usuario y contrasena.", "warning");
      try {
        UI.setLoading(button, true, "Entrando...");
        await login(username, password);
      } catch (error) {
        UI.toast(error.message, "error");
      } finally {
        UI.setLoading(button, false);
      }
    });
  }

  function bindRegister() {
    const form = document.getElementById("registerForm");
    if (!form) return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      const username = form.username.value.trim();
      const password = form.password.value;
      const password2 = form.password2.value;
      const ageConfirmed = form.ageConfirmed.checked;
      const rulesAccepted = form.rulesAccepted.checked;

      if (!/^[a-z0-9_.-]{3,20}$/i.test(username)) return UI.toast("Usuario invalido. Usa 3 a 20 caracteres: letras, numeros, punto, guion o guion bajo.", "warning");
      if (password.length < 6) return UI.toast("La contrasena debe tener minimo 6 caracteres.", "warning");
      if (password !== password2) return UI.toast("Las contrasenas no coinciden.", "warning");
      if (!ageConfirmed) return UI.toast("Debes confirmar que tienes 18 anos o mas.", "warning");
      if (!rulesAccepted) return UI.toast("Debes aceptar las reglas de publicacion.", "warning");

      try {
        UI.setLoading(button, true, "Creando cuenta...");
        await register(username, password, ageConfirmed);
      } catch (error) {
        UI.toast(error.message, "error");
      } finally {
        UI.setLoading(button, false);
      }
    });
  }

  return {
    getSession,
    setSession,
    clearSession,
    isLoggedIn,
    token,
    user,
    roleLabel,
    isAdmin,
    isModerator,
    isAdminOrModerator,
    refreshCurrentUser,
    login,
    register,
    logout,
    bindLogin,
    bindRegister
  };
})();
