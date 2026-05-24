// ruletaBogotana.js — Lógica principal del juego

const gameState = {
  mode: 'bot',
  round: 1,
  maxLives: 5,
  currentTurn: 'player',
  players: {
    player: { name: 'Jugador', lives: 5, powers: [], shield: false, doubleDamage: false, skipTurn: false },
    enemy:  { name: 'Bot',    lives: 5, powers: [], shield: false, doubleDamage: false, skipTurn: false }
  },
  chamber: [],
  realCount: 0,
  fakeCount: 0,
  roundSize: 4,
  log: [],
  gameOver: false,
  isRoundIntro: false,
  actionProcessing: false,
  statusMessage: '',
  coinStakePaid: false,
  coinSettled: false,
  soundOn: false,
  botThinking: false,
  online: {
    enabled: false,
    matchId: "",
    queueId: "",
    mySlot: "player",
    lastUpdatedAt: "",
    pollTimer: null,
    saving: false,
    fetching: false,
    saveQueued: false,
    isMatchmaking: false,
    lastSavedState: ""
  }
};

let casinoMusic = null;
const ONLINE_MATCHMAKING_POLL_MS = 850;
const ONLINE_GAME_POLL_MS = 500;

// ---------- INIT ----------
function initRuletaBogotana() {
  const user = (() => {
    try { return Auth.user() || JSON.parse(localStorage.getItem('usuarioActual')); } catch(e){ return Auth.user(); }
  })();
  if (user) {
    gameState.players.player.name = user.nombre || user.username || 'Jugador';
  }

  const ageOk = typeof AgeGate !== 'undefined' ? AgeGate.isConfirmed() : localStorage.getItem('casino_age_confirmed') === 'true';
  if (!ageOk) {
    location.hash = '#/casino';
    return;
  }

  if (typeof CasinoCoins !== 'undefined') {
    CasinoCoins.initializeCoins();
    CasinoCoins.renderCoinBalance(document);
  }
  bindRuletaButtons();

  gameState.coinStakePaid = false;
  gameState.coinSettled = false;
  showModeSelect();
}

function bindRuletaButtons() {
  const root = document.getElementById('ruletaRoot');
  if (!root || root.dataset.ruletaBound === 'true') return;
  root.dataset.ruletaBound = 'true';

  root.addEventListener('click', event => {
    const button = event.target.closest('[data-ruleta-action]');
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;

    event.preventDefault();
    const action = button.dataset.ruletaAction;
    const isDev = typeof DEMO_MODE !== 'undefined' && DEMO_MODE;
    if (isDev) console.log(`Ruleta action: ${action}`);

    if (action === 'start') {
      startGame(button.dataset.startMode);
      return;
    }
    if (action === 'shoot-enemy') {
      if (isDev) console.log('Boton disparar enemigo presionado');
      shoot(button.dataset.target || 'enemy');
      return;
    }
    if (action === 'shoot-self') {
      if (isDev) console.log('Boton dispararse presionado');
      shoot('self');
      return;
    }
    if (action === 'sound') {
      toggleSound();
      return;
    }
    if (action === 'reset') {
      resetGame();
      return;
    }
    if (action === 'cancel-match') {
      cancelOnlineMatchmaking();
    }
  });
}

// ---------- MODE SELECT ----------
function showModeSelect() {
  const modeSelect = document.getElementById('mode-select');
  const gameArena = document.getElementById('game-arena');
  const endScreen = document.getElementById('end-screen');
  if (!modeSelect || !gameArena || !endScreen) return;
  modeSelect.style.display = 'flex';
  gameArena.style.display  = 'none';
  endScreen.style.display  = 'none';
  if (typeof CasinoCoins !== 'undefined') CasinoCoins.renderCoinBalance(document);
  setMatchmaking(false);
  hideScannerOverlay();
}

function startGame(mode) {
  gameState.coinStakePaid = false;
  gameState.coinSettled = false;

  if (mode === 'pvp') {
    startOnlineMatchmaking();
    return;
  }

  if (!payGameCoin()) return;
  startCasinoMusic();
  stopOnlinePolling();
  gameState.mode  = mode;
  gameState.round = 1;
  gameState.roundSize = 4;
  gameState.gameOver  = false;
  gameState.isRoundIntro = false;
  gameState.actionProcessing = false;
  gameState.statusMessage = 'Tu turno';
  gameState.coinSettled = false;
  gameState.log = [];
  window.clearTimeout(gameState.roundIntroTimer);
  hideRoundIntroOverlay();
  hideScannerOverlay();

  const user = (() => { try { return Auth.user() || JSON.parse(localStorage.getItem('usuarioActual')); } catch(e){ return Auth.user(); } })();
  gameState.players.player.name = (user && (user.nombre || user.username)) || 'Jugador';
  gameState.players.enemy.name  = 'Bot';

  resetPlayerStats('player');
  resetPlayerStats('enemy');

  document.getElementById('mode-select').style.display = 'none';
  document.getElementById('game-arena').style.display  = 'flex';
  document.getElementById('end-screen').style.display  = 'none';

  startRound();
}

