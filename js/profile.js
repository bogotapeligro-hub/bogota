const Profile = (() => {
  function getAvatarColor(username = "") {
    const colors = [
      "#FFD600", "#FF2D2D", "#00E5FF", "#39FF14", "#FF6B00",
      "#FF69B4", "#9B59B6", "#1ABC9C", "#E67E22", "#3498DB"
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  function getProfileData() {
    const user = Auth.user();
    if (!user) return null;
    const key = `bau_profile_${user.userId || user.username}`;
    try {
      return JSON.parse(localStorage.getItem(key) || "null") || {};
    } catch {
      return {};
    }
  }

  function saveProfileData(data) {
    const user = Auth.user();
    if (!user) return;
    const key = `bau_profile_${user.userId || user.username}`;
    const existing = getProfileData();
    localStorage.setItem(key, JSON.stringify({ ...existing, ...data }));
  }

  function getAvatar(username) {
    const data = getProfileData();
    if (data.avatar) return data.avatar;
    return username?.slice(0, 2).toUpperCase() || "BA";
  }

  function getBio() {
    const data = getProfileData();
    return data.bio || "Sin biografía aún.";
  }

  function renderAvatar(username, size = 40) {
    const initial = getAvatar(username);
    const color = getAvatarColor(username);
    return `<div class="p-avatar" style="width:${size}px;height:${size}px;background:${color};font-size:${size * 0.38}px;line-height:${size}px">${UI.escapeHTML(initial)}</div>`;
  }

  function getStats() {
    const user = Auth.user();
    if (!user) return { posts: 0, reactions: 0, coins: 0, games: 0 };
    const statsKey = `bau_stats_${user.userId || user.username}`;
    try {
      return JSON.parse(localStorage.getItem(statsKey) || "null") || { posts: 0, reactions: 0, coins: 0, games: 0 };
    } catch {
      return { posts: 0, reactions: 0, coins: 0, games: 0 };
    }
  }

  function updateStats(updates) {
    const stats = getStats();
    const newStats = { ...stats, ...updates };
    const user = Auth.user();
    if (!user) return;
    const statsKey = `bau_stats_${user.userId || user.username}`;
    localStorage.setItem(statsKey, JSON.stringify(newStats));
  }

  function trackPostCreated() {
    const stats = getStats();
    updateStats({ posts: (stats.posts || 0) + 1 });
  }

  function trackReactionReceived() {
    const stats = getStats();
    updateStats({ reactions: (stats.reactions || 0) + 1 });
  }

  function trackGameWon() {
    const stats = getStats();
    updateStats({ games: (stats.games || 0) + 1 });
  }

  function bindEditProfile() {
    const btn = document.getElementById("editProfileBtn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const user = Auth.user();
      if (!user) return;
      const data = getProfileData();
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop";
      overlay.innerHTML = `
        <section class="modal-card profile-edit-modal">
          <h2>Editar perfil</h2>
          <form id="profileEditForm">
            <label>Avatar (iniciales o emoji)</label>
            <input id="pe-avatar" value="${UI.escapeHTML(data.avatar || user.username?.slice(0, 2).toUpperCase() || "BA")}" maxlength="4" placeholder="Ej: JD o 🎮" />
            <label>Biografía</label>
            <textarea id="pe-bio" rows="4" maxlength="300" placeholder="Cuéntanos algo sobre ti...">${UI.escapeHTML(data.bio || "")}</textarea>
            <div class="modal-actions">
              <button type="button" class="ghost-btn" id="pe-cancel">Cancelar</button>
              <button type="submit" class="warning-btn">Guardar</button>
            </div>
          </form>
        </section>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector("#pe-cancel").addEventListener("click", () => overlay.remove());
      overlay.querySelector("#profileEditForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const avatar = overlay.querySelector("#pe-avatar").value.trim() || user.username?.slice(0, 2).toUpperCase();
        const bio = overlay.querySelector("#pe-bio").value.trim();
        saveProfileData({ avatar, bio });
        UI.toast("Perfil actualizado.", "success");
        overlay.remove();
        Router.reload();
      });
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
      });
    });
  }

  function bind() {
    bindEditProfile();
  }

  return {
    getAvatarColor,
    getProfileData,
    saveProfileData,
    getAvatar,
    getBio,
    renderAvatar,
    getStats,
    updateStats,
    trackPostCreated,
    trackReactionReceived,
    trackGameWon,
    bind,
    bindEditProfile
  };
})();
