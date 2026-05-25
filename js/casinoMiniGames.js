const CasinoMiniGames = (() => {
  const GAMES = [
    { id: "tejo", number: "04", name: "Tejo Digital", icon: "TD", cost: 1, reward: "1 a 6", tags: ["Punteria", "Fuerza", "Bot"] },
    { id: "chiva", number: "05", name: "Chiva Ruleta", icon: "CH", cost: 1, reward: "0 a 5", tags: ["Casillas", "Bonus", "Bot"] },
    { id: "transmi", number: "06", name: "TransMilenio Rush", icon: "TM", cost: 1, reward: "0 a 4", tags: ["Reaccion", "Ruta", "Bot"] },
    { id: "pico", number: "07", name: "Pico y Placa Challenge", icon: "PP", cost: 1, reward: "0 a 3", tags: ["Decision", "Placa", "Bot"] },
    { id: "monserrate", number: "08", name: "Monserrate Lucky Climb", icon: "MO", cost: 1, reward: "1 a 8", tags: ["Arriesgar", "Cobrar", "Bot"] },
    { id: "sello", number: "09", name: "Cara o Sello Rolo", icon: "CS", cost: 1, reward: "2", tags: ["50/50", "Rapido", "Bot"] },
    { id: "dados", number: "10", name: "Dados de la Candelaria", icon: "DC", cost: 1, reward: "0 a 5", tags: ["Dados", "Suma", "Bot"] },
    { id: "tragamonedas", number: "11", name: "Mini Tragamonedas Bogotana", icon: "MB", cost: 1, reward: "0 a 8", tags: ["Linea", "Neon", "Bot"] }
  ];

  function render() {
    const root = document.getElementById("casinoMiniGames");
    if (!root || typeof CasinoCoins === "undefined") return;
    root.innerHTML = GAMES.map(game => `
      <article class="game-card casino-mini-card game-active" data-mini-game="${game.id}">
        <div class="game-card-glow"></div>
        <div class="game-card-top">
          <div class="game-number">${UI.escapeHTML(game.number)}</div>
          <div class="game-badge game-badge-live">JUGABLE</div>
        </div>
        <div class="game-icon-wrap">
          <div class="game-icon-3d"><div class="dice-face mini-game-face">${UI.escapeHTML(game.icon)}</div></div>
        </div>
        <h3 class="game-name">${UI.escapeHTML(game.name)}</h3>
        <p class="game-desc">Entrada: ${game.cost} moneda. Recompensa posible: ${UI.escapeHTML(game.reward)} monedas.</p>
        <div class="game-tags">
          ${game.tags.map(tag => `<span class="tag">${UI.escapeHTML(tag)}</span>`).join("")}
        </div>
        <a class="game-btn game-btn-play" href="#/casino-game/${encodeURIComponent(game.id)}" data-casino-play-button>
          <span>Abrir juego</span>
          <span class="btn-arrow">+</span>
        </a>
      </article>
    `).join("");
    CasinoCoins.renderCoinBalance(root);
  }

  function all() {
    return GAMES.slice();
  }

  return { render, all };
})();