function payGameCoin() {
  if (gameState.coinStakePaid) return true;
  if (typeof CasinoCoins === 'undefined') return true;
  if (!CasinoCoins.spendCoin()) {
    CasinoCoins.showNoCoinsMessage();
    return false;
  }
  gameState.coinStakePaid = true;
  gameState.coinSettled = false;
  addLog('Moneda de casino descontada para iniciar la partida.');
  return true;
}

function resetPlayerStats(who) {
  const p = gameState.players[who];
  p.lives       = gameState.maxLives;
  p.powers      = getRandomPowers(2);
  p.shield      = false;
  p.doubleDamage= false;
  p.skipTurn    = false;
}

async function startOnlineMatchmaking() {
  if (gameState.online.isMatchmaking) return;

  if (!Auth.isLoggedIn()) {
    UI.toast('Debes iniciar sesión para jugar contra otro usuario registrado.', 'warning');
    location.hash = '#/login';
    return;
  }

  if (typeof CasinoCoins !== 'undefined' && !CasinoCoins.canPlayCasinoGame()) {
    CasinoCoins.showNoCoinsMessage();
    return;
  }

  stopOnlinePolling();
  gameState.online.isMatchmaking = true;
  gameState.online.enabled = false;
  gameState.online.matchId = "";
  gameState.online.queueId = "";
  gameState.online.lastUpdatedAt = "";
  setMatchmaking(true, 'Buscando jugador...', 'Conectando con un rival registrado. Puedes cancelar la busqueda cuando quieras.');

  try {
    const result = await Api.apiRuletaJoinMatch(Auth.token());
    if (result.status === 'matched') {
      loadOnlineMatch(result.match);
      return;
    }

    gameState.online.enabled = true;
    gameState.online.matchId = result.matchId || "";
    gameState.online.queueId = result.queueId || "";
    setMatchmaking(true, 'Buscando jugador...', 'Aun no hay rival disponible. Seguimos revisando la sala en tiempo real.');
    startWaitingForMatch();
  } catch (error) {
    gameState.online.isMatchmaking = false;
    setMatchmaking(false);
    UI.toast(error.message, 'error');
  }
}

function setMatchmaking(isVisible, title = '', detail = '') {
  const panel = document.getElementById('online-matchmaking');
  if (!panel) return;
  panel.hidden = !isVisible;
  panel.setAttribute('aria-busy', String(isVisible));
  const titleEl = document.getElementById('matchmaking-title');
  const detailEl = document.getElementById('matchmaking-detail');
  if (titleEl && title) titleEl.textContent = title;
  if (detailEl && detail) detailEl.textContent = detail;
  document.querySelectorAll('[data-ruleta-action="start"]').forEach(button => {
    button.disabled = isVisible;
    button.classList.toggle('is-matchmaking-disabled', isVisible);
  });
  if (!isVisible && typeof CasinoCoins !== 'undefined') CasinoCoins.renderCoinBalance(document);
}

function startWaitingForMatch() {
  stopOnlinePolling();
  gameState.online.pollTimer = window.setInterval(pollMatchmakingOnce, ONLINE_MATCHMAKING_POLL_MS);
}

async function cancelOnlineMatchmaking() {
  const wasMatchmaking = gameState.online.isMatchmaking;
  gameState.online.isMatchmaking = false;
  gameState.online.queueId = "";
  stopOnlinePolling();
  setMatchmaking(false);
  if (!wasMatchmaking) return;
  try {
    await Api.apiRuletaCancelMatchmaking(Auth.token());
  } catch (error) {
    UI.toast(error.message, 'error');
  }
}

async function pollMatchmakingOnce() {
  if (!gameState.online.isMatchmaking || gameState.online.fetching) return;
  gameState.online.fetching = true;
  try {
    const result = await Api.apiRuletaJoinMatch(Auth.token());
    if (result.status === 'matched') {
      loadOnlineMatch(result.match);
      return;
    }
    gameState.online.queueId = result.queueId || gameState.online.queueId;
  } catch (error) {
    gameState.online.isMatchmaking = false;
    stopOnlinePolling();
    setMatchmaking(false);
    UI.toast(error.message, 'error');
  } finally {
    gameState.online.fetching = false;
  }
}

