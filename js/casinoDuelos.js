const CasinoDuelos = (() => {
  const POLL_MS = 1100;
  const MATCH_POLL_MS = 900;
  const COST = 1;
  const WIN_REWARD = 3;
  const configs = {
    "dados-calle": {
      title: "Dados de la Calle",
      action: "Lanzar dados",
      symbol: "🎲",
      botName: "Bot de la Séptima",
      resultLabel: value => value ? `${value.dice[0]} + ${value.dice[1]} = ${value.total}` : "--",
      makePlay: () => {
        const dice = [roll(1, 6), roll(1, 6)];
        return { dice, total: dice[0] + dice[1] };
      }
    },
    "cartas-distrito": {
      title: "Cartas del Distrito",
      action: "Robar carta",
      symbol: "🃏",
      botName: "Bot del Distrito",
      resultLabel: value => value ? `${value.cardName} (${value.total})` : "--",
      makePlay: () => {
        const cards = ["Chapinero", "Suba", "Kennedy", "Bosa", "Usaquén", "Candelaria", "Monserrate", "TransMi", "Septima", "Distrito", "Alcaldia", "La 26"];
        const total = roll(1, 12);
        return { cardName: cards[total - 1], total };
      }
    }
  };

  let gameType = "";
  let config = null;
  let state = null;
  let online = { enabled: false, matchId: "", mySlot: "player", pollTimer: null, matchTimer: null, paid: false };
  let processing = false;

  function init(type) {
    gameType = type;
    config = configs[type];
    if (!config) return;
    cleanup();
    CasinoCoins.initializeCoins();
    CasinoCoins.renderCoinBalance(document);
    bindModeButtons();
    render();
  }

  function bindModeButtons() {
    document.querySelectorAll("[data-duelo-start]").forEach(button => {
      button.addEventListener("click", () => {
        if (button.dataset.dueloStart === "online") startOnline();
        else startBot();
      });
    });
    document.querySelector("[data-duelo-cancel]")?.addEventListener("click", cancelOnline);
    document.querySelector("[data-duelo-action]")?.addEventListener("click", playerAction);
  }

  function startBot() {
    if (!payEntry()) return;
    const user = Auth.user();
    online.enabled = false;
    state = createInitialState({
      player: { userId: user?.userId || "local", name: user?.username || "Jugador" },
      enemy: { userId: "bot", name: config.botName }
    }, "bot");
    showArena();
    render();
  }

  async function startOnline() {
    if (!UI.requireSession()) return;
    if (!Api.hasConfiguredApiUrl()) {
      UI.toast("El multijugador necesita Apps Script desplegado.", "error");
      return;
    }
    showMatchmaking(true);
    setModeButtons(false);
    await pollMatchmakingOnce();
    online.matchTimer = window.setInterval(pollMatchmakingOnce, MATCH_POLL_MS);
  }

  async function pollMatchmakingOnce() {
    try {
      const result = await Api.apiCasinoJoinGameMatch(Auth.token(), gameType);
      if (result.status === "matched" && result.match) {
        window.clearInterval(online.matchTimer);
        acceptOnlineMatch(result.match);
      }
    } catch (error) {
      window.clearInterval(online.matchTimer);
      showMatchmaking(false);
      setModeButtons(true);
      UI.toast(error.message || "No se pudo buscar rival.", "error");
    }
  }

  function acceptOnlineMatch(match) {
    const paidKey = `casino_duelo_paid_${match.matchId}_${CasinoCoins.getCasinoUserKey()}`;
    const alreadyPaid = localStorage.getItem(paidKey) === "1";
    if (!alreadyPaid && !online.paid && !payEntry()) {
      cancelOnline();
      return;
    }
    localStorage.setItem(paidKey, "1");
    online = { ...online, enabled: true, paid: true, matchId: match.matchId, mySlot: match.mySlot || "player" };
    state = normalizeState(match.state);
    showMatchmaking(false);
    showArena();
    startPolling();
    render();
    UI.toast("Rival conectado. Empieza la mesa.", "success");
  }

  async function cancelOnline() {
    window.clearInterval(online.matchTimer);
    showMatchmaking(false);
    setModeButtons(true);
    try {
      if (Api.hasConfiguredApiUrl()) await Api.apiCasinoCancelGameMatchmaking(Auth.token(), gameType);
    } catch {}
  }

  function startPolling() {
    window.clearInterval(online.pollTimer);
    online.pollTimer = window.setInterval(fetchOnlineState, POLL_MS);
  }

  async function fetchOnlineState() {
    if (!online.enabled || !online.matchId) return;
    try {
      const result = await Api.apiCasinoGetGameMatch(Auth.token(), online.matchId);
      state = normalizeState(result.match.state);
      render();
      if (state.gameOver) window.clearInterval(online.pollTimer);
    } catch (error) {
      setStatus("El oponente se desconectó o la partida no respondió.");
    }
  }

  async function saveOnlineState() {
    if (!online.enabled || !online.matchId) return;
    const result = await Api.apiCasinoSaveGameMatch(Auth.token(), online.matchId, state);
    state = normalizeState(result.match.state);
    render();
  }

  async function playerAction() {
    if (!state || processing || state.gameOver) return;
    if (online.enabled && state.currentTurn !== online.mySlot) {
      UI.toast("Espera tu turno.", "warning");
      return;
    }
    if (!online.enabled && state.currentTurn !== "player") return;

    processing = true;
    setStatus("Procesando jugada...");
    render();
    applyPlay(online.enabled ? online.mySlot : "player");
    render();

    if (online.enabled) await saveOnlineState();
    processing = false;

    if (!online.enabled && !state.gameOver && state.currentTurn === "enemy") {
      window.setTimeout(botAction, 650);
    }
  }

  function botAction() {
    if (!state || state.gameOver || state.currentTurn !== "enemy") return;
    setStatus("El bot está jugando...");
    applyPlay("enemy");
    render();
  }

  function applyPlay(slot) {
    const play = config.makePlay();
    state.roundData[slot] = play;
    state.log.push(`${state.players[slot].name}: ${config.resultLabel(play)}`);
    const other = slot === "player" ? "enemy" : "player";

    if (!state.roundData[other]) {
      state.currentTurn = other;
      state.statusMessage = slot === (online.mySlot || "player")
        ? "Pasando al turno del oponente..."
        : "Tu turno";
      return;
    }

    resolveRound();
  }

  function resolveRound() {
    const player = state.roundData.player;
    const enemy = state.roundData.enemy;
    if (!player || !enemy) return;

    let winner = "";
    if (player.total > enemy.total) winner = "player";
    if (enemy.total > player.total) winner = "enemy";

    if (winner) {
      state.players[winner].score += 1;
      state.log.push(`Ronda ${state.round}: gana ${state.players[winner].name}.`);
    } else {
      state.log.push(`Ronda ${state.round}: empate, nadie suma.`);
    }

    if (state.players.player.score >= 2 || state.players.enemy.score >= 2 || state.round >= state.maxRounds) {
      finishGame();
      return;
    }

    state.round += 1;
    state.roundData = {};
    state.currentTurn = winner || (state.currentTurn === "player" ? "enemy" : "player");
    state.statusMessage = state.currentTurn === (online.mySlot || "player") ? "Tu turno" : "Esperando acción del oponente...";
  }

  function finishGame() {
    state.gameOver = true;
    if (state.players.player.score === state.players.enemy.score) {
      state.winner = "draw";
      state.statusMessage = "Empate. Moneda jugada sin recompensa.";
      state.log.push("La partida terminó empatada.");
      return;
    }
    state.winner = state.players.player.score > state.players.enemy.score ? "player" : "enemy";
    state.statusMessage = `Ganó ${state.players[state.winner].name}.`;
    state.log.push(state.statusMessage);
  }

  function createInitialState(players, mode) {
    return {
      gameType,
      localMatchId: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      mode,
      title: config.title,
      round: 1,
      maxRounds: 3,
      currentTurn: "player",
      players: {
        player: { ...players.player, score: 0 },
        enemy: { ...players.enemy, score: 0 }
      },
      roundData: {},
      log: [`${config.title} empezó. Tu turno.`],
      statusMessage: "Tu turno",
      gameOver: false,
      winner: ""
    };
  }

  function normalizeState(next) {
    return {
      ...createInitialState({
        player: next?.players?.player || { name: "Jugador" },
        enemy: next?.players?.enemy || { name: "Rival" }
      }, next?.mode || "online"),
      ...next,
      players: {
        player: { ...(next?.players?.player || {}), score: Number(next?.players?.player?.score || 0) },
        enemy: { ...(next?.players?.enemy || {}), score: Number(next?.players?.enemy?.score || 0) }
      },
      roundData: next?.roundData || {},
      log: Array.isArray(next?.log) ? next.log.slice(-80) : []
    };
  }

  function payEntry() {
    if (CasinoCoins.getCoins() < COST) {
      CasinoCoins.showNoCoinsMessage();
      return false;
    }
    CasinoCoins.setCoins(CasinoCoins.getCoins() - COST);
    CasinoCoins.renderCoinBalance(document);
    return true;
  }

  function render() {
    if (!state) return;
    const mineSlot = online.enabled ? online.mySlot : "player";
    const rivalSlot = mineSlot === "player" ? "enemy" : "player";
    setText("[data-duelo-round]", `Ronda ${state.round} / ${state.maxRounds}`);
    setText("[data-duelo-player-name]", state.players[mineSlot]?.name || "Jugador");
    setText("[data-duelo-enemy-name]", state.players[rivalSlot]?.name || "Rival");
    setText("[data-duelo-player-score]", state.players[mineSlot]?.score || 0);
    setText("[data-duelo-enemy-score]", state.players[rivalSlot]?.score || 0);
    setText("[data-duelo-player-result]", config.resultLabel(state.roundData[mineSlot]));
    setText("[data-duelo-enemy-result]", config.resultLabel(state.roundData[rivalSlot]));
    setText("[data-duelo-symbol]", config.symbol);
    setStatus(statusFor(mineSlot));
    const button = document.querySelector("[data-duelo-action]");
    if (button) {
      const canAct = !processing && !state.gameOver && state.currentTurn === mineSlot;
      button.disabled = !canAct;
      button.classList.toggle("disabled-play-button", !canAct);
      button.textContent = state.gameOver ? "Partida finalizada" : config.action;
    }
    const log = document.querySelector("[data-duelo-log]");
    if (log) log.innerHTML = state.log.slice(-12).map(item => `<div class="log-entry">${UI.escapeHTML(item)}</div>`).join("");
    applyRewardOnce(mineSlot);
    CasinoCoins.renderCoinBalance(document);
  }

  function applyRewardOnce(mineSlot) {
    if (!state?.gameOver || state.winner === "draw") return;
    const rewardKey = `casino_duelo_reward_${online.matchId || state.localMatchId}_${CasinoCoins.getCasinoUserKey()}`;
    if (localStorage.getItem(rewardKey) === "1") return;
    localStorage.setItem(rewardKey, "1");
    if (state.winner === mineSlot) {
      CasinoCoins.setCoins(CasinoCoins.getCoins() + WIN_REWARD);
      UI.toast(`Ganaste ${WIN_REWARD} monedas.`, "success");
    } else {
      UI.toast("Perdiste la moneda de entrada.", "warning");
    }
  }

  function statusFor(mineSlot) {
    if (state.gameOver) return state.statusMessage || "Partida finalizada";
    if (processing) return "Procesando jugada...";
    if (state.currentTurn === mineSlot) return "Tu turno";
    return online.enabled ? "Esperando acción del oponente..." : "Turno del bot...";
  }

  function setStatus(message) {
    setText("[data-duelo-status]", message);
  }

  function showArena() {
    const mode = document.querySelector("[data-duelo-mode-screen]");
    const arena = document.querySelector("[data-duelo-arena]");
    if (mode) mode.hidden = true;
    if (arena) arena.hidden = false;
  }

  function showMatchmaking(show) {
    const panel = document.querySelector("[data-duelo-matchmaking]");
    if (panel) panel.hidden = !show;
  }

  function setModeButtons(enabled) {
    document.querySelectorAll("[data-duelo-start]").forEach(button => {
      button.disabled = !enabled;
      button.classList.toggle("is-matchmaking-disabled", !enabled);
    });
  }

  function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = String(value);
  }

  function cleanup() {
    window.clearInterval(online.pollTimer);
    window.clearInterval(online.matchTimer);
    online = { enabled: false, matchId: "", mySlot: "player", pollTimer: null, matchTimer: null, paid: false };
    processing = false;
    state = null;
  }

  function roll(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  window.addEventListener("hashchange", cleanup);

  return { init };
})();
