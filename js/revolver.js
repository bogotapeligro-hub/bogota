/* ═══════════════════════════════════════════════════════════════
   REVÓLVER DE LA SUERTE — LÓGICA PRINCIPAL
   Versión: 1.0.0 | Modo Bot + Estructura Online Lista
═══════════════════════════════════════════════════════════════ */

'use strict';

/* ────────────────────────────────────────────────────────────────
   ESTADO GLOBAL
──────────────────────────────────────────────────────────────── */
const STATE = {
  coins:         5,
  bet:           1,
  gameMode:      'bot',     // 'bot' | 'pvp'
  gameActive:    false,

  // Cámara / revólver
  revolverAngle: 0,
  revolverSpin:  0,
  drumIndex:     0,

  // Balas (ocultas al jugador)
  bulletChamber: [],    // ['real'|'fake', ...]
  shotsTotal:    0,
  shotsReal:     0,
  shotsFake:     0,

  // Jugadores
  player: {
    fingers: [true,true,true,true,true],  // true = vivo
    head:    true,
  },
  bot: {
    fingers: [true,true,true,true,true],
    head:    true,
  },

  // Turno
  phase:          'ppt',    // 'ppt' | 'shoot' | 'waiting' | 'result'
  pptLock:        false,
  shootLock:      false,
  extraTurn:      false,
  extraTurnCount: 0,
  playerPPT:      null,
  botPPT:         null,
  pptWinner:      null,    // 'player' | 'bot' | 'tie'
  currentTurn:    'player',// 'player' | 'bot'

  // Estadísticas
  stats: { shots:0, real:0, fake:0, extras:0 },

  // Animación revólver
  menuAnimFrame:  null,
  gameAnimFrame:  null,
};

const REV_ONLINE = {
  timer: null,
  searching: false,
  matchId: "",
  mySlot: "player",
};

/* ────────────────────────────────────────────────────────────────
   CANVAS SETUP
──────────────────────────────────────────────────────────────── */
let menuCanvas = null;
let menuCtx    = null;
let gameCanvas = null;
let gameCtx    = null;

function bindCanvases() {
  menuCanvas = document.getElementById('canvas-menu');
  gameCanvas = document.getElementById('canvas-game');
  menuCtx    = menuCanvas ? menuCanvas.getContext('2d') : null;
  gameCtx    = gameCanvas ? gameCanvas.getContext('2d') : null;
  return Boolean(menuCanvas && gameCanvas && menuCtx && gameCtx);
}

// HiDPI
function setupCanvas(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const w   = canvas.offsetWidth || canvas.width;
  const h   = canvas.offsetHeight || canvas.height;
  canvas.width  = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
}