function loadOnlineMatch(match) {
  if (!match || !match.state) return;
  const currentUser = Auth.user();
  const playerId = match.state.players?.player?.userId || "";
  const enemyId = match.state.players?.enemy?.userId || "";
  if (currentUser?.userId && playerId === currentUser.userId && enemyId === currentUser.userId) {
    cancelOnlineMatchmaking();
    UI.toast('No se pudo cargar un rival valido. Intenta buscar de nuevo.', 'error');
    return;
  }
  if (!payGameCoin()) {
    cancelOnlineMatchmaking();
    return;
  }
  startCasinoMusic();
  gameState.online.isMatchmaking = false;
  stopOnlinePolling();
  setMatchmaking(false);
  applyOnlineState(match.state);
  gameState.online.enabled = true;
  gameState.online.matchId = match.matchId;
  gameState.online.queueId = "";
  gameState.online.mySlot = match.mySlot;
  gameState.online.lastUpdatedAt = match.updatedAt || "";
  gameState.online.lastSavedState = JSON.stringify(serializeOnlineState());

  document.getElementById('mode-select').style.display = 'none';
  document.getElementById('game-arena').style.display  = 'flex';
  document.getElementById('end-screen').style.display  = 'none';
  addLog(`🌐 Partida online contra ${gameState.players[opponentSlot()].name}.`);
  renderGame();
  startOnlinePolling();
}

function startOnlinePolling() {
  stopOnlinePolling();
  if (!gameState.online.enabled || !gameState.online.matchId) return;
  fetchOnlineMatchState();
  gameState.online.pollTimer = window.setInterval(fetchOnlineMatchState, ONLINE_GAME_POLL_MS);
}

function stopOnlinePolling() {
  if (gameState.online.pollTimer) {
    window.clearInterval(gameState.online.pollTimer);
    gameState.online.pollTimer = null;
  }
}

async function fetchOnlineMatchState() {
  if (!gameState.online.enabled || !gameState.online.matchId || gameState.online.fetching) return;
  gameState.online.fetching = true;
  try {
    const result = await Api.apiRuletaGetMatch(Auth.token(), gameState.online.matchId);
    const match = result.match;
    if (!match || match.updatedAt === gameState.online.lastUpdatedAt) return;
    applyOnlineState(match.state);
    gameState.online.mySlot = match.mySlot;
    gameState.online.lastUpdatedAt = match.updatedAt || "";
    renderGame();
    if (gameState.gameOver) showOnlineEndIfNeeded();
  } catch (error) {
    UI.toast(error.message, 'error');
  } finally {
    gameState.online.fetching = false;
  }
}

async function saveOnlineState() {
  if (!gameState.online.enabled || !gameState.online.matchId) return;
  const state = serializeOnlineState();
  const stateJson = JSON.stringify(state);
  if (stateJson === gameState.online.lastSavedState) return;

  if (gameState.online.saving) {
    gameState.online.saveQueued = true;
    return;
  }

  gameState.online.saving = true;
  gameState.online.saveQueued = false;
  try {
    const result = await Api.apiRuletaSaveMatch(Auth.token(), gameState.online.matchId, state);
    if (result.match) {
      gameState.online.lastUpdatedAt = result.match.updatedAt || gameState.online.lastUpdatedAt;
      gameState.online.lastSavedState = stateJson;
    }
  } catch (error) {
    UI.toast(error.message, 'error');
  } finally {
    gameState.online.saving = false;
    if (gameState.online.saveQueued) {
      saveOnlineState();
    } else {
      fetchOnlineMatchState();
    }
  }
}

function serializeOnlineState() {
  return {
    mode: 'online',
    round: gameState.round,
    maxLives: gameState.maxLives,
    currentTurn: gameState.currentTurn,
    players: gameState.players,
    chamber: gameState.chamber,
    realCount: gameState.realCount,
    fakeCount: gameState.fakeCount,
    roundSize: gameState.roundSize,
    log: gameState.log,
    gameOver: gameState.gameOver
  };
}

function applyOnlineState(state) {
  gameState.mode = 'online';
  gameState.round = Number(state.round || 1);
  gameState.maxLives = Number(state.maxLives || 5);
  gameState.currentTurn = state.currentTurn || 'player';
  gameState.players = hydrateOnlinePlayers(state.players || gameState.players);
  gameState.chamber = Array.isArray(state.chamber) ? state.chamber : [];
  gameState.realCount = Number(state.realCount || 0);
  gameState.fakeCount = Number(state.fakeCount || 0);
  gameState.roundSize = Number(state.roundSize || 4);
  gameState.log = Array.isArray(state.log) ? state.log : [];
  gameState.gameOver = Boolean(state.gameOver);
  gameState.botThinking = false;
  gameState.actionProcessing = false;
  gameState.statusMessage = isOnlineMyTurn() ? 'Tu turno' : 'Esperando accion del oponente...';
}

