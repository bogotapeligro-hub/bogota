const CASINO_STARTING_COINS = 5;
const CASINO_FREE_COIN_CAP = 5;
const CASINO_REGEN_INTERVAL_MS = 5 * 60 * 1000;
const CASINO_GAME_COST = 1;
const CASINO_WIN_REWARD = 2;

const CasinoCoins = (() => {
  let timerId = null;

  function getCasinoUserKey() {
    let user = null;
    try {
      user = typeof Auth !== "undefined" ? Auth.user() : null;
      if (!user) user = JSON.parse(localStorage.getItem("usuarioActual") || "null");
    } catch (error) {
      user = null;
    }

    const rawId = user && (user.userId || user.username || user.nombre);
    return String(rawId || "guest").replace(/[^a-z0-9_.-]/gi, "_");
  }

  function coinKey() {
    return `casinoCoins_${getCasinoUserKey()}`;
  }

  function regenKey() {
    return `casinoLastRegenAt_${getCasinoUserKey()}`;
  }

  function getCoins() {
    const saved = localStorage.getItem(coinKey());
    if (saved === null || saved === "") return CASINO_STARTING_COINS;
    return Math.max(0, Number(saved) || 0);
  }

  function setCoins(amount) {
    const previous = getCoins();
    const next = Math.max(0, Math.floor(Number(amount) || 0));
    localStorage.setItem(coinKey(), String(next));

    if (previous >= CASINO_FREE_COIN_CAP && next < CASINO_FREE_COIN_CAP) {
      setLastRegenAt(Date.now());
    }

    announceChange(next);
    return next;
  }

  function getLastRegenAt() {
    const saved = Number(localStorage.getItem(regenKey()) || 0);
    return saved || Date.now();
  }

  function setLastRegenAt(timestamp) {
    localStorage.setItem(regenKey(), String(Number(timestamp) || Date.now()));
  }

  function initializeCoins() {
    if (localStorage.getItem(coinKey()) === null) {
      localStorage.setItem(coinKey(), String(CASINO_STARTING_COINS));
      setLastRegenAt(Date.now());
    }
    regenCoins();
    renderCoinBalance(document);
    startCoinTimer();
  }

  function regenCoins() {
    let coins = getCoins();
    const now = Date.now();

    if (coins >= CASINO_FREE_COIN_CAP) {
      setLastRegenAt(now);
      return coins;
    }

    const last = getLastRegenAt();
    const elapsed = Math.max(0, now - last);
    const gained = Math.floor(elapsed / CASINO_REGEN_INTERVAL_MS);

    if (gained <= 0) return coins;

    coins = Math.min(CASINO_FREE_COIN_CAP, coins + gained);
    localStorage.setItem(coinKey(), String(coins));

    if (coins >= CASINO_FREE_COIN_CAP) {
      setLastRegenAt(now);
    } else {
      setLastRegenAt(last + gained * CASINO_REGEN_INTERVAL_MS);
    }

    announceChange(coins);
    return coins;
  }

  function getNextCoinTime() {
    const coins = getCoins();
    if (coins >= CASINO_FREE_COIN_CAP) return 0;
    const elapsed = Math.max(0, Date.now() - getLastRegenAt());
    return Math.max(0, CASINO_REGEN_INTERVAL_MS - (elapsed % CASINO_REGEN_INTERVAL_MS));
  }

  function canPlayCasinoGame() {
    regenCoins();
    return getCoins() >= CASINO_GAME_COST;
  }

  function spendCoin() {
    regenCoins();
    const coins = getCoins();
    if (coins < CASINO_GAME_COST) {
      renderCoinBalance(document);
      return false;
    }
    setCoins(coins - CASINO_GAME_COST);
    renderCoinBalance(document);
    flashCoinUi("coin-loss-animation");
    return true;
  }

  function rewardWin() {
    const next = setCoins(getCoins() + CASINO_WIN_REWARD);
    renderCoinBalance(document);
    flashCoinUi("coin-gain-animation");
    if (typeof Notifications !== "undefined") {
      Notifications.add("game", "¡Victoria!", `Ganaste ${CASINO_WIN_REWARD} moneda${CASINO_WIN_REWARD !== 1 ? "s" : ""} en el casino`, "#/casino", "🏆");
    }
    if (typeof Profile !== "undefined") Profile.trackGameWon();
    return next;
  }

  function handleLoss() {
    regenCoins();
    renderCoinBalance(document);
    if (typeof Notifications !== "undefined") {
      Notifications.add("game", "Derrota", "Perdiste la partida. ¡Intenta de nuevo!", "#/casino", "💔");
    }
  }

  function renderCoinBalance(root = document) {
    const coins = regenCoins();
    const nextMs = getNextCoinTime();
    const nextLabel = nextMs > 0
      ? `Proxima moneda en: ${formatTime(nextMs)}`
      : "Monedas listas";

    root.querySelectorAll("[data-casino-coin-amount]").forEach(el => {
      el.textContent = String(coins);
    });

    root.querySelectorAll("[data-casino-coin-timer]").forEach(el => {
      el.textContent = coins <= 0
        ? `Juego bloqueado. ${nextLabel}`
        : nextLabel;
    });

    root.querySelectorAll("[data-casino-play-button], [data-start-mode]").forEach(button => {
      const disabled = coins <= 0;
      if ("disabled" in button) button.disabled = disabled;
      button.classList.toggle("disabled-play-button", disabled);
      button.setAttribute("aria-disabled", String(disabled));
    });
  }

  function startCoinTimer() {
    if (timerId) return;
    timerId = window.setInterval(() => {
      regenCoins();
      renderCoinBalance(document);
    }, 1000);
  }

  function showNoCoinsMessage() {
    renderCoinBalance(document);
    const existing = document.getElementById("no-coins-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "no-coins-modal";
    modal.className = "no-coins-modal";
    modal.innerHTML = `
      <div class="no-coins-box">
        <img class="casino-coin-icon coin-modal-icon" src="assets/casino.png" alt="Moneda de casino">
        <h2>No tienes monedas suficientes.</h2>
        <p>Debes esperar para recibir una nueva moneda.</p>
        <strong class="coin-timer" data-casino-coin-timer>Proxima moneda en: ${formatTime(getNextCoinTime())}</strong>
        <p class="no-coins-help">Las monedas se recargan automaticamente cada 5 minutos hasta llegar a 5.</p>
        <div class="no-coins-actions">
          <button type="button" class="game-btn game-btn-play" data-close-no-coins>Entendido</button>
          <a href="#/casino" class="game-btn game-btn-locked">Volver al casino</a>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector("[data-close-no-coins]")?.addEventListener("click", () => modal.remove());
    modal.addEventListener("click", event => {
      if (event.target === modal) modal.remove();
    });
  }

  function formatTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function flashCoinUi(className) {
    document.querySelectorAll("[data-casino-coins]").forEach(el => {
      el.classList.remove("coin-gain-animation", "coin-loss-animation");
      void el.offsetWidth;
      el.classList.add(className);
      window.setTimeout(() => el.classList.remove(className), 700);
    });
  }

  function announceChange(coins) {
    window.dispatchEvent(new CustomEvent("casinoCoins:changed", { detail: { coins } }));
  }

  return {
    getCasinoUserKey,
    getCoins,
    setCoins,
    getLastRegenAt,
    setLastRegenAt,
    initializeCoins,
    regenCoins,
    getNextCoinTime,
    canPlayCasinoGame,
    spendCoin,
    rewardWin,
    handleLoss,
    renderCoinBalance,
    startCoinTimer,
    showNoCoinsMessage
  };
})();
