/* ═══════════════════════════════════════════════════════════════
   BLACKJACK ROLO — LÓGICA PRINCIPAL
   Versión 1.0.0 · Modo Bot funcional · Estructura PvP lista
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────────────────────────────
   BARAJA
────────────────────────────────────────────────────────────── */
const SUITS  = ['♠','♥','♦','♣'];
const RANKS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return shuffle(deck);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ──────────────────────────────────────────────────────────────
   VALORES DE CARTAS
────────────────────────────────────────────────────────────── */
function cardValue(rank) {
  if (['J','Q','K'].includes(rank)) return 10;
  if (rank === 'A') return 11; // el As empieza en 11; se ajusta en handValue
  return parseInt(rank);
}

/**
 * Calcula el total óptimo de una mano.
 * El As vale 11; si el total supera 21 y hay Ases que valgan 11,
 * uno de ellos baja a 1 (se restan 10 por cada As usado).
 */
function handValue(hand) {
  let total = 0;
  let aces  = 0;
  for (const card of hand) {
    if (card.hidden) continue; // cartas boca abajo no suman
    const v = cardValue(card.rank);
    total  += v;
    if (card.rank === 'A') aces++;
  }
  // Bajar Ases de 11→1 mientras sea necesario
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

/** Valor total incluyendo cartas ocultas (para cálculos del bot/resultado) */
function fullHandValue(hand) {
  const exposed = hand.map(c => ({ ...c, hidden: false }));
  return handValue(exposed);
}

function isBust(hand) { return fullHandValue(hand) > 21; }
function isBlackjack(hand) { return hand.length === 2 && fullHandValue(hand) === 21; }

/* ──────────────────────────────────────────────────────────────
   ESTADO GLOBAL
────────────────────────────────────────────────────────────── */
const G = {
  coins:       5,
  bet:         1,
  gameMode:    'bot',
  gameActive:  false,

  deck:        [],
  playerHand:  [],
  botHand:     [],

  playerStood: false,
  botStood:    false,
  roundOver:   false,

  actionLock:  false,  // Anti-doble clic
  musicOn:     false,
  musicCtx:    null,
  musicTimer:  null,
  musicAudio:  null,
};

const ONLINE = {
  timer: null,
  searching: false,
  matchId: "",
  mySlot: "player",
};

/* ──────────────────────────────────────────────────────────────
   APUESTA
────────────────────────────────────────────────────────────── */
function cartasChangeBet(delta) {
  cartasSyncWallet();
  const nb = G.bet + delta;
  if (nb < 1 || nb > G.coins) return;
  G.bet = nb;
  const betEl = document.getElementById('bet-val');
  if (betEl) betEl.textContent = G.bet;
}

function cartasSetBet(amount) {
  cartasSyncWallet();
  amount = Math.max(1, Math.floor(Number(amount) || 1));
  if (amount > G.coins) { cartasShowToast('Saldo insuficiente', 'red'); return; }
  G.bet = amount;
  const betEl = document.getElementById('bet-val');
  if (betEl) betEl.textContent = G.bet;
}

function updateCoins() {
  const menuCoins = document.getElementById('menu-coins');
  const gameCoins = document.getElementById('game-coins');
  const betEl = document.getElementById('bet-val');
  if (menuCoins) menuCoins.textContent = G.coins;
  if (gameCoins) gameCoins.textContent = G.coins;
  if (betEl) betEl.textContent = G.bet;
  if (typeof CasinoCoins !== "undefined") CasinoCoins.renderCoinBalance(document);
}

function cartasSyncWallet() {
  if (typeof CasinoCoins !== "undefined") {
    CasinoCoins.initializeCoins();
    G.coins = CasinoCoins.getCoins();
  }
  G.bet = Math.max(1, Math.min(Number(G.bet) || 1, Math.max(G.coins, 1)));
  return G.coins;
}

function cartasCommitWallet() {
  if (typeof CasinoCoins !== "undefined") {
    G.coins = CasinoCoins.setCoins(G.coins);
    CasinoCoins.renderCoinBalance(document);
  }
}

/* ──────────────────────────────────────────────────────────────
   NAVEGACIÓN
────────────────────────────────────────────────────────────── */
function cartasShowScreen(id) {
  const target = document.getElementById(id);
  if (!target) return false;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  target.classList.add('active');
  return true;
}
function cartasGoToMenu() {
  G.gameActive = false;
  cartasShowScreen('screen-menu');
  cartasSyncWallet();
  updateCoins();
}
function cartasExitToCasino() {
  if (G.gameActive && !G.roundOver) {
    G.coins += G.bet;
    G.gameActive = false;
    cartasCommitWallet();
  }
  cartasCancelOnlineSearch(false);
  stopMusic();
  cartasUnlockCasinoNavigation();
  location.hash = '#/casino';
}
function cartasToggleRules() {
  document.getElementById('rules-box').classList.toggle('hidden');
}
function openOnlineModal()  {
  cartasStartOnlineSearch();
}
function closeOnlineModal() {
  cartasCancelOnlineSearch(true);
}
function cartasConfirmBack() {
  if (G.gameActive && !G.roundOver) {
    if (!confirm('¿Abandonar partida? Perderás tu apuesta.')) return;
    G.coins += G.bet;
    G.gameActive = false;
    cartasCommitWallet();
    cartasShowToast('Partida abandonada. Sin doble cobro.', 'yellow');
  }
  cartasGoToMenu();
}

/* ──────────────────────────────────────────────────────────────
   INICIO DE PARTIDA
────────────────────────────────────────────────────────────── */
function cartasStartGame(mode) {
  if (!document.getElementById('screen-game')) return;
  cartasSyncWallet();
  if (G.coins < G.bet) { cartasShowToast('Monedas insuficientes', 'red'); return; }
  if (G.gameActive)    { cartasShowToast('Partida en curso', 'red');       return; }

  G.gameMode   = mode;
  G.gameActive = false; // se activa solo cuando todo carga bien

  // Reset
  G.deck       = buildDeck();
  G.playerHand = [];
  G.botHand    = [];
  G.playerStood = false;
  G.botStood    = false;
  G.roundOver   = false;
  G.actionLock  = false;

  // Mostrar pantalla juego
  if (!cartasShowScreen('screen-game')) return;
  document.getElementById('rival-zone-label').textContent = mode === 'bot' ? 'BOT' : 'RIVAL';
  document.getElementById('game-bet').textContent = G.bet;
  document.getElementById('result-overlay').classList.add('hidden');
  clearCards();
  cartasSetStatus('Repartiendo…');
  setControlsEnabled(false);

  // Cobrar apuesta SOLO cuando la partida arranca correctamente
  G.coins      -= G.bet;
  G.gameActive  = true;
  cartasCommitWallet();
  updateCoins();

  // Repartir con animaciones escalonadas
  dealInitial();
}

function dealInitial() {
  // Repartir 2 al jugador y 2 al bot
  const delays = [0, 220, 440, 660];
  const sequence = [
    () => drawCard('player', false),
    () => drawCard('bot',    true),   // segunda carta bot boca abajo (estilo blackjack)
    () => drawCard('player', false),
    () => drawCard('bot',    false),
  ];
  sequence.forEach((fn, i) => setTimeout(fn, delays[i]));

  setTimeout(() => {
    renderHands();
    // Comprobar blackjack inmediato
    if (isBlackjack(G.playerHand)) {
      cartasSetStatus('🌟 ¡BLACKJACK!');
      setTimeout(endRound, 900);
      return;
    }
    cartasSetStatus('TU TURNO — Pide carta o plántate');
    setControlsEnabled(true);
  }, 900);
}

/* ──────────────────────────────────────────────────────────────
   REPARTIR CARTA
────────────────────────────────────────────────────────────── */
function drawCard(target, hidden = false) {
  if (G.deck.length === 0) G.deck = buildDeck(); // baraja agotada → nueva
  const card = { ...G.deck.pop(), hidden };
  if (target === 'player') G.playerHand.push(card);
  else                     G.botHand.push(card);
  return card;
}

/* ──────────────────────────────────────────────────────────────
   ACCIONES JUGADOR
────────────────────────────────────────────────────────────── */
function playerHit() {
  if (!G.gameActive) return;
  if (G.roundOver) return;
  if (G.playerStood) return;
  if (G.actionLock) return;
  if (G.playerHand.length >= 3) {
    cartasShowToast('Maximo 3 cartas. Debes plantarte.', 'yellow');
    cartasSetStatus('Maximo 3 cartas. Ahora debes plantarte.');
    setControlsEnabled(true);
    return;
  }

  G.actionLock = true;
  setControlsEnabled(false);
  drawCard('player', false);
  renderHands();

  const total = handValue(G.playerHand);

  if (total === 21) {
    cartasSetStatus('Llegaste a 21.');
    setTimeout(endRound, 800);
    return;
  }
  if (total > 21) {
    cartasSetStatus('Te pasaste de 21.');
    setTimeout(endRound, 800);
    return;
  }

  if (G.playerHand.length >= 3) {
    cartasSetStatus('Maximo 3 cartas. Ahora debes plantarte.');
  } else {
    cartasSetStatus('Tu turno');
  }
  setControlsEnabled(true);
  G.actionLock = false;
}

function playerStand() {
  if (!G.gameActive)   return;
  if (G.roundOver)     return;
  if (G.playerStood)   return;
  if (G.actionLock)    return;
  G.actionLock = true;

  G.playerStood = true;
  setControlsEnabled(false);
  cartasSetStatus('✋ Te plantaste. El bot juega…');

  // Revelar carta oculta del bot
  G.botHand.forEach(c => c.hidden = false);
  renderHands();

  setTimeout(botTurn, 800);
}

/* ──────────────────────────────────────────────────────────────
   TURNO DEL BOT
────────────────────────────────────────────────────────────── */
function botTurn() {
  const pTotal = handValue(G.playerHand);
  const bTotal = fullHandValue(G.botHand);

  // Lógica bot:
  // · Si tiene < 16 → pide carta
  // · Si tiene 17+ → se planta
  // · Si está perdiendo contra el jugador y tiene ≤ 19 → toma riesgo
  const isLosing = bTotal < pTotal && pTotal <= 21;

  if (G.botHand.length >= 3) {
    cartasSetStatus('El bot llego al maximo de 3 cartas.');
    G.botStood = true;
    setTimeout(endRound, 700);
    return;
  }

  if (bTotal >= 17 && !isLosing) {
    cartasSetStatus('🤚 El bot se planta');
    G.botStood = true;
    setTimeout(endRound, 900);
    return;
  }
  if (bTotal > 21) {
    cartasSetStatus('💥 El bot se pasó');
    G.botStood = true;
    setTimeout(endRound, 500);
    return;
  }

  // Bot pide carta
  cartasSetStatus('🤔 El bot está pensando…');
  setTimeout(() => {
    drawCard('bot', false);
    renderHands();
    const newTotal = fullHandValue(G.botHand);

    if (newTotal === 21) {
      cartasSetStatus('🌟 El bot llegó a 21');
      setTimeout(endRound, 700);
      return;
    }
    if (newTotal > 21) {
      cartasSetStatus('💥 El bot se pasó de 21');
      setTimeout(endRound, 700);
      return;
    }

    cartasSetStatus(`El bot tiene ${newTotal}. Pensando…`);
    setTimeout(botTurn, 900);
  }, 700 + Math.random() * 500);
}

/* ──────────────────────────────────────────────────────────────
   FIN DE RONDA — DETERMINAR GANADOR
────────────────────────────────────────────────────────────── */
function endRound() {
  G.roundOver  = true;
  G.gameActive = false;
  G.actionLock = false;

  // Revelar todas las cartas del bot
  G.botHand.forEach(c => c.hidden = false);
  renderHands();
  setControlsEnabled(false);

  const pTotal = fullHandValue(G.playerHand);
  const bTotal = fullHandValue(G.botHand);
  const pBust  = pTotal > 21;
  const bBust  = bTotal > 21;
  const pBJ    = isBlackjack(G.playerHand);
  const bBJ    = isBlackjack(G.botHand);

  let outcome; // 'win' | 'lose' | 'tie'
  let msg;
  let submsg;

  /* ── Reglas en orden de prioridad ── */
  if (pBJ && bBJ) {
    outcome = 'tie';
    msg     = 'EMPATE';
    submsg  = '¡Ambos tienen Blackjack!';
  } else if (pBJ) {
    outcome = 'win';
    msg     = '¡BLACKJACK!';
    submsg  = '¡Blackjack natural! Pagas 3:2.';
  } else if (bBJ) {
    outcome = 'lose';
    msg     = 'BOT BLACKJACK';
    submsg  = 'El bot tiene Blackjack. Perdiste.';
  } else if (!pBust && pTotal === 21) {
    outcome = 'win';
    msg     = '¡LLEGASTE A 21!';
    submsg  = 'Exacto 21. ¡Ganaste!';
  } else if (!bBust && bTotal === 21) {
    outcome = 'lose';
    msg     = 'BOT LLEGÓ A 21';
    submsg  = 'El bot tiene 21 exacto. Perdiste.';
  } else if (pBust && bBust) {
    // Ambos se pasan → gana quien quede más cerca de 21
    if (pTotal < bTotal) {
      outcome = 'win';
      msg     = '¡GANASTE!';
      submsg  = 'Ambos se pasaron. Estabas más cerca de 21.';
    } else if (bTotal < pTotal) {
      outcome = 'lose';
      msg     = 'PERDISTE';
      submsg  = 'Ambos se pasaron. El bot estaba más cerca de 21.';
    } else {
      outcome = 'tie';
      msg     = 'EMPATE';
      submsg  = 'Ambos se pasaron por igual.';
    }
  } else if (pBust) {
    outcome = 'lose';
    msg     = 'TE PASASTE';
    submsg  = `Te pasaste de 21 con ${pTotal}. Perdiste.`;
  } else if (bBust) {
    outcome = 'win';
    msg     = '¡TU RIVAL SE PASÓ!';
    submsg  = `El bot se pasó con ${bTotal}. ¡Ganaste!`;
  } else if (pTotal > bTotal) {
    outcome = 'win';
    msg     = '¡GANASTE!';
    submsg  = `Tu ${pTotal} supera al ${bTotal} del bot.`;
  } else if (bTotal > pTotal) {
    outcome = 'lose';
    msg     = 'PERDISTE';
    submsg  = `El bot tiene ${bTotal} vs tu ${pTotal}.`;
  } else {
    outcome = 'tie';
    msg     = 'EMPATE';
    submsg  = `Ambos tienen ${pTotal}.`;
  }

  /* ── Premio / castigo ── */
  let coinDelta = 0;
  if (outcome === 'win') {
    coinDelta = pBJ ? Math.floor(G.bet * 2.5) : Math.floor(G.bet * 1.9);
    G.coins  += coinDelta;
  } else if (outcome === 'lose') {
    coinDelta = -G.bet; // ya descontado al inicio
  } else {
    // Empate → devolver apuesta
    G.coins  += G.bet;
    coinDelta = 0;
  }
  cartasCommitWallet();
  updateCoins();

  /* ── Mostrar resultado ── */
  setTimeout(() => showResult(outcome, msg, submsg, coinDelta, pTotal, bTotal), 400);
}

function showResult(outcome, title, sub, coinDelta, pTotal, bTotal) {
  const icons = { win:'🏆', lose:'💀', tie:'🤝' };
  const classes= { win:'', lose:' lose', tie:' tie' };

  document.getElementById('res-icon').textContent   = icons[outcome];
  document.getElementById('res-title').textContent  = title;
  document.getElementById('res-title').className    = 'result-title' + classes[outcome];
  document.getElementById('res-sub').textContent    = sub;
  document.getElementById('rs-pscore').textContent  = pTotal;
  document.getElementById('rs-bscore').textContent  = bTotal;

  const cEl = document.getElementById('res-coins');
  if (outcome === 'win') {
    cEl.textContent = `+${coinDelta} 🪙`;
    cEl.className   = 'result-coins';
  } else if (outcome === 'lose') {
    cEl.textContent = `${coinDelta} 🪙`;
    cEl.className   = 'result-coins lose';
  } else {
    cEl.textContent = `± 0 🪙 (apuesta devuelta)`;
    cEl.className   = 'result-coins tie';
  }

  document.getElementById('result-overlay').classList.remove('hidden');
}

function cartasRestartGame() {
  document.getElementById('result-overlay').classList.add('hidden');
  if (G.coins < G.bet) {
    cartasShowToast('Monedas insuficientes. Ajusta la apuesta.', 'red');
    cartasGoToMenu();
    return;
  }
  cartasStartGame(G.gameMode);
}

async function cartasStartOnlineSearch() {
  if (!UI.requireSession()) return;
  cartasSyncWallet();
  if (G.coins < G.bet) {
    cartasShowToast('Monedas insuficientes', 'red');
    return;
  }
  if (typeof Api === "undefined" || !Api.hasConfiguredApiUrl()) {
    cartasShowToast('Configura Apps Script para buscar rival.', 'red');
    return;
  }
  if (ONLINE.searching) return;
  ONLINE.searching = true;
  document.getElementById('modal-online')?.classList.remove('hidden');
  cartasSetOnlineModal('Buscando jugador...', 'Conectando con un rival registrado. Puedes cancelar la busqueda cuando quieras.', true);
  await cartasPollOnlineMatch();
  if (ONLINE.searching) ONLINE.timer = window.setInterval(cartasPollOnlineMatch, 1200);
}

async function cartasPollOnlineMatch() {
  if (!ONLINE.searching) return;
  try {
    const result = await Api.apiCasinoJoinGameMatch(Auth.token(), 'cartas-distrito');
    if (result.status === 'matched' && result.match) {
      cartasAcceptOnlineMatch(result.match);
    }
  } catch (error) {
    cartasCancelOnlineSearch(false);
    cartasSetOnlineModal('No se pudo buscar rival', error.message || 'Intenta otra vez.', false);
    document.getElementById('modal-online')?.classList.remove('hidden');
  }
}

function cartasAcceptOnlineMatch(match) {
  window.clearInterval(ONLINE.timer);
  ONLINE.timer = null;
  ONLINE.searching = false;
  ONLINE.matchId = match.matchId;
  ONLINE.mySlot = match.mySlot || 'player';
  document.getElementById('modal-online')?.classList.add('hidden');
  cartasShowToast('Rival conectado. Entrando a la partida.', 'green');
  cartasStartGame('online');
}

async function cartasCancelOnlineSearch(showToastMessage = true) {
  window.clearInterval(ONLINE.timer);
  ONLINE.timer = null;
  const wasSearching = ONLINE.searching;
  ONLINE.searching = false;
  document.getElementById('modal-online')?.classList.add('hidden');
  if (wasSearching && typeof Api !== "undefined" && Api.hasConfiguredApiUrl()) {
    try { await Api.apiCasinoCancelGameMatchmaking(Auth.token(), 'cartas-distrito'); } catch {}
  }
  if (wasSearching && showToastMessage) cartasShowToast('Busqueda cancelada. No se cobro moneda.', 'yellow');
}

function cartasSetOnlineModal(title, text, searching) {
  const titleEl = document.getElementById('online-title');
  const textEl = document.getElementById('online-text');
  const noteEl = document.getElementById('online-note');
  const buttonEl = document.getElementById('online-cancel-btn');
  if (titleEl) titleEl.textContent = title;
  if (textEl) textEl.textContent = text;
  if (noteEl) noteEl.textContent = searching ? 'Esperando otro jugador...' : 'No se cobro ninguna moneda.';
  if (buttonEl) buttonEl.textContent = searching ? 'CANCELAR BUSQUEDA' : 'CERRAR';
}

function cartasUnlockCasinoNavigation() {
  document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}

/* ──────────────────────────────────────────────────────────────
   RENDER CARTAS
────────────────────────────────────────────────────────────── */
function clearCards() {
  document.getElementById('player-cards').innerHTML = '';
  document.getElementById('rival-cards').innerHTML  = '';
  document.getElementById('player-score').textContent = '—';
  document.getElementById('rival-score').textContent  = '—';
  document.getElementById('player-score').className   = 'score-badge';
  document.getElementById('rival-score').className    = 'score-badge';
}

function renderHands() {
  renderHand('player-cards', 'player-score', G.playerHand);
  renderHand('rival-cards',  'rival-score',  G.botHand);
}

function renderHand(rowId, scoreId, hand) {
  const row      = document.getElementById(rowId);
  const scoreEl  = document.getElementById(scoreId);

  row.innerHTML = '';
  for (const card of hand) {
    row.appendChild(makeCardEl(card));
  }

  // Score visible (solo cartas visibles)
  const vis   = hand.filter(c => !c.hidden);
  const full  = hand.every(c => !c.hidden);
  const total = full ? fullHandValue(hand) : handValue(vis.map(c=>({...c,hidden:false})));

  if (hand.length === 0 || (hand.length > 0 && hand.every(c => c.hidden))) {
    scoreEl.textContent = '?';
    scoreEl.className   = 'score-badge';
    return;
  }

  scoreEl.textContent = total;
  scoreEl.className   = 'score-badge';
  if (total > 21) scoreEl.classList.add('bust');
  else if (total === 21 && hand.length >= 2) scoreEl.classList.add('blackjack');
}

const RED_SUITS = ['♥','♦'];

function makeCardEl(card) {
  const el = document.createElement('div');

  if (card.hidden) {
    el.className = 'card face-down';
    return el;
  }

  const isRed = RED_SUITS.includes(card.suit);
  el.className = 'card' + (isRed ? ' red-suit' : '');

  const val  = document.createElement('div');
  val.className  = 'card-val';
  val.textContent = card.rank;

  const suit = document.createElement('div');
  suit.className  = 'card-suit';
  suit.textContent = card.suit;

  el.appendChild(val);
  el.appendChild(suit);

  // Brillo si forma blackjack
  if (fullHandValue([card]) === 21) el.classList.add('bj-glow'); // As de valor
  return el;
}

/* ──────────────────────────────────────────────────────────────
   CONTROLES
────────────────────────────────────────────────────────────── */
function setControlsEnabled(enabled) {
  document.getElementById('btn-hit').disabled   = !enabled || G.playerHand.length >= 3;
  document.getElementById('btn-stand').disabled = !enabled;
}

function cartasSetStatus(text) {
  document.getElementById('status-pill').textContent = text;
}

/* ──────────────────────────────────────────────────────────────
   TOAST
────────────────────────────────────────────────────────────── */
let _toastTimer = null;
function cartasShowToast(msg, type = 'yellow') {
  const t  = document.getElementById('toast');
  const tc = type === 'red' ? 't-red' : type === 'green' ? 't-green' : '';
  t.textContent = msg;
  t.className   = `toast show ${tc}`;
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

function toggleMusic() {
  if (G.musicOn) {
    stopMusic();
    cartasShowToast('Musica apagada', 'yellow');
    return;
  }
  startMusic();
}

function startMusic() {
  try {
    if (!G.musicAudio) {
      G.musicAudio = new Audio('music/casino.mp3');
      G.musicAudio.loop = true;
      G.musicAudio.preload = 'auto';
      G.musicAudio.volume = 0.28;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    G.musicOn = true;
    G.musicAudio.play().catch(() => {
      if (!AudioCtx) return;
      if (!G.musicCtx) G.musicCtx = new AudioCtx();
      if (G.musicCtx.state === 'suspended') G.musicCtx.resume();
      playMusicTick();
      if (G.musicTimer) clearInterval(G.musicTimer);
      G.musicTimer = setInterval(playMusicTick, 920);
    });
    cartasShowToast('Musica activada', 'green');
  } catch (error) {
    cartasShowToast('No se pudo activar la musica', 'red');
  }
}

function playMusicTick() {
  if (!G.musicOn || !G.musicCtx) return;
  const now = G.musicCtx.currentTime;
  const notes = [196, 247, 294, 247];
  const note = notes[Math.floor(Date.now() / 920) % notes.length];
  const osc = G.musicCtx.createOscillator();
  const gain = G.musicCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(note, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.025, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  osc.connect(gain);
  gain.connect(G.musicCtx.destination);
  osc.start(now);
  osc.stop(now + 0.32);
}

function stopMusic() {
  if (G.musicTimer) clearInterval(G.musicTimer);
  G.musicTimer = null;
  if (G.musicAudio) {
    G.musicAudio.pause();
    G.musicAudio.currentTime = 0;
  }
  G.musicOn = false;
}

/* ──────────────────────────────────────────────────────────────
   MODO ONLINE — ESTRUCTURA PREPARADA
──────────────────────────────────────────────────────────────
  Cuando el backend esté listo, integrar:

  const ONLINE = {
    roomId:   null,
    playerId: null,   // 'player1' | 'player2'
    ws:       null,   // WebSocket
  };

  Flujo online:
  1. createRoom(bet)   → POST /api/rooms       → { roomId, code }
  2. joinRoom(code)    → POST /api/rooms/join  → { roomId, player2Ready }
  3. WS message types:
     - 'DEAL'   → sincroniza cartas iniciales (servidor genera la baraja)
     - 'HIT'    → jugador pide carta (servidor valida turno)
     - 'STAND'  → jugador se planta
     - 'RESULT' → servidor calcula ganador y emite resultado
     - 'DISCO'  → rival desconectado → devolver apuesta

  Mensajes UI ya listos:
  cartasSetStatus('Esperando rival…')
  cartasSetStatus('TU TURNO')
  cartasSetStatus('Turno del rival')
  cartasShowToast('El rival pidió carta', 'yellow')
  cartasShowToast('El rival se plantó', 'yellow')
  cartasShowToast('Rival desconectado', 'red')

  NOTA CRÍTICA: La baraja debe generarse y validarse EN EL SERVIDOR
  para evitar trampas. El cliente solo recibe las cartas que le tocan.
────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────
   INIT
────────────────────────────────────────────────────────────── */
function initCartasDistrito() {
  if (!document.getElementById('screen-menu')) return;
  cartasSyncWallet();
  updateCoins();
  const betEl = document.getElementById('bet-val');
  if (betEl) betEl.textContent = G.bet;
}

window.CartasDistrito = {
  init: initCartasDistrito,
  changeBet: cartasChangeBet,
  setBet: cartasSetBet,
  startGame: cartasStartGame,
  openOnlineModal,
  closeOnlineModal,
  exitToCasino: cartasExitToCasino,
  toggleRules: cartasToggleRules,
  toggleMusic,
  playerHit,
  playerStand,
  restartGame: cartasRestartGame,
  destroy: () => {
    cartasCancelOnlineSearch(false);
    stopMusic();
    cartasUnlockCasinoNavigation();
  }
};

window.addEventListener('load', initCartasDistrito);