function hydrateOnlinePlayers(players) {
  ['player', 'enemy'].forEach(slot => {
    const actor = players[slot] || {};
    actor.powers = (actor.powers || []).map(power => typeof power === 'string'
      ? { ...POWERS_CATALOG[power], usedThisRound: false }
      : { ...power });
    players[slot] = {
      name: actor.name || (slot === 'player' ? 'Jugador 1' : 'Jugador 2'),
      userId: actor.userId || '',
      lives: Number(actor.lives ?? 5),
      powers: actor.powers,
      shield: Boolean(actor.shield),
      doubleDamage: Boolean(actor.doubleDamage),
      skipTurn: Boolean(actor.skipTurn)
    };
  });
  return players;
}

function opponentSlot() {
  return gameState.online.mySlot === 'player' ? 'enemy' : 'player';
}

function isOnlineMyTurn() {
  return gameState.online.enabled && gameState.currentTurn === gameState.online.mySlot;
}

// ---------- ROUND ----------
function startRound() {
  gameState.roundSize = Math.min(4 + gameState.round - 1, 9);
  const counts = generateRoundCounts(gameState.roundSize);
  gameState.realCount = counts.real;
  gameState.fakeCount = counts.fake;
  gameState.chamber = buildShuffledChamber(counts.real, counts.fake);

  gameState.players.player.shield      = false;
  gameState.players.player.doubleDamage= false;
  gameState.players.enemy.shield       = false;
  gameState.players.enemy.doubleDamage = false;

  // Renovar poderes cada ronda (max 3 acumulados)
  ['player', 'enemy'].forEach(who => {
    const p = gameState.players[who];
    p.powers.forEach(pw => pw.usedThisRound = false);
    if (p.powers.length < 3) {
      const newPowers = getRandomPowers(Math.min(2, 3 - p.powers.length));
      newPowers.forEach(np => {
        if (!p.powers.find(ep => ep.id === np.id)) p.powers.push(np);
      });
    }
  });

  addLog(`Ronda ${gameState.round}: Se metieron ${gameState.realCount} reales y ${gameState.fakeCount} falsas. Buena suerte.`);
  renderGame();
  showRoundIntroOverlay(gameState.round, counts.real, counts.fake);
}

function generateRoundCounts(total) {
  const real = randomInteger(1, total - 1);
  return { real, fake: total - real };
}