/* ────────────────────────────────────────────────────────────────
   REVÓLVER RENDERER (Canvas 2D pseudo-3D)
──────────────────────────────────────────────────────────────── */
function drawRevolver(ctx, x, y, scale, angle, spinFlash, drumIndex, totalChambers) {
  ctx.save();
  ctx.translate(x, y);

  const s = scale;

  // Sombra suelo
  ctx.save();
  ctx.scale(1, 0.25);
  ctx.beginPath();
  ctx.ellipse(0, 140 * s, 90 * s, 18 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  ctx.restore();

  // === Tambor (cilindro) ===
  const drumX = 20 * s;
  const drumY = -30 * s;
  const drumR = 34 * s;
  const drumH = 28 * s;

  // Cuerpo tambor – perspectiva isométrica ligera
  const tilt = angle * 0.12; // leve oscilación en Y

  // Face frontal del tambor
  const grad = ctx.createRadialGradient(drumX - 6*s, drumY + tilt - 6*s, 2*s, drumX, drumY + tilt, drumR);
  grad.addColorStop(0,   '#666');
  grad.addColorStop(0.5, '#3a3a3a');
  grad.addColorStop(1,   '#1a1a1a');
  ctx.beginPath();
  ctx.ellipse(drumX, drumY + tilt, drumR, drumR * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();

  // Borde lateral del tambor (espesor)
  ctx.beginPath();
  ctx.ellipse(drumX, drumY + tilt + drumH * 0.35, drumR, drumR * 0.5, 0, 0, Math.PI);
  ctx.fillStyle = '#252525';
  ctx.fill();

  // 6 cámaras del tambor
  for (let i = 0; i < totalChambers; i++) {
    const a   = (i / totalChambers) * Math.PI * 2 - angle * 0.04;
    const cx  = drumX + Math.cos(a) * 16 * s;
    const cy  = drumY + tilt + Math.sin(a) * 8 * s;
    const isCurrent = i === drumIndex % totalChambers;

    ctx.beginPath();
    ctx.ellipse(cx, cy, 5.5 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = isCurrent ? '#cc8800' : '#111';
    ctx.fill();
    ctx.strokeStyle = isCurrent ? '#ffcc44' : '#444';
    ctx.lineWidth = 1 * s;
    ctx.stroke();

    if (isCurrent) {
      // Brillo cámara activa
      ctx.beginPath();
      ctx.ellipse(cx, cy, 5.5 * s, 3.5 * s, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,200,50,0.18)';
      ctx.fill();
    }
  }

  // === Mango (grip) ===
  ctx.save();
  ctx.translate(-10 * s, 50 * s);
  ctx.rotate(0.18);
  ctx.beginPath();
  ctx.roundRect(-14 * s, -8 * s, 28 * s, 68 * s, 6 * s);
  const gGrad = ctx.createLinearGradient(-14 * s, 0, 14 * s, 0);
  gGrad.addColorStop(0, '#4a3018');
  gGrad.addColorStop(0.5,'#6a4828');
  gGrad.addColorStop(1, '#3a2010');
  ctx.fillStyle = gGrad;
  ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1 * s;
  ctx.stroke();

  // Textura mango
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(-12 * s, 6 * s + i * 10 * s);
    ctx.lineTo( 12 * s, 6 * s + i * 10 * s);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();
  }
  ctx.restore();

  // === Cañón ===
  ctx.save();
  ctx.translate(drumX + 28 * s, drumY + tilt);
  ctx.beginPath();
  ctx.roundRect(0, -7 * s, 72 * s, 14 * s, 4 * s);
  const bGrad = ctx.createLinearGradient(0, -7 * s, 0, 7 * s);
  bGrad.addColorStop(0, '#555');
  bGrad.addColorStop(0.5,'#333');
  bGrad.addColorStop(1, '#1c1c1c');
  ctx.fillStyle = bGrad;
  ctx.fill();
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1 * s;
  ctx.stroke();

  // Boca del cañón
  ctx.beginPath();
  ctx.ellipse(72 * s, 0, 8 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a0a';
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();

  // Flash de disparo en cañón
  if (spinFlash > 0) {
    ctx.save();
    ctx.globalAlpha = spinFlash;
    const fGrad = ctx.createRadialGradient(84 * s, 0, 0, 84 * s, 0, 28 * s);
    fGrad.addColorStop(0,'rgba(255,220,80,1)');
    fGrad.addColorStop(0.5,'rgba(255,100,20,0.7)');
    fGrad.addColorStop(1,'rgba(255,60,0,0)');
    ctx.beginPath();
    ctx.ellipse(84 * s, 0, 28 * s, 14 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = fGrad;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // === Gatillo ===
  ctx.save();
  ctx.translate(-2 * s, 20 * s);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(10 * s, 16 * s);
  ctx.lineTo(8 * s, 18 * s);
  ctx.lineTo(-2 * s, 2 * s);
  ctx.closePath();
  ctx.fillStyle = '#555';
  ctx.fill();
  ctx.restore();

  // === Nombre grabado ===
  ctx.save();
  ctx.font = `bold ${7 * s}px 'Orbitron', monospace`;
  ctx.fillStyle = 'rgba(240,192,64,0.55)';
  ctx.textAlign = 'center';
  ctx.fillText('SUERTE', drumX, drumY + tilt + 56 * s);
  ctx.restore();

  ctx.restore();
}

/* ────────────────────────────────────────────────────────────────
   LOOP MENÚ
──────────────────────────────────────────────────────────────── */
let menuAngle = 0;
function menuLoop() {
  menuAngle += 0.012;
  const w = menuCanvas.width / (window.devicePixelRatio || 1);
  const h = menuCanvas.height / (window.devicePixelRatio || 1);
  menuCtx.clearRect(0, 0, w, h);

  // Fondo sutil
  menuCtx.fillStyle = 'rgba(0,0,0,0.01)';
  menuCtx.fillRect(0,0,w,h);

  // Brillo de fondo
  const glow = menuCtx.createRadialGradient(w/2, h/2, 10, w/2, h/2, 130);
  glow.addColorStop(0,'rgba(180,100,0,0.12)');
  glow.addColorStop(1,'transparent');
  menuCtx.fillStyle = glow;
  menuCtx.fillRect(0,0,w,h);

  const bob = Math.sin(menuAngle * 0.7) * 4;
  drawRevolver(menuCtx, w / 2, h / 2 - 10 + bob, 0.85, menuAngle, 0, 0, 6);

  STATE.menuAnimFrame = requestAnimationFrame(menuLoop);
}

/* ────────────────────────────────────────────────────────────────
   LOOP JUEGO
──────────────────────────────────────────────────────────────── */
let gameAngle       = 0;
let gameSpin        = 0;
let gameFlash       = 0;
let gameShootFlash  = 0;

function gameLoop() {
  gameAngle += 0.008;
  if (gameSpin  > 0) gameSpin  = Math.max(0, gameSpin  - 0.04);
  if (gameFlash > 0) gameFlash = Math.max(0, gameFlash - 0.06);

  const w = gameCanvas.width / (window.devicePixelRatio || 1);
  const h = gameCanvas.height / (window.devicePixelRatio || 1);
  gameCtx.clearRect(0, 0, w, h);

  // Mesa de casino
  drawCasinoTable(gameCtx, w, h);

  const bob = Math.sin(gameAngle * 0.6) * 3;
  drawRevolver(gameCtx, w / 2, h / 2 + bob, 0.78, gameAngle + gameSpin * 8, gameFlash, STATE.drumIndex, 6);

  STATE.gameAnimFrame = requestAnimationFrame(gameLoop);
}

function drawCasinoTable(ctx, w, h) {
  // Superficie mesa
  const tGrad = ctx.createRadialGradient(w/2, h*0.6, 20, w/2, h*0.6, w*0.7);
  tGrad.addColorStop(0,'rgba(20,60,20,0.35)');
  tGrad.addColorStop(1,'rgba(5,20,5,0.1)');
  ctx.fillStyle = tGrad;
  ctx.beginPath();
  ctx.ellipse(w/2, h*0.75, w*0.55, h*0.18, 0, 0, Math.PI*2);
  ctx.fill();

  // Borde dorado mesa
  ctx.beginPath();
  ctx.ellipse(w/2, h*0.75, w*0.55, h*0.18, 0, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(240,192,64,0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Líneas de fondo decorativas
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(0, h * (0.2 + i * 0.15));
    ctx.lineTo(w, h * (0.2 + i * 0.15));
    ctx.strokeStyle = 'rgba(240,192,64,0.03)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/* ────────────────────────────────────────────────────────────────
   ANIMACIONES
──────────────────────────────────────────────────────────────── */
function triggerShootAnimation(isReal) {
  gameSpin  = 1;
  gameFlash = isReal ? 1 : 0.4;

  // Avanzar tambor
  STATE.drumIndex = (STATE.drumIndex + 1) % 6;

  // Flash pantalla
  const flashEl = document.getElementById('shoot-flash');
  flashEl.classList.add('bang');
  setTimeout(() => flashEl.classList.remove('bang'), 180);

  // Sonido ficticio via AudioContext (leve, sin assets externos)
  playClick(isReal);
}

function playClick(loud) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(loud ? 120 : 400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(loud ? 40 : 200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.type = loud ? 'sawtooth' : 'triangle';
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch(e) {}
}

/* ────────────────────────────────────────────────────────────────
   APUESTA / MONEDAS
──────────────────────────────────────────────────────────────── */
function revChangeBet(delta) {
  revSyncWallet();
  const newBet = STATE.bet + delta;
  if (newBet < 1)           return;
  if (newBet > STATE.coins) return;
  STATE.bet = newBet;
  const betEl = document.getElementById('bet-amount');
  if (betEl) betEl.textContent = STATE.bet;
}

function updateCoinDisplay() {
  const menuCoins = document.getElementById('coin-count');
  const gameCoins = document.getElementById('game-coins');
  const betEl = document.getElementById('bet-amount');
  if (menuCoins) menuCoins.textContent = STATE.coins;
  if (gameCoins) gameCoins.textContent = STATE.coins;
  if (betEl) betEl.textContent = STATE.bet;
  if (typeof CasinoCoins !== "undefined") CasinoCoins.renderCoinBalance(document);
}

function revSyncWallet() {
  if (typeof CasinoCoins !== "undefined") {
    CasinoCoins.initializeCoins();
    STATE.coins = CasinoCoins.getCoins();
  }
  STATE.bet = Math.max(1, Math.min(Number(STATE.bet) || 1, Math.max(STATE.coins, 1)));
  return STATE.coins;
}

function revCommitWallet() {
  if (typeof CasinoCoins !== "undefined") {
    STATE.coins = CasinoCoins.setCoins(STATE.coins);
    CasinoCoins.renderCoinBalance(document);
  }
}

/* ────────────────────────────────────────────────────────────────
   NAVEGACIÓN DE PANTALLAS
──────────────────────────────────────────────────────────────── */
function revShowScreen(id) {
  const target = document.getElementById(id);
  if (!target) return false;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  target.classList.add('active');
  return true;
}

function revGoToMenu() {
  stopGameLoop();
  startMenuLoop();
  STATE.gameActive = false;
  revShowScreen('screen-menu');
  revSyncWallet();
  updateCoinDisplay();
}

function revExitToCasino() {
  if (STATE.gameActive) {
    STATE.coins += STATE.bet;
    STATE.gameActive = false;
    revCommitWallet();
  }
  revStopMusic();
  revCancelOnlineSearch(false);
  stopGameLoop();
  stopMenuLoop();
  revUnlockCasinoNavigation();
  location.hash = '#/casino';
}

function revToggleRules() {
  document.getElementById('rules-panel').classList.toggle('hidden');
}

function showOnlineModal() {
  revStartOnlineSearch();
}
function closeModal() {
  revCancelOnlineSearch(true);
}

function revConfirmBack() {
  if (STATE.gameActive) {
    const ok = confirm('¿Abandonar partida? Perderás tu apuesta.');
    if (!ok) return;
    // Devolver monedas – el juego no se completó
    STATE.coins += STATE.bet;
    STATE.gameActive = false;
    revCommitWallet();
    revShowToast('Partida abandonada. Sin cobro de apuesta.', 'yellow');
  }
  revGoToMenu();
}

/* ────────────────────────────────────────────────────────────────
   INICIO DE PARTIDA
──────────────────────────────────────────────────────────────── */
function revStartGame(mode) {
  if (!document.getElementById('screen-game')) return;
  revSyncWallet();
  if (STATE.coins < STATE.bet) {
    revShowToast('¡Monedas insuficientes!', 'red');
    return;
  }

  if (STATE.gameActive) {
    revShowToast('Ya hay una partida en curso.', 'red');
    return;
  }

  STATE.gameMode   = mode;
  STATE.gameActive = false; // Aún no deducir — la deducción se hace al confirmar carga

  // Reset estado
  STATE.player = { fingers:[true,true,true,true,true], head:true };
  STATE.bot    = { fingers:[true,true,true,true,true], head:true };
  STATE.drumIndex    = 0;
  STATE.shotsTotal   = 0;
  STATE.shotsReal    = 0;
  STATE.shotsFake    = 0;
  STATE.phase        = 'ppt';
  STATE.pptLock      = false;
  STATE.shootLock    = false;
  STATE.extraTurn    = false;
  STATE.extraTurnCount = 0;
  STATE.playerPPT    = null;
  STATE.botPPT       = null;
  STATE.pptWinner    = null;
  STATE.currentTurn  = 'player';
  STATE.stats        = { shots:0, real:0, fake:0, extras:0 };

  // Generar cámara de balas (oculta)
  loadDrum();

  // Pantalla juego
  stopMenuLoop();
  if (!revShowScreen('screen-game')) return;
  setupGameCanvas();
  startGameLoop();
  updateCoinDisplay();
  renderRevolverLives();
  updateBulletDots();

  // Etiqueta rival
  document.getElementById('rival-label').textContent = mode === 'bot' ? 'BOT' : 'RIVAL';

  // Cobrar apuesta solo cuando la partida arranca exitosamente
  STATE.coins    -= STATE.bet;
  STATE.gameActive = true;
  revCommitWallet();
  updateCoinDisplay();

  // Comenzar
  revStartMusic();
  setPhase('ppt');
  setTimeout(() => revSetStatus('Cargando tambor…', 'Mezclando suerte…'), 200);
  setTimeout(() => revSetStatus('¡Balas cargadas!', 'Juega Piedra, Papel o Tijera'), 1600);
  setTimeout(() => setPhase('ppt'), 1800);
}

async function revStartOnlineSearch() {
  if (!UI.requireSession()) return;
  revSyncWallet();
  if (STATE.coins < STATE.bet) {
    revShowToast('Monedas insuficientes', 'red');
    return;
  }
  if (typeof Api === "undefined" || !Api.hasConfiguredApiUrl()) {
    revShowToast('Configura Apps Script para buscar rival.', 'red');
    return;
  }
  if (REV_ONLINE.searching) return;
  REV_ONLINE.searching = true;
  document.getElementById('modal-online')?.classList.remove('hidden');
  revSetOnlineModal('Buscando jugador...', 'Conectando con un rival registrado. Puedes cancelar la busqueda cuando quieras.', true);
  await revPollOnlineMatch();
  if (REV_ONLINE.searching) REV_ONLINE.timer = window.setInterval(revPollOnlineMatch, 1200);
}

async function revPollOnlineMatch() {
  if (!REV_ONLINE.searching) return;
  try {
    const result = await Api.apiCasinoJoinGameMatch(Auth.token(), 'revolver');
    if (result.status === 'matched' && result.match) {
      revAcceptOnlineMatch(result.match);
    }
  } catch (error) {
    revCancelOnlineSearch(false);
    revSetOnlineModal('No se pudo buscar rival', error.message || 'Intenta otra vez.', false);
    document.getElementById('modal-online')?.classList.remove('hidden');
  }
}

function revAcceptOnlineMatch(match) {
  window.clearInterval(REV_ONLINE.timer);
  REV_ONLINE.timer = null;
  REV_ONLINE.searching = false;
  REV_ONLINE.matchId = match.matchId;
  REV_ONLINE.mySlot = match.mySlot || 'player';
  document.getElementById('modal-online')?.classList.add('hidden');
  revShowToast('Rival conectado. Entrando a la partida.', 'green');
  revStartGame('online');
}

async function revCancelOnlineSearch(showToastMessage = true) {
  window.clearInterval(REV_ONLINE.timer);
  REV_ONLINE.timer = null;
  const wasSearching = REV_ONLINE.searching;
  REV_ONLINE.searching = false;
  document.getElementById('modal-online')?.classList.add('hidden');
  if (wasSearching && typeof Api !== "undefined" && Api.hasConfiguredApiUrl()) {
    try { await Api.apiCasinoCancelGameMatchmaking(Auth.token(), 'revolver'); } catch {}
  }
  if (wasSearching && showToastMessage) revShowToast('Busqueda cancelada. No se cobro moneda.', 'yellow');
}

function revSetOnlineModal(title, text, searching) {
  const titleEl = document.getElementById('online-title');
  const textEl = document.getElementById('online-text');
  const noteEl = document.getElementById('online-note');
  const buttonEl = document.getElementById('online-cancel-btn');
  if (titleEl) titleEl.textContent = title;
  if (textEl) textEl.textContent = text;
  if (noteEl) noteEl.textContent = searching ? 'Esperando otro jugador...' : 'No se cobro ninguna moneda.';
  if (buttonEl) buttonEl.textContent = searching ? 'CANCELAR BUSQUEDA' : 'CERRAR';
}

function revUnlockCasinoNavigation() {
  document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}

/* ────────────────────────────────────────────────────────────────
   TAMBOR DE BALAS (Lógica oculta)
──────────────────────────────────────────────────────────────── */
function loadDrum() {
  const total = 6;
  // Mínimo 2 reales, máximo 4
  const realCount = 2 + Math.floor(Math.random() * 3);
  const arr = [];
  for (let i = 0; i < realCount; i++) arr.push('real');
  while (arr.length < total) arr.push('fake');

  // Fisher-Yates shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  STATE.bulletChamber = arr;
  STATE.drumIndex = 0;
}

function currentBullet() {
  if (STATE.drumIndex >= STATE.bulletChamber.length) {
    // Recarga
    loadDrum();
    revSetStatus('Recargando...', 'Nuevo tambor listo');
    updateBulletDots();
  }
  return STATE.bulletChamber[STATE.drumIndex];
}

/* ────────────────────────────────────────────────────────────────
   VIDAS
──────────────────────────────────────────────────────────────── */
function renderRevolverLives() {
  renderPlayerLives('player-lives', STATE.player);
  renderPlayerLives('bot-lives',    STATE.bot);
}

function renderPlayerLives(elId, data) {
  const el = document.getElementById(elId);
  el.innerHTML = '';

  data.fingers.forEach((alive, i) => {
    const icon = document.createElement('span');
    icon.className = 'life-icon' + (alive ? '' : ' lost');
    icon.textContent = '🖐️';
    icon.id = elId + '-f' + i;
    el.appendChild(icon);
  });

  const headIcon = document.createElement('span');
  headIcon.className = 'life-icon' + (data.head ? '' : ' lost');
  headIcon.textContent = '👤';
  headIcon.id = elId + '-head';
  el.appendChild(headIcon);
}

function removePart(target) {
  // target: 'player' | 'bot'
  const data = STATE[target];
  const elId = target === 'player' ? 'player-lives' : 'bot-lives';

  // Quitar primero dedos
  for (let i = 0; i < data.fingers.length; i++) {
    if (data.fingers[i]) {
      data.fingers[i] = false;
      animateLostPart(elId + '-f' + i);
      return;
    }
  }
  // Luego cabeza
  if (data.head) {
    data.head = false;
    animateLostPart(elId + '-head');
  }
}

function animateLostPart(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('shake');
  setTimeout(() => {
    el.classList.remove('shake');
    el.classList.add('lost');
  }, 400);
}

function isEliminated(target) {
  const data = STATE[target];
  return data.fingers.every(f => !f) && !data.head;
}

/* ────────────────────────────────────────────────────────────────
   BULLET DOTS HUD
──────────────────────────────────────────────────────────────── */
function updateBulletDots() {
  for (let i = 0; i < 6; i++) {
    const dot = document.getElementById('b' + i);
    if (!dot) continue;
    dot.className = 'bullet-dot';
    if (i < STATE.drumIndex) {
      dot.classList.add('fired');
    } else {
      dot.classList.add('loaded');
    }
  }
}

/* ────────────────────────────────────────────────────────────────
   FASES DE JUEGO
──────────────────────────────────────────────────────────────── */
function setPhase(phase) {
  STATE.phase = phase;
  const panels = ['panel-ppt','panel-shoot','panel-wait'];
  panels.forEach(p => document.getElementById(p).classList.add('hidden'));

  if (phase === 'ppt') {
    STATE.pptLock   = false;
    STATE.playerPPT = null;
    STATE.botPPT    = null;
    STATE.pptWinner = null;
    document.getElementById('panel-ppt').classList.remove('hidden');
    // Resetear botones PPT
    ['btn-rock','btn-paper','btn-scissors'].forEach(id => {
      const b = document.getElementById(id);
      b.classList.remove('selected');
      b.disabled = false;
    });
    revSetStatus('PIEDRA · PAPEL · TIJERA', 'Elige tu movimiento');
  } else if (phase === 'shoot') {
    const isPlayerTurn = STATE.currentTurn === 'player';
    document.getElementById('panel-shoot').classList.remove('hidden');
    document.getElementById('btn-self').disabled   = !isPlayerTurn;
    document.getElementById('btn-enemy').disabled  = !isPlayerTurn;
    if (!isPlayerTurn) {
      revSetStatus('El bot decide...', '');
      setTimeout(botShootDecision, 1000 + Math.random() * 800);
    } else {
      revSetStatus('TU TURNO — ELIGE', STATE.extraTurn ? '⚡ Turno extra activo' : '');
      document.getElementById('shoot-panel-title').textContent =
        STATE.extraTurn ? '⚡ TURNO EXTRA — ELIGE' : '🎯 ELIGE TU DISPARO';
    }
  } else if (phase === 'waiting') {
    document.getElementById('panel-wait').classList.remove('hidden');
  }
}

/* ────────────────────────────────────────────────────────────────
   PIEDRA · PAPEL · TIJERA
──────────────────────────────────────────────────────────────── */
const PPT_LABELS = { rock:'🪨 PIEDRA', paper:'📄 PAPEL', scissors:'✂️ TIJERA' };

function choosePPT(choice) {
  if (STATE.pptLock) return;
  if (STATE.phase !== 'ppt') return;
  STATE.pptLock   = true;
  STATE.playerPPT = choice;

  // Visual seleccionado
  ['btn-rock','btn-paper','btn-scissors'].forEach(id => {
    document.getElementById(id).disabled = true;
  });
  document.getElementById('btn-' + (choice === 'rock' ? 'rock' : choice === 'paper' ? 'paper' : 'scissors'))
    .classList.add('selected');

  revSetStatus('Esperando al bot…', '');

  // Delay bot
  setTimeout(() => {
    const botChoices = ['rock','paper','scissors'];
    STATE.botPPT = botChoices[Math.floor(Math.random() * 3)];
    resolvePPT();
  }, 600 + Math.random() * 500);
}

function pptWins(a, b) {
  if (a === b) return 'tie';
  if ((a==='rock'&&b==='scissors')||(a==='paper'&&b==='rock')||(a==='scissors'&&b==='paper')) return 'a';
  return 'b';
}

function resolvePPT() {
  const result = pptWins(STATE.playerPPT, STATE.botPPT);
  const pLabel = PPT_LABELS[STATE.playerPPT];
  const bLabel = PPT_LABELS[STATE.botPPT];

  setPhase('waiting');
  revShowToast(`Tú: ${pLabel} | Bot: ${bLabel}`, 'yellow');

  if (result === 'tie') {
    revSetStatus('EMPATE', 'Volviendo a jugar…');
    setTimeout(() => setPhase('ppt'), 1800);
    return;
  }

  STATE.pptWinner   = result === 'a' ? 'player' : 'bot';
  STATE.currentTurn = STATE.pptWinner;

  const winMsg = result === 'a'
    ? `¡Ganaste! ${pLabel} vence a ${bLabel}`
    : `Bot ganó. ${bLabel} vence a ${pLabel}`;

  setTimeout(() => {
    revSetStatus(winMsg, STATE.currentTurn === 'player' ? '¡TÚ decides el disparo!' : 'El bot decide...');
    setTimeout(() => setPhase('shoot'), 1200);
  }, 600);
}

/* ────────────────────────────────────────────────────────────────
   DISPARO — JUGADOR
──────────────────────────────────────────────────────────────── */
const shootLockFn = (() => {
  let locked = false;
  return {
    lock: () => { locked = true; },
    unlock: () => { locked = false; },
    isLocked: () => locked,
  };
})();

function chooseShoot(target) {
  if (STATE.phase !== 'shoot') return;
  if (STATE.currentTurn !== 'player') return;
  if (shootLockFn.isLocked()) return;
  shootLockFn.lock();

  disableShootButtons();
  executeShoot('player', target, () => {
    shootLockFn.unlock();
  });
}

function botShootDecision() {
  if (STATE.phase !== 'shoot') return;

  // Estrategia bot: si tiene muchas vidas, puede arriesgarse (dispararse)
  // Si pocas vidas, más agresivo (disparar al jugador)
  const botLives    = countLives('bot');
  const playerLives = countLives('player');

  let choice;
  if (botLives >= 4) {
    // Bot con muchas vidas: 40% chance de arriesgarse
    choice = Math.random() < 0.4 ? 'self' : 'enemy';
  } else if (botLives <= 2) {
    // Bot desesperado: dispara al jugador casi siempre
    choice = Math.random() < 0.85 ? 'enemy' : 'self';
  } else {
    choice = Math.random() < 0.5 ? 'self' : 'enemy';
  }

  const msg = choice === 'enemy' ? '💀 El bot decidió dispararte' : '🎲 El bot decidió arriesgarse';
  revSetStatus(msg, '');
  revShowToast(msg, 'yellow');

  setTimeout(() => executeShoot('bot', choice, () => {}), 800);
}

function countLives(target) {
  const data = STATE[target];
  return data.fingers.filter(Boolean).length + (data.head ? 1 : 0);
}

/* ────────────────────────────────────────────────────────────────
   LÓGICA DE DISPARO UNIFICADA
──────────────────────────────────────────────────────────────── */
function executeShoot(shooter, shootTarget, done) {
  const bullet = currentBullet();
  const isReal = bullet === 'real';

  STATE.stats.shots++;
  if (isReal) STATE.stats.real++; else STATE.stats.fake++;
  STATE.drumIndex++;
  updateBulletDots();

  // Animación revólver
  triggerShootAnimation(isReal);

  const victim = shootTarget === 'self' ? shooter : (shooter === 'player' ? 'bot' : 'player');

  setTimeout(() => {
    if (isReal) {
      // Bala real
      removePart(victim);
      renderRevolverLives();

      const victimLabel = victim === 'player' ? 'TÚ' : 'BOT';
      if (shootTarget === 'self') {
        revSetStatus(`💥 BALA REAL`, `${victimLabel} pierdes una parte`);
        revShowToast('Bala real. Pierdes una vida.', 'red');
      } else {
        revSetStatus(`💥 BALA REAL`, `${victimLabel} pierde una parte`);
        revShowToast('Bala real. El rival pierde una vida.', 'red');
      }

      // Comprobar eliminación
      if (isEliminated(victim)) {
        setTimeout(() => endGame(victim === 'player' ? 'bot' : 'player'), 1200);
        done();
        return;
      }

      // Nuevo turno PPT
      STATE.extraTurn = false;
      STATE.extraTurnCount = 0;
      setTimeout(() => setPhase('ppt'), 1600);

    } else {
      // Bala falsa
      if (shootTarget === 'self') {
        STATE.extraTurn = true;
        STATE.extraTurnCount++;
        STATE.stats.extras++;
        revSetStatus(`💨 BALA FALSA`, `¡Turno extra! El riesgo pagó.`);
        revShowToast('Bala falsa. ¡Turno extra!', 'green');
        setTimeout(() => {
          setPhase('shoot');
        }, 1400);
      } else {
        revSetStatus(`💨 BALA FALSA`, `El rival se salva. Turno perdido.`);
        revShowToast('Bala falsa. El rival se salva.', 'yellow');
        STATE.extraTurn = false;
        STATE.extraTurnCount = 0;
        setTimeout(() => setPhase('ppt'), 1600);
      }
    }
    done();
  }, 600);
}

function disableShootButtons() {
  document.getElementById('btn-self').disabled  = true;
  document.getElementById('btn-enemy').disabled = true;
}

/* ────────────────────────────────────────────────────────────────
   FIN DEL JUEGO
──────────────────────────────────────────────────────────────── */
function endGame(winner) {
  STATE.gameActive = false;
  const playerWon  = winner === 'player';

  // Calcular monedas
  let coinResult;
  if (playerWon) {
    coinResult   = STATE.bet * 1.8; // Premio 1.8x
    STATE.coins += Math.floor(coinResult);
  } else {
    coinResult = -STATE.bet; // ya descontadas al inicio
  }

  stopGameLoop();
  revStopMusic();
  revCommitWallet();
  updateCoinDisplay();

  // Pantalla fin
  document.getElementById('end-icon').textContent    = playerWon ? '🏆' : '💀';
  document.getElementById('end-title').textContent   = playerWon ? '¡GANASTE!' : '¡PERDISTE!';
  document.getElementById('end-title').className     = 'end-title' + (playerWon ? '' : ' lose');
  document.getElementById('end-subtitle').textContent = playerWon
    ? 'El bot cayó ante tu suerte'
    : 'El bot fue más afortunado esta vez';

  const coinsEl = document.getElementById('end-coins');
  coinsEl.textContent = playerWon
    ? `+${Math.floor(coinResult)} 🪙`
    : `${coinResult} 🪙`;
  coinsEl.className = 'end-coins' + (playerWon ? '' : ' lose');

  // Stats
  document.getElementById('stat-shots').textContent  = STATE.stats.shots;
  document.getElementById('stat-real').textContent   = STATE.stats.real;
  document.getElementById('stat-fake').textContent   = STATE.stats.fake;
  document.getElementById('stat-extra').textContent  = STATE.stats.extras;

  setTimeout(() => revShowScreen('screen-end'), 800);
}

function revRestartGame() {
  if (STATE.coins < STATE.bet) {
    revShowToast('Monedas insuficientes. Cambia la apuesta.', 'red');
    revGoToMenu();
    return;
  }
  revStartGame(STATE.gameMode);
}

/* ────────────────────────────────────────────────────────────────
   UTILIDADES UI
──────────────────────────────────────────────────────────────── */
function revSetStatus(main, sub) {
  document.getElementById('status-text').textContent = main;
  document.getElementById('status-sub').textContent  = sub || '';
}

let toastTimer = null;
function revShowToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast show' + (type === 'red' ? ' toast-red' : type === 'green' ? ' toast-green' : '');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
  }, 2400);
}

/* ────────────────────────────────────────────────────────────────
   GESTIÓN DE LOOPS DE CANVAS
──────────────────────────────────────────────────────────────── */
function setupMenuCanvas() {
  if (!menuCanvas || !menuCtx) return;
  setupCanvas(menuCanvas, menuCtx);
}
function setupGameCanvas() {
  if (!gameCanvas || !gameCtx) return;
  setupCanvas(gameCanvas, gameCtx);
}
function startMenuLoop() {
  if (STATE.menuAnimFrame) return;
  if (!menuCanvas || !menuCtx) return;
  setupMenuCanvas();
  menuLoop();
}
function stopMenuLoop() {
  if (STATE.menuAnimFrame) {
    cancelAnimationFrame(STATE.menuAnimFrame);
    STATE.menuAnimFrame = null;
  }
}
function startGameLoop() {
  if (STATE.gameAnimFrame) return;
  if (!gameCanvas || !gameCtx) return;
  gameLoop();
}
function stopGameLoop() {
  if (STATE.gameAnimFrame) {
    cancelAnimationFrame(STATE.gameAnimFrame);
    STATE.gameAnimFrame = null;
  }
}

/* ────────────────────────────────────────────────────────────────
   MODO ONLINE (ESTRUCTURA PREPARADA)
──────────────────────────────────────────────────────────────── */
/*
  ESTRUCTURA PARA MODO PvP ONLINE:
  ──────────────────────────────────
  Cuando el backend esté listo, implementar:

  1. createRoom(betAmount)   → POST /api/rooms → { roomId, joinCode }
  2. joinRoom(joinCode)      → POST /api/rooms/join → { roomId, player2Joined }
  3. sendPPT(roomId, choice) → PATCH /api/rooms/{id}/ppt
  4. sendShoot(roomId, tgt)  → PATCH /api/rooms/{id}/shoot
  5. WebSocket / SSE para sincronización en tiempo real
  6. Lógica de balas procesada en el SERVIDOR (no en cliente)
     para evitar trampa o visibilidad de la secuencia.
  7. Timeout si rival desconectado: reembolsar apuesta.

  Variables de estado online preparadas:
  - STATE.roomId    = null;
  - STATE.playerId  = null; // 'player1' | 'player2'
  - STATE.ws        = null; // WebSocket connection

  Mensajes de UI ya implementados:
  - "Esperando al rival…" → revSetStatus('Esperando rival…','')
  - "Rival desconectado"  → revShowToast('Rival desconectado','red')
  - "Tu turno"            → revSetStatus('TU TURNO','')
  - "Turno del rival"     → revSetStatus('Turno del rival','')
*/

/* ────────────────────────────────────────────────────────────────
   MÚSICA
──────────────────────────────────────────────────────────────── */
let revMusicAudio = null;
function revInitMusic() {
  if (revMusicAudio) return revMusicAudio;
  revMusicAudio = new Audio('music/casino.mp3');
  revMusicAudio.loop = true;
  revMusicAudio.preload = 'auto';
  revMusicAudio.volume = 0.3;
  return revMusicAudio;
}
function revStartMusic() {
  revInitMusic();
  revMusicAudio.currentTime = 0;
  revMusicAudio.play().catch(() => {});
  updateRevMusicButton(true);
}
function revStopMusic() {
  if (revMusicAudio) {
    revMusicAudio.pause();
    revMusicAudio.currentTime = 0;
  }
  updateRevMusicButton(false);
}
function revToggleMusic() {
  const btn = document.querySelector('[data-rev-music]');
  if (revMusicAudio && !revMusicAudio.paused) {
    revStopMusic();
    if (btn) btn.textContent = '🔇 Música';
  } else {
    revStartMusic();
    if (btn) btn.textContent = '🔊 Música';
  }
}
function updateRevMusicButton(playing) {
  document.querySelectorAll('[data-rev-music]').forEach(el => {
    el.textContent = playing ? '🔊 Música' : '🔇 Música';
  });
}

/* ────────────────────────────────────────────────────────────────
   INIT
──────────────────────────────────────────────────────────────── */
let revolverResizeBound = false;

function initRevolverGame() {
  if (!bindCanvases()) return;
  stopGameLoop();
  stopMenuLoop();
  revSyncWallet();
  updateCoinDisplay();
  startMenuLoop();

  if (!revolverResizeBound) window.addEventListener('resize', () => {
    const menuScreen = document.getElementById('screen-menu');
    if (menuScreen && menuScreen.classList.contains('active')) {
      stopMenuLoop();
      startMenuLoop();
    }
    const gameScreen = document.getElementById('screen-game');
    if (gameScreen && gameScreen.classList.contains('active')) {
      setupGameCanvas();
    }
  });
  revolverResizeBound = true;
}

window.RevolverGame = {
  init: initRevolverGame,
  changeBet: revChangeBet,
  startGame: revStartGame,
  showOnlineModal,
  closeModal,
  exitToCasino: revExitToCasino,
  toggleRules: revToggleRules,
  toggleMusic: revToggleMusic,
  choosePPT,
  chooseShoot,
  restartGame: revRestartGame,
  destroy: () => {
    revStopMusic();
    revCancelOnlineSearch(false);
    stopGameLoop();
    stopMenuLoop();
    revUnlockCasinoNavigation();
  }
};

// Init is called by router after script load: window.RevolverGame?.init()
