const CasinoMiniGames = (() => {
  const GAMES = [
    {
      id: "tejo",
      number: "02",
      name: "Tejo Digital",
      icon: "TD",
      cost: 1,
      reward: 3,
      chance: 0.42,
      tags: ["Punteria", "Bot", "Rapido"],
      win: "Mecha encendida. Ganaste {reward} monedas.",
      lose: "El tejo quedo corto. Perdiste {cost} moneda."
    },
    {
      id: "chiva",
      number: "03",
      name: "Chiva Ruleta",
      icon: "CH",
      cost: 1,
      reward: 2,
      chance: 0.5,
      tags: ["Ruleta", "Azar", "Bogota"],
      win: "La chiva paro en premio. Ganaste {reward} monedas.",
      lose: "La chiva siguio de largo. Perdiste {cost} moneda."
    },
    {
      id: "transmi",
      number: "04",
      name: "TransMilenio Rush",
      icon: "TM",
      cost: 1,
      reward: 4,
      chance: 0.34,
      tags: ["Reflejos", "Bot", "Rush"],
      win: "Llegaste antes del cierre de puertas. Ganaste {reward} monedas.",
      lose: "Te cerro la puerta. Perdiste {cost} moneda."
    },
    {
      id: "pico",
      number: "05",
      name: "Pico y Placa Challenge",
      icon: "PP",
      cost: 1,
      reward: 2,
      chance: 0.56,
      tags: ["Prediccion", "Rapido", "Rolo"],
      win: "Elegiste la placa correcta. Ganaste {reward} monedas.",
      lose: "Hoy no circulaba. Perdiste {cost} moneda."
    },
    {
      id: "monserrate",
      number: "06",
      name: "Monserrate Lucky Climb",
      icon: "MO",
      cost: 2,
      reward: 6,
      chance: 0.32,
      tags: ["Alto riesgo", "Premio x3", "Bot"],
      win: "Subiste sin cansarte. Ganaste {reward} monedas.",
      lose: "Toco descansar en la mitad. Perdiste {cost} monedas."
    },
    {
      id: "sello",
      number: "07",
      name: "Cara o Sello Rolo",
      icon: "CS",
      cost: 1,
      reward: 2,
      chance: 0.5,
      tags: ["50/50", "Clasico", "Instantaneo"],
      win: "Cayo tu lado. Ganaste {reward} monedas.",
      lose: "Cayo el otro lado. Perdiste {cost} moneda."
    },
    {
      id: "dados",
      number: "08",
      name: "Dados de la Candelaria",
      icon: "DC",
      cost: 1,
      reward: 3,
      chance: 0.38,
      tags: ["Dados", "Azar", "Centro"],
      win: "Dobles en la mesa. Ganaste {reward} monedas.",
      lose: "Los dados no ayudaron. Perdiste {cost} moneda."
    },
    {
      id: "tragamonedas",
      number: "09",
      name: "Mini Tragamonedas Bogotana",
      icon: "MB",
      cost: 1,
      reward: 5,
      chance: 0.22,
      tags: ["Jackpot", "Rapido", "Neon"],
      win: "Tres simbolos urbanos. Ganaste {reward} monedas.",
      lose: "No hubo linea ganadora. Perdiste {cost} moneda."
    }
  ];

  const processing = new Set();

  function render() {
    const root = document.getElementById("casinoMiniGames");
    if (!root || typeof CasinoCoins === "undefined") return;
    root.innerHTML = GAMES.map(game => `
      <article class="game-card casino-mini-card game-active" data-mini-game="${game.id}">
        <div class="game-card-glow"></div>
        <div class="game-card-top">
          <div class="game-number">${UI.escapeHTML(game.number)}</div>
          <div class="game-badge game-badge-live">BOT</div>
        </div>
        <div class="game-icon-wrap">
          <div class="game-icon-3d"><div class="dice-face mini-game-face">${UI.escapeHTML(game.icon)}</div></div>
        </div>
        <h3 class="game-name">${UI.escapeHTML(game.name)}</h3>
        <p class="game-desc">Entrada: ${game.cost} moneda${game.cost > 1 ? "s" : ""}. Recompensa posible: ${game.reward} monedas.</p>
        <div class="game-tags">
          ${game.tags.map(tag => `<span class="tag">${UI.escapeHTML(tag)}</span>`).join("")}
        </div>
        <div class="mini-game-status" data-mini-status="${game.id}">Listo para jugar.</div>
        <button type="button" class="game-btn game-btn-play" data-mini-play="${game.id}">
          <span>Jugar por ${game.cost}</span>
          <span class="btn-arrow">+</span>
        </button>
      </article>
    `).join("");
    bind(root);
    CasinoCoins.renderCoinBalance(root);
  }

  function bind(root) {
    root.querySelectorAll("[data-mini-play]").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => play(button.dataset.miniPlay, button));
    });
  }

  async function play(gameId, button) {
    const game = GAMES.find(item => item.id === gameId);
    if (!game || processing.has(gameId)) return;
    if (CasinoCoins.getCoins() < game.cost) {
      CasinoCoins.showNoCoinsMessage();
      setStatus(gameId, "No tienes monedas suficientes.");
      return;
    }

    processing.add(gameId);
    UI.setLoading(button, true, "Jugando...");
    setStatus(gameId, "Jugando contra el bot...");

    const spent = spendCost(game.cost);
    if (!spent) {
      processing.delete(gameId);
      UI.setLoading(button, false);
      return;
    }

    await delay(650);
    const won = Math.random() < game.chance;
    if (won) {
      CasinoCoins.setCoins(CasinoCoins.getCoins() + game.reward);
      setStatus(gameId, game.win.replace("{reward}", game.reward));
      UI.toast(`Ganaste ${game.reward} monedas en ${game.name}.`, "success");
    } else {
      setStatus(gameId, game.lose.replace("{cost}", game.cost));
      UI.toast(`Perdiste ${game.cost} moneda${game.cost > 1 ? "s" : ""} en ${game.name}.`, "warning");
    }

    CasinoCoins.renderCoinBalance(document);
    window.setTimeout(() => {
      processing.delete(gameId);
      UI.setLoading(button, false);
      CasinoCoins.renderCoinBalance(document);
    }, 250);
  }

  function spendCost(cost) {
    const coins = CasinoCoins.getCoins();
    if (coins < cost) {
      CasinoCoins.showNoCoinsMessage();
      return false;
    }
    CasinoCoins.setCoins(coins - cost);
    CasinoCoins.renderCoinBalance(document);
    return true;
  }

  function setStatus(gameId, message) {
    const status = document.querySelector(`[data-mini-status="${CSS.escape(gameId)}"]`);
    if (status) status.textContent = message;
  }

  function delay(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  return { render };
})();