function buildShuffledChamber(realCount, fakeCount) {
  const chamber = [];
  for (let i = 0; i < realCount; i++) chamber.push('real');
  for (let i = 0; i < fakeCount; i++) chamber.push('fake');
  return shuffleArray(chamber);
}

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInteger(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function updateChamberCountsAfterShot(charge) {
  if (charge === 'real') {
    gameState.realCount = Math.max(0, gameState.realCount - 1);
  } else {
    gameState.fakeCount = Math.max(0, gameState.fakeCount - 1);
  }
}

function showRoundIntroOverlay(round, realCount, fakeCount) {
  gameState.isRoundIntro = true;
  gameState.statusMessage = `Preparando ronda ${round}...`;
  renderGame();

  const overlay = document.getElementById('roundIntroOverlay');
  const title = document.getElementById('roundIntroTitle');
  const text = document.getElementById('roundIntroText');
  if (title) title.textContent = `Ronda ${round}`;
  if (text) text.textContent = `Se metieron ${realCount} reales y ${fakeCount} falsas.`;
  if (overlay) overlay.classList.remove('hidden');

  window.clearTimeout(gameState.roundIntroTimer);
  gameState.roundIntroTimer = window.setTimeout(() => {
    hideRoundIntroOverlay();
    gameState.isRoundIntro = false;
    renderGame();
    continueTurnAfterRoundIntro();
  }, 1600);
}

function hideRoundIntroOverlay() {
  const overlay = document.getElementById('roundIntroOverlay');
  if (overlay) overlay.classList.add('hidden');
}

function continueTurnAfterRoundIntro() {
  if (gameState.gameOver) return;
  if (!gameState.isRoundIntro && gameState.mode === 'bot' && gameState.currentTurn === 'enemy') {
    window.setTimeout(doBotTurn, 350);
  }
  if (gameState.online.enabled) saveOnlineState();
}

function checkRoundEnd() {
  if (gameState.chamber.length > 0 || gameState.gameOver) return false;
  gameState.round++;
  startRound();
  if (gameState.online.enabled) saveOnlineState();
  return true;
}

// ---------- SHOOT ----------
function shoot(target) {
  if (gameState.gameOver || gameState.botThinking || gameState.isRoundIntro || gameState.actionProcessing) return;
  if (gameState.online.enabled && !isOnlineMyTurn()) {
    UI.toast('Espera tu turno.', 'warning');
    return;
  }
  gameState.actionProcessing = true;
  gameState.statusMessage = 'Procesando jugada...';
  renderGame();
  const currentWho  = gameState.currentTurn;
  const currentActor= gameState.players[currentWho];
  const otherWho    = currentWho === 'player' ? 'enemy' : 'player';
  const otherActor  = gameState.players[otherWho];

  if (gameState.chamber.length === 0) {
    checkRoundEnd();
    gameState.actionProcessing = false;
    renderGame();
    return;
  }

  const charge = gameState.chamber.shift();
  updateChamberCountsAfterShot(charge);
  const isReal = charge === 'real';

  // Animación de disparo
  triggerShootAnim(target, isReal);

  if (target === 'self') {
    if (isReal) {
      // Daño a sí mismo
      let dmg = currentActor.doubleDamage ? 2 : 1;
      currentActor.doubleDamage = false;
      if (currentActor.shield) { dmg = Math.max(0, dmg - 1); currentActor.shield = false; addLog(`🛡 Escudo bloqueó 1 daño.`); }
      applyDamage(currentWho, dmg);
      addLog(`💥 ${currentActor.name} se disparó. Carga REAL. -${dmg} vida. Turno pasa.`);
      if (!checkWinner()) nextTurn();
    } else {
      currentActor.doubleDamage = false;
      addLog(`💨 ${currentActor.name} se disparó. Carga FALSA. Conserva el turno.`);
      if (checkRoundEnd()) {
        if (gameState.online.enabled) {
          saveOnlineState().finally(() => {
            gameState.actionProcessing = false;
            renderGame();
          });
        } else {
          gameState.actionProcessing = false;
        }
        return;
      }
      // Conserva el turno
      gameState.statusMessage = currentWho === (gameState.online.enabled ? gameState.online.mySlot : 'player') ? 'Tu turno otra vez' : 'Esperando accion del oponente...';
      gameState.actionProcessing = false;
      renderGame();
      if (gameState.online.enabled) saveOnlineState();
      if (gameState.mode === 'bot' && currentWho === 'enemy') {
        setTimeout(doBotTurn, 500);
      }
      return;
    }
  } else {
    // Disparar al enemigo
    if (isReal) {
      let dmg = currentActor.doubleDamage ? 2 : 1;
      currentActor.doubleDamage = false;
      if (otherActor.shield) { dmg = Math.max(0, dmg - 1); otherActor.shield = false; addLog(`🛡 Escudo bloqueó 1 daño.`); }
      applyDamage(otherWho, dmg);
      addLog(`💥 ${currentActor.name} disparó a ${otherActor.name}. Carga REAL. -${dmg} vida.`);
      if (!checkWinner()) nextTurn();
    } else {
      // Doble daño fallido al disparar a enemigo con falsa
      if (currentActor.doubleDamage) {
        currentActor.doubleDamage = false;
        addLog(`⚡❌ Golpe Doble FALLIDO. Carga falsa. ${currentActor.name} pierde el turno.`);
      } else {
        addLog(`💨 ${currentActor.name} disparó a ${otherActor.name}. Carga FALSA. Sin daño. Turno pasa.`);
      }
      nextTurn();
    }
  }

  if (checkRoundEnd()) {
    gameState.actionProcessing = false;
    return;
  }
  if (gameState.online.enabled) {
    saveOnlineState().finally(() => {
      gameState.actionProcessing = false;
      renderGame();
    });
  } else {
    gameState.actionProcessing = false;
    renderGame();
  }
}

function applyDamage(who, amount) {
  gameState.players[who].lives = Math.max(0, gameState.players[who].lives - amount);
  triggerDamageAnim(who);
}

// ---------- TURN ----------
function nextTurn() {
  if (gameState.gameOver) return;
  const prev    = gameState.currentTurn;
  const next    = prev === 'player' ? 'enemy' : 'player';
  const nextAct = gameState.players[next];

  if (nextAct.skipTurn) {
    nextAct.skipTurn = false;
    addLog(`⛓ ${nextAct.name} pierde su turno (Esposas del CAI).`);
    gameState.currentTurn = prev; // se queda el mismo
    gameState.statusMessage = prev === (gameState.online.enabled ? gameState.online.mySlot : 'player') ? 'Tu turno' : 'Esperando accion del oponente...';
    renderGame();
    if (!gameState.isRoundIntro && gameState.mode === 'bot' && gameState.currentTurn === 'enemy') {
      setTimeout(doBotTurn, 450);
    }
    return;
  }

  gameState.currentTurn = next;
  if (gameState.online.enabled) {
    gameState.statusMessage = next === gameState.online.mySlot ? 'Tu turno' : 'Pasando al turno del oponente...';
  } else {
    gameState.statusMessage = next === 'player' ? 'Tu turno' : 'Pasando al turno del oponente...';
  }
  renderGame();

  if (!gameState.isRoundIntro && gameState.mode === 'bot' && gameState.currentTurn === 'enemy') {
    setTimeout(doBotTurn, 500);
  }
}

// ---------- BOT TURN ----------
async function doBotTurn() {
  if (gameState.gameOver || gameState.isRoundIntro || gameState.currentTurn !== 'enemy' || gameState.mode !== 'bot') return;
  gameState.botThinking = true;
  gameState.statusMessage = 'Esperando accion del oponente...';
  renderGame();

  await botThink(420 + Math.random() * 260);

  const decision = botDecide(gameState);

  if (decision.action === 'power') {
    const result = applyPower(decision.power, gameState, 'enemy');
    addLog(`🤖 Bot usa poder: ${result.msg}`);
    renderGame();
    if (result.consumesTurn) {
      gameState.botThinking = false;
      nextTurn(); return;
    }
    await botThink(280);
    gameState.botThinking = false;
    doBotTurn();
    return;
  }

  gameState.botThinking = false;

  if (decision.action === 'shoot') {
    const target = decision.target === 'player' ? 'player' : 'self';
    shoot(target);
  }
}

// ---------- POWER USAGE ----------
function playerUsePower(powerId) {
  if (gameState.gameOver || gameState.botThinking || gameState.isRoundIntro || gameState.actionProcessing) return;
  if (gameState.online.enabled && !isOnlineMyTurn()) {
    UI.toast('Espera tu turno.', 'warning');
    return;
  }
  if (gameState.currentTurn !== 'player' && gameState.mode === 'bot') return;

  const who    = gameState.online.enabled ? gameState.online.mySlot : gameState.currentTurn;
  const canUse = canUsePower(powerId, gameState, who);
  if (!canUse) { addLog('⚠ No puedes usar ese poder ahora.'); renderGame(); return; }

  const result = applyPower(powerId, gameState, who);
  addLog(`${result.msg}`);
  if (powerId === 'scanner' && result.scanResult) {
    showScannerOverlay(result.scanResult);
  }

  if (result.consumesTurn) {
    nextTurn();
  } else {
    renderGame();
    // Si el bot ahora tiene turno (no debería pasar aquí), pero por si acaso
  }
  if (gameState.online.enabled) saveOnlineState();
}

function showScannerOverlay(scanResult) {
  const overlay = document.getElementById('scannerOverlay');
  const text = document.getElementById('scannerResultText');
  if (!overlay || !text) {
    UI.toast(`La proxima carga parece: ${scanResult}`, 'info');
    return;
  }
  text.textContent = `La proxima carga parece: ${scanResult}`;
  overlay.classList.remove('hidden');
  window.clearTimeout(gameState.scannerOverlayTimer);
  gameState.scannerOverlayTimer = window.setTimeout(() => {
    hideScannerOverlay();
  }, 2400);
}

function hideScannerOverlay() {
  window.clearTimeout(gameState.scannerOverlayTimer);
  document.getElementById('scannerOverlay')?.classList.add('hidden');
}

// ---------- WINNER ----------
function checkWinner() {
  const p = gameState.players.player;
  const e = gameState.players.enemy;
  if (p.lives <= 0 || e.lives <= 0) {
    gameState.gameOver = true;
    const winner = p.lives > 0 ? p.name : e.name;
    const loser  = p.lives > 0 ? e.name  : p.name;
    setTimeout(() => showEndScreen(winner, loser), 450);
    return true;
  }
  return false;
}

function showEndScreen(winner, loser) {
  stopCasinoMusic();
  settleCasinoCoins(winner);
  document.getElementById('game-arena').style.display = 'none';
  document.getElementById('end-screen').style.display = 'flex';
  document.getElementById('end-winner').textContent   = winner;
  document.getElementById('end-loser').textContent    = loser;
  document.getElementById('end-rounds').textContent   = gameState.round;
  document.getElementById('end-log').innerHTML = gameState.log.slice(-8).map(l => `<li>${l}</li>`).join('');
  if (typeof CasinoCoins !== 'undefined') CasinoCoins.renderCoinBalance(document);
}

function settleCasinoCoins(winner) {
  if (!gameState.coinStakePaid || gameState.coinSettled || typeof CasinoCoins === 'undefined') return;
  const userSlot = gameState.online.enabled ? gameState.online.mySlot : 'player';
  const userWon = gameState.players[userSlot]?.name === winner && gameState.players[userSlot]?.lives > 0;

  if (userWon) {
    CasinoCoins.rewardWin();
    addLog('Ganaste la partida. Recuperaste tu moneda y ganaste 1 moneda del enemigo.');
    UI.toast('Ganaste 2 monedas de casino.', 'success');
  } else {
    CasinoCoins.handleLoss();
    addLog('Perdiste la partida. La moneda jugada se perdio.');
    UI.toast('Perdiste la moneda jugada.', 'warning');
  }
  gameState.coinSettled = true;
}

function showOnlineEndIfNeeded() {
  if (!gameState.gameOver) return;
  const p = gameState.players.player;
  const e = gameState.players.enemy;
  const winner = p.lives > 0 ? p.name : e.name;
  const loser = p.lives > 0 ? e.name : p.name;
  showEndScreen(winner, loser);
}

// ---------- RESET ----------
function resetGame() {
  stopCasinoMusic();
  stopOnlinePolling();
  gameState.online.enabled = false;
  gameState.online.matchId = "";
  gameState.online.queueId = "";
  gameState.online.lastUpdatedAt = "";
  gameState.online.saving = false;
  gameState.online.fetching = false;
  gameState.online.saveQueued = false;
  gameState.online.isMatchmaking = false;
  gameState.online.lastSavedState = "";
  gameState.coinStakePaid = false;
  gameState.coinSettled = false;
  gameState.gameOver = false;
  gameState.isRoundIntro = false;
  gameState.botThinking = false;
  gameState.log = [];
  window.clearTimeout(gameState.roundIntroTimer);
  hideRoundIntroOverlay();
  hideScannerOverlay();
  showModeSelect();
}

function cleanupRuletaRuntime() {
  const shouldCancelQueue = gameState.online.isMatchmaking;
  stopCasinoMusic();
  stopOnlinePolling();
  window.clearTimeout(gameState.roundIntroTimer);
  window.clearTimeout(gameState.scannerOverlayTimer);
  gameState.online.enabled = false;
  gameState.online.matchId = "";
  gameState.online.queueId = "";
  gameState.online.lastUpdatedAt = "";
  gameState.online.saving = false;
  gameState.online.fetching = false;
  gameState.online.saveQueued = false;
  gameState.online.isMatchmaking = false;
  gameState.online.lastSavedState = "";
  if (shouldCancelQueue && Auth.isLoggedIn()) {
    Api.apiRuletaCancelMatchmaking(Auth.token()).catch(() => {});
  }
}

// ---------- RENDER ----------
function renderGame() {
  renderPlayerLabels();
  renderStatusBadges();
  renderLives();
  renderRoundInfo();
  renderActionButtons();
  const powersOwner = gameState.online.enabled ? gameState.online.mySlot : gameState.currentTurn;
  renderPowers(gameState, powersOwner,
    document.getElementById('powers-container'),
    playerUsePower
  );
  renderLog();
  renderTurnIndicator();
  render3DTable();
  if (typeof CasinoCoins !== 'undefined') CasinoCoins.renderCoinBalance(document);
  bindRuletaButtons();
}

function renderPlayerLabels() {
  const playerLabel = document.getElementById('label-player');
  const enemyLabel = document.getElementById('label-enemy');
  if (playerLabel) playerLabel.textContent = gameState.players.player.name.toUpperCase();
  if (enemyLabel) enemyLabel.textContent = gameState.players.enemy.name.toUpperCase();
}

function renderStatusBadges() {
  ['player', 'enemy'].forEach(who => {
    const el = document.getElementById(`status-${who}`);
    if (!el) return;
    const actor = gameState.players[who];
    const badges = [];
    if (actor.shield) badges.push('🛡 Escudo');
    if (actor.doubleDamage) badges.push('⚡ Doble daño');
    if (actor.skipTurn) badges.push('⛓ Pierde turno');
    el.innerHTML = badges.map(item => `<span class="status-badge">${item}</span>`).join('');
  });
}

function renderLives() {
  ['player', 'enemy'].forEach(who => {
    const p   = gameState.players[who];
    const el  = document.getElementById(`lives-${who}`);
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < gameState.maxLives; i++) {
      const heart = document.createElement('span');
      heart.className = 'heart' + (i < p.lives ? ' heart-full' : ' heart-empty');
      heart.textContent = i < p.lives ? '♥' : '♡';
      el.appendChild(heart);
    }
  });
}

function renderRoundInfo() {
  const ri = document.getElementById('round-info');
  if (!ri) return;
  ri.innerHTML = `
    <span class="ri-round">RONDA ${gameState.round}</span>
    <span class="ri-chamber">Cargas restantes: <b>${gameState.chamber.length}</b></span>
  `;
}

function renderTurnIndicator() {
  const ti = document.getElementById('turn-indicator');
  if (!ti) return;
  const who  = gameState.currentTurn;
  const name = gameState.players[who].name;
  ti.textContent = gameState.botThinking ? `🤖 ${name} pensando...` : `🎯 Turno de ${name}`;
  const mySlot = gameState.online.enabled ? gameState.online.mySlot : 'player';
  let statusLabel = gameState.statusMessage || (who === mySlot ? 'Tu turno' : 'Esperando accion del oponente...');
  if (gameState.botThinking) statusLabel = `${name} pensando...`;
  if (gameState.gameOver) statusLabel = 'Partida finalizada';
  ti.textContent = `${statusLabel} · Turno de ${name}`;
  ti.className   = 'turn-indicator turn-' + who;
}

function renderActionButtons() {
  const btns = document.getElementById('action-buttons');
  if (!btns) return;
  const isMyTurn = gameState.online.enabled ? isOnlineMyTurn() : gameState.currentTurn === 'player' ||
    (gameState.mode === 'pvp');
  const disabled = !isMyTurn || gameState.botThinking || gameState.gameOver || gameState.isRoundIntro || gameState.actionProcessing;

  const currentName = gameState.players[gameState.currentTurn].name;
  const enemyKey    = gameState.currentTurn === 'player' ? 'enemy' : 'player';
  const enemyName   = gameState.players[enemyKey].name;

  btns.innerHTML = `
    <button class="action-btn btn-shoot-enemy" ${disabled ? 'disabled' : ''}
      data-ruleta-action="shoot-enemy" data-target="${enemyKey}">
      🔫 Disparar a ${enemyName}
    </button>
    <button class="action-btn btn-shoot-self" ${disabled ? 'disabled' : ''}
      data-ruleta-action="shoot-self">
      💀 Dispararse
    </button>
  `;
  bindRuletaButtons();
}

function renderLog() {
  const logEl = document.getElementById('game-log');
  if (!logEl) return;
  logEl.innerHTML = gameState.log.slice(-6).reverse()
    .map(l => `<div class="log-entry">${l}</div>`).join('');
}

function render3DTable() {
  // La mesa 3D es estática CSS; aquí actualizamos clases de estado
  const arena = document.getElementById('table-3d');
  if (!arena) return;
  arena.className = 'table-3d turn-' + gameState.currentTurn;
}

// ---------- ANIMATIONS ----------
function triggerShootAnim(target, isReal) {
  const side = target === 'self'
    ? (gameState.currentTurn === 'player' ? 'player' : 'enemy')
    : (gameState.currentTurn === 'player' ? 'enemy'  : 'player');
  const el = document.getElementById(`zone-${side}`);
  if (!el) return;
  el.classList.remove('anim-hit', 'anim-miss');
  void el.offsetWidth;
  el.classList.add(isReal ? 'anim-hit' : 'anim-miss');
  setTimeout(() => el.classList.remove('anim-hit', 'anim-miss'), 520);

  const gun = document.getElementById('gun-3d');
  if (gun) {
    gun.classList.remove('gun-fire');
    void gun.offsetWidth;
    gun.classList.add('gun-fire');
    setTimeout(() => gun.classList.remove('gun-fire'), 420);
  }
}

function triggerDamageAnim(who) {
  const el = document.getElementById(`zone-${who}`);
  if (!el) return;
  el.classList.remove('anim-damage');
  void el.offsetWidth;
  el.classList.add('anim-damage');
  setTimeout(() => el.classList.remove('anim-damage'), 560);
}

// ---------- LOG ----------
function addLog(msg) {
  gameState.log.push(msg);
  if (gameState.log.length > 50) gameState.log.shift();
}

// ---------- SOUND TOGGLE ----------
function toggleSound() {
  if (!casinoMusic) initCasinoMusic();
  gameState.soundOn = !gameState.soundOn;
  if (casinoMusic) {
    casinoMusic.muted = !gameState.soundOn;
    if (gameState.soundOn && document.getElementById('game-arena')?.style.display !== 'none') {
      casinoMusic.play().catch(() => {});
    }
  }
  updateSoundButtons();
}

function initCasinoMusic() {
  if (casinoMusic) return casinoMusic;
  casinoMusic = new Audio('music/casino.mp3');
  casinoMusic.loop = true;
  casinoMusic.preload = 'auto';
  casinoMusic.volume = 0.38;
  casinoMusic.muted = false;
  return casinoMusic;
}

function startCasinoMusic() {
  initCasinoMusic();
  gameState.soundOn = true;
  casinoMusic.currentTime = 0;
  casinoMusic.muted = false;
  casinoMusic.play().catch(() => {
    UI.toast('Toca Sonido para activar la música.', 'info');
  });
  updateSoundButtons();
}

function stopCasinoMusic() {
  if (!casinoMusic) return;
  casinoMusic.pause();
  casinoMusic.currentTime = 0;
  gameState.soundOn = false;
  updateSoundButtons();
}

function updateSoundButtons() {
  const label = `${gameState.soundOn ? '🔊' : '🔇'} Sonido: ${gameState.soundOn ? 'ON' : 'OFF'}`;
  const btn = document.getElementById('sound-toggle');
  const btn2 = document.getElementById('sound-toggle2');
  if (btn) btn.textContent = label;
  if (btn2) btn2.textContent = label;
}

// ---------- START ----------
const RuletaBogotana = (() => ({
  init: initRuletaBogotana
}))();

window.startGame = startGame;
window.shoot = shoot;
window.resetGame = resetGame;
window.toggleSound = toggleSound;

window.addEventListener('hashchange', () => {
  if (location.hash !== '#/ruleta-bogotana') cleanupRuletaRuntime();
});
