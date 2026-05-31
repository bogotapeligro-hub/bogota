(() => {
  const STATE = {
    coins: 5,
    chips: [],
    playerIndices: [],
    botIndices: [],
    selected: [],
    revealed: false,
    roundOver: false,
    round: 0,
    gameMode: 'bot',
    opponentUsername: 'BOT'
  };

  const PF_ONLINE = {
    pollTimer: null,
    matchId: null,
    mySlot: 'player',
    opponentId: '',
    opponentUsername: 'RIVAL',
    p1Ready: false,
    p2Ready: false
  };

  let pfMusicAudio = null;

  function pfInitMusic() {
    if (pfMusicAudio) return pfMusicAudio;
    pfMusicAudio = new Audio('music/casino.mp3');
    pfMusicAudio.loop = true;
    pfMusicAudio.preload = 'auto';
    pfMusicAudio.volume = 0.28;
    return pfMusicAudio;
  }

  function pfStartMusic() {
    pfInitMusic();
    pfMusicAudio.currentTime = 0;
    pfMusicAudio.play().catch(() => {});
    pfUpdateMusicBtn(true);
  }

  function pfStopMusic() {
    if (pfMusicAudio) {
      pfMusicAudio.pause();
      pfMusicAudio.currentTime = 0;
    }
    pfUpdateMusicBtn(false);
  }

  function pfToggleMusic() {
    if (pfMusicAudio && !pfMusicAudio.paused) {
      pfStopMusic();
    } else {
      pfStartMusic();
    }
  }

  function pfUpdateMusicBtn(playing) {
    document.querySelectorAll('[data-pf-music]').forEach(el => {
      el.textContent = playing ? '🔊 Música' : '🔇 Música';
    });
  }

  const CHIP_COLORS = ['red', 'blue', 'green', 'gold'];
  const CHIP_LABELS = { red: 'ROJA', blue: 'AZUL', green: 'VERDE', gold: 'DORADA' };

  function syncWallet() {
    if (typeof CasinoCoins !== 'undefined') {
      CasinoCoins.initializeCoins();
      STATE.coins = CasinoCoins.getCoins();
    }
    return STATE.coins;
  }

  function commitWallet() {
    if (typeof CasinoCoins !== 'undefined') {
      STATE.coins = CasinoCoins.setCoins(STATE.coins);
      CasinoCoins.renderCoinBalance(document);
    }
    renderCoins();
  }

  function renderCoins() {
    document.querySelectorAll('[data-pf-coins]').forEach(el => {
      el.textContent = `${STATE.coins} 🪙`;
    });
  }

  function renderRound() {
    const el = document.querySelector('[data-pf-round]');
    if (el) el.textContent = `Ronda ${STATE.round}`;
  }

  function setStatus(msg, sub = '') {
    const el = document.querySelector('[data-pf-status]');
    const subEl = document.querySelector('[data-pf-status-sub]');
    if (el) el.textContent = msg;
    if (subEl) subEl.textContent = sub;
  }

  function showScreen(id) {
    document.querySelectorAll('.pf-screen').forEach(s => s.classList.remove('pf-active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('pf-active');
  }

  function generateChips() {
    STATE.chips = CHIP_COLORS.map(color => ({
      color,
      label: CHIP_LABELS[color],
      value: Math.floor(Math.random() * 10) + 1
    }));
    STATE.playerIndices = [];
    STATE.botIndices = [];
    STATE.selected = [];
    STATE.revealed = false;
    STATE.roundOver = false;
  }

  function renderChips(container, indices, hideValues = false) {
    container.innerHTML = '';
    indices.forEach(idx => {
      const chip = STATE.chips[idx];
      const el = document.createElement('div');
      el.className = `pf-chip pf-chip-${chip.color}`;
      if (hideValues) {
        el.classList.add('pf-chip-face-down');
        el.innerHTML = `<div class="pf-chip-inner"><div class="pf-chip-question">?</div></div>`;
      } else {
        el.innerHTML = `<div class="pf-chip-inner"><div class="pf-chip-value">${chip.value}</div><div class="pf-chip-label">${chip.label}</div></div>`;
        el.style.animationDelay = `${indices.indexOf(idx) * 0.12}s`;
      }
      container.appendChild(el);
    });
  }

  function renderPlayerSelection() {
    const container = document.querySelector('[data-pf-cards-player]');
    if (!container) return;
    container.innerHTML = '';
    const available = [0, 1, 2, 3].filter(i => !STATE.playerIndices.includes(i) && !STATE.botIndices.includes(i));

    [0, 1, 2, 3].forEach(idx => {
      const chip = STATE.chips[idx];
      const isPicked = STATE.playerIndices.includes(idx);
      const isBot = STATE.botIndices.includes(idx);
      const isSelected = STATE.selected.includes(idx);
      const isAvailable = available.includes(idx);

      const el = document.createElement('div');
      el.className = `pf-chip pf-chip-${chip.color}`;
      if (isPicked) {
        el.classList.add('pf-chip-picked');
        el.innerHTML = `<div class="pf-chip-inner"><div class="pf-chip-value">${chip.value}</div><div class="pf-chip-label">${chip.label}</div></div>`;
        el.style.animationDelay = '0s';
      } else if (isBot) {
        el.classList.add('pf-chip-bot');
        el.innerHTML = `<div class="pf-chip-inner"><div class="pf-chip-question">🤖</div></div>`;
      } else if (STATE.revealed && !isPicked && !isBot) {
        el.innerHTML = `<div class="pf-chip-inner"><div class="pf-chip-value">${chip.value}</div><div class="pf-chip-label">${chip.label}</div></div>`;
        el.style.animationDelay = '0s';
      } else if (isSelected) {
        el.classList.add('pf-chip-selected');
        el.innerHTML = `<div class="pf-chip-inner"><div class="pf-chip-question">✓</div></div>`;
      } else {
        el.classList.add('pf-chip-face-down', 'pf-chip-clickable');
        el.innerHTML = `<div class="pf-chip-inner"><div class="pf-chip-question">?</div></div>`;
        if (isAvailable) {
          el.dataset.chipIndex = idx;
          el.addEventListener('click', () => selectChip(idx));
        }
      }
      container.appendChild(el);
    });
  }

  function selectChip(idx) {
    if (STATE.revealed || STATE.roundOver) return;
    if (STATE.selected.includes(idx)) return;
    if (STATE.selected.length >= 2) return;
    STATE.selected.push(idx);
    renderPlayerSelection();
    updateRevealButton();
    setStatus(`Seleccionadas ${STATE.selected.length}/2 fichas`);
  }

  function updateRevealButton() {
    const btn = document.querySelector('[data-pf-action="reveal"]');
    if (btn) {
      btn.disabled = STATE.selected.length !== 2;
    }
  }

  function reveal() {
    if (STATE.selected.length !== 2 || STATE.revealed) return;
    STATE.revealed = true;

    const remaining = [0, 1, 2, 3].filter(i => !STATE.selected.includes(i));
    STATE.playerIndices = [...STATE.selected];
    STATE.botIndices = remaining;

    const playerTotal = STATE.playerIndices.reduce((s, i) => s + STATE.chips[i].value, 0);
    const botTotal = STATE.botIndices.reduce((s, i) => s + STATE.chips[i].value, 0);

    document.querySelector('[data-pf-pick-info]').textContent = '';
    document.querySelector('[data-pf-action="reveal"]').disabled = true;

    setTimeout(() => {
      renderPlayerSelection();
      renderChips(document.querySelector('[data-pf-cards-bot]'), STATE.botIndices, false);
      renderScores(playerTotal, botTotal);
      setTimeout(() => resolveRound(playerTotal, botTotal), 500);
    }, 300);
  }

  function renderScores(playerTotal, botTotal) {
    const pScore = document.querySelector('[data-pf-score-player]');
    const bScore = document.querySelector('[data-pf-score-bot]');
    if (pScore) pScore.textContent = playerTotal;
    if (bScore) bScore.textContent = botTotal;
  }

  function resolveRound(playerTotal, botTotal) {
    STATE.roundOver = true;
    let result, msg, coinDelta;

    if (playerTotal > botTotal) {
      result = 'win';
      coinDelta = 2;
      STATE.coins += coinDelta;
      msg = `¡Ganaste! ${playerTotal} vs ${botTotal}`;
    } else if (botTotal > playerTotal) {
      result = 'lose';
      coinDelta = 0;
      msg = `Perdiste. ${playerTotal} vs ${botTotal}`;
    } else {
      result = 'tie';
      coinDelta = 1;
      STATE.coins += coinDelta;
      msg = `Empate. ${playerTotal} vs ${botTotal}`;
    }

    commitWallet();
    setStatus(msg, result === 'win' ? '¡+2 monedas!' : result === 'tie' ? 'Recuperas tu moneda' : 'Perdiste 1 moneda');

    setTimeout(() => {
      showEnd(result, playerTotal, botTotal, coinDelta);
    }, 700);
  }

  function showEnd(result, playerTotal, botTotal, coinDelta) {
    const icons = { win: '🏆', lose: '💀', tie: '🤝' };
    const titles = { win: '¡GANASTE!', lose: 'PERDISTE', tie: 'EMPATE' };
    const subs = {
      win: `Tu ${playerTotal} superó al ${botTotal} del bot. ¡Bien jugado!`,
      lose: `Tu ${playerTotal} no alcanzó al ${botTotal} del bot.`,
      tie: `Ambos sumaron ${playerTotal}. Nadie pierde monedas.`
    };
    const coinTexts = { win: `+${coinDelta} 🪙`, lose: `-1 🪙`, tie: `±0 🪙` };
    const coinClasses = { win: '', lose: 'pf-end-lose', tie: 'pf-end-tie' };

    document.querySelector('[data-pf-end-icon]').textContent = icons[result];
    document.querySelector('[data-pf-end-title]').textContent = titles[result];
    document.querySelector('[data-pf-end-title]').className = `pf-end-title ${coinClasses[result]}`;
    document.querySelector('[data-pf-end-sub]').textContent = subs[result];
    const cEl = document.querySelector('[data-pf-end-coins]');
    cEl.textContent = coinTexts[result];
    cEl.className = `pf-end-coins ${coinClasses[result]}`;

    const statsEl = document.querySelector('[data-pf-end-stats]');
    statsEl.innerHTML = `
      <div class="pf-stat-item"><span class="pf-stat-val">${playerTotal}</span><span class="pf-stat-lbl">TU TOTAL</span></div>
      <div class="pf-stat-item"><span class="pf-stat-val">${botTotal}</span><span class="pf-stat-lbl">BOT</span></div>
    `;

    pfStopMusic();
    showScreen('pf-screen-end');
    renderCoins();
  }

  function startRound() {
    STATE.round++;
    if (STATE.coins < 1) {
      setStatus('No tienes monedas suficientes.');
      if (typeof CasinoCoins !== 'undefined') CasinoCoins.showNoCoinsMessage();
      return;
    }
    STATE.coins -= 1;
    commitWallet();
    generateChips();
    renderCoins();
    renderRound();

    document.querySelector('[data-pf-score-player]').textContent = '—';
    document.querySelector('[data-pf-score-bot]').textContent = '—';

    pfStartMusic();
    showScreen('pf-screen-game');
    renderPlayerSelection();
    updateRevealButton();
    setStatus('Elige 2 fichas para tu mano', 'Haz clic en las fichas de abajo');
    document.querySelector('[data-pf-pick-info]').textContent = 'Haz clic en 2 fichas para seleccionarlas';
  }

  function restartGame() {
    if (STATE.coins < 1) {
      setStatus('No tienes monedas.');
      showScreen('pf-screen-menu');
      renderCoins();
      return;
    }
    if (STATE.gameMode === 'online') {
      startOnlineRound();
    } else {
      startRound();
    }
  }

  /* ─── MODO ONLINE ─── */
  function startOnline() {
    if (STATE.coins < 1) {
      if (typeof CasinoCoins !== 'undefined') CasinoCoins.showNoCoinsMessage();
      return;
    }
    document.getElementById('pf-modal-online')?.classList.remove('hidden');
    Matchmaking.search('poker-fichas', {
      onStatus: (status) => {
        const titleEl = document.getElementById('pf-online-title');
        const textEl = document.getElementById('pf-online-text');
        const noteEl = document.getElementById('pf-online-note');
        const btnEl = document.getElementById('pf-online-cancel-btn');
        if (status === 'waiting') {
          if (titleEl) titleEl.textContent = 'Buscando jugador...';
          if (textEl) textEl.textContent = 'Esperando que otro jugador presione VS JUGADOR.';
          if (noteEl) noteEl.textContent = 'No se cobra moneda hasta encontrar rival.';
          if (btnEl) btnEl.textContent = 'CANCELAR BUSQUEDA';
        } else if (status === 'matched') {
          if (titleEl) titleEl.textContent = 'Jugador encontrado';
          if (textEl) textEl.textContent = 'Iniciando partida...';
          if (btnEl) btnEl.textContent = 'CERRAR';
        }
      },
      onMatch: (data) => {
        PF_ONLINE.matchId = data.matchId;
        PF_ONLINE.mySlot = data.mySlot;
        document.getElementById('pf-modal-online')?.classList.add('hidden');
        STATE.gameMode = 'online';
        STATE.opponentUsername = PF_ONLINE.opponentUsername;
        showScreen('pf-screen-menu');
        startOnlineRound();
        startOnlinePolling();
      },
      onError: (msg) => {
        const titleEl = document.getElementById('pf-online-title');
        if (titleEl) titleEl.textContent = 'Error: ' + msg;
        PF_ONLINE.matchId = null;
      }
    });
    Matchmaking.connect().catch(() => {});
  }

  function cancelOnline() {
    document.getElementById('pf-modal-online')?.classList.add('hidden');
    Matchmaking.cancel();
  }

  function startOnlinePolling() {
    window.clearInterval(PF_ONLINE.pollTimer);
    PF_ONLINE.pollTimer = window.setInterval(pollOnlineGame, 800);
  }

  async function pollOnlineGame() {
    if (!PF_ONLINE.matchId || STATE.gameMode !== 'online') return;
    try {
      const result = await Api.apiCasinoGetGameMatch(Auth.token(), PF_ONLINE.matchId);
      if (!result?.match?.state) return;
      const s = result.match.state;
      const myId = Auth.user()?.userId;
      PF_ONLINE.opponentId = s.p2Id === myId ? s.p1Id : s.p2Id;
      PF_ONLINE.opponentUsername = s.p2Id === myId ? (s.p1Username || 'RIVAL') : (s.p2Username || 'RIVAL');
      STATE.opponentUsername = PF_ONLINE.opponentUsername;

      if (s.gameOver) {
        window.clearInterval(PF_ONLINE.pollTimer);
        PF_ONLINE.pollTimer = null;
        STATE.roundOver = true;
        return;
      }

      if (s.chips && s.chips.length > 0) {
        STATE.chips = s.chips;
      }

      if (s.state) {
        STATE.revealed = s.state.revealed || false;
        STATE.playerIndices = PF_ONLINE.mySlot === 'player' ? (s.state.p1Indices || []) : (s.state.p2Indices || []);
        STATE.botIndices = PF_ONLINE.mySlot === 'player' ? (s.state.p2Indices || []) : (s.state.p1Indices || []);
        STATE.selected = STATE.playerIndices;
        PF_ONLINE.p1Ready = s.state.p1Ready || false;
        PF_ONLINE.p2Ready = s.state.p2Ready || false;

        const oppReady = PF_ONLINE.mySlot === 'player' ? s.state.p2Ready : s.state.p1Ready;
        if (oppReady && !STATE.revealed && STATE.playerIndices.length === 2) {
          STATE.revealed = true;
          renderOnlineGame();
          const playerTotal = STATE.playerIndices.reduce((sum, i) => sum + STATE.chips[i].value, 0);
          const botTotal = STATE.botIndices.reduce((sum, i) => sum + STATE.chips[i].value, 0);
          renderScores(playerTotal, botTotal);
          setTimeout(() => resolveOnlineRound(playerTotal, botTotal), 500);
        } else {
          renderOnlineGame();
        }
      }
    } catch (err) {}
  }

  async function saveOnlineState(stateUpdate) {
    if (!PF_ONLINE.matchId || STATE.gameMode !== 'online') return;
    const myId = Auth.user()?.userId;
    const myUser = Auth.user();
    const mySlotKey = PF_ONLINE.mySlot === 'player' ? 'p1' : 'p2';
    const oppSlotKey = PF_ONLINE.mySlot === 'player' ? 'p2' : 'p1';
    const state = {
      p1Id: PF_ONLINE.mySlot === 'player' ? myId : PF_ONLINE.opponentId,
      p2Id: PF_ONLINE.mySlot === 'player' ? PF_ONLINE.opponentId : myId,
      p1Username: PF_ONLINE.mySlot === 'player' ? (myUser?.username || 'Jugador') : PF_ONLINE.opponentUsername,
      p2Username: PF_ONLINE.mySlot === 'player' ? PF_ONLINE.opponentUsername : (myUser?.username || 'Jugador'),
      chips: STATE.chips,
      state: {
        p1Indices: PF_ONLINE.mySlot === 'player' ? STATE.playerIndices : STATE.botIndices,
        p2Indices: PF_ONLINE.mySlot === 'player' ? STATE.botIndices : STATE.playerIndices,
        p1Ready: PF_ONLINE.mySlot === 'player' ? true : PF_ONLINE.p1Ready,
        p2Ready: PF_ONLINE.mySlot === 'player' ? PF_ONLINE.p2Ready : true,
        revealed: STATE.revealed
      },
      gameOver: STATE.roundOver && STATE.revealed,
      updatedAt: Date.now()
    };
    try {
      await Api.apiCasinoSaveGameMatch(Auth.token(), PF_ONLINE.matchId, state);
    } catch (err) {}
  }

  function selectOnlineChip(idx) {
    if (STATE.revealed || STATE.roundOver) return;
    if (STATE.selected.includes(idx)) return;
    if (STATE.selected.length >= 2) return;
    STATE.selected.push(idx);
    const pickedIdx = STATE.selected.length === 1 ? STATE.selected[0] : STATE.selected[1];
    renderOnlineGame();
    if (STATE.selected.length === 2) {
      STATE.playerIndices = [...STATE.selected];
      const remaining = [0, 1, 2, 3].filter(i => !STATE.selected.includes(i));
      STATE.botIndices = remaining;
      STATE.revealed = true;
      saveOnlineState();
      const playerTotal = STATE.playerIndices.reduce((sum, i) => sum + STATE.chips[i].value, 0);
      const botTotal = STATE.botIndices.reduce((sum, i) => sum + STATE.chips[i].value, 0);
      renderOnlineGame();
      renderScores(playerTotal, botTotal);
      setTimeout(() => resolveOnlineRound(playerTotal, botTotal), 500);
    }
    document.querySelector('[data-pf-pick-info]').textContent = `Seleccionadas ${STATE.selected.length}/2 fichas`;
  }

  function startOnlineRound() {
    STATE.round++;
    if (STATE.coins < 1) {
      if (typeof CasinoCoins !== 'undefined') CasinoCoins.showNoCoinsMessage();
      return;
    }
    STATE.coins -= 1;
    commitWallet();
    generateChips();
    STATE.selected = [];
    STATE.playerIndices = [];
    STATE.botIndices = [];
    STATE.revealed = false;
    STATE.roundOver = false;
    renderCoins();
    renderRound();
    pfStartMusic();
    showScreen('pf-screen-game');
    renderOnlineGame();
    document.querySelector('[data-pf-pick-info]').textContent = 'Elige 2 fichas';
    document.querySelector('[data-pf-action="reveal"]').disabled = true;
    document.querySelector('[data-pf-action="reveal"]').textContent = 'ESPERANDO RIVAL...';
  }

  function renderOnlineGame() {
    const container = document.querySelector('[data-pf-cards-player]');
    if (!container) return;
    container.innerHTML = '';
    [0, 1, 2, 3].forEach(idx => {
      const chip = STATE.chips[idx];
      const isPicked = STATE.playerIndices.includes(idx);
      const isBot = STATE.botIndices.includes(idx);
      const isSelected = STATE.selected.includes(idx);
      const el = document.createElement('div');
      el.className = `pf-chip pf-chip-${chip.color}`;
      if (isPicked && STATE.revealed) {
        el.classList.add('pf-chip-picked');
        el.innerHTML = `<div class="pf-chip-inner"><div class="pf-chip-value">${chip.value}</div><div class="pf-chip-label">${chip.label}</div></div>`;
      } else if (isBot && STATE.revealed) {
        el.classList.add('pf-chip-bot');
        el.innerHTML = `<div class="pf-chip-inner"><div class="pf-chip-question">🤖</div></div>`;
      } else if (isPicked && !STATE.revealed) {
        el.classList.add('pf-chip-picked');
        el.innerHTML = `<div class="pf-chip-inner"><div class="pf-chip-value">${chip.value}</div><div class="pf-chip-label">${chip.label}</div></div>`;
      } else if (isBot && !STATE.revealed) {
        el.classList.add('pf-chip-bot');
        el.innerHTML = `<div class="pf-chip-inner"><div class="pf-chip-question">?</div></div>`;
      } else if (isSelected) {
        el.classList.add('pf-chip-selected');
        el.innerHTML = `<div class="pf-chip-inner"><div class="pf-chip-question">✓</div></div>`;
      } else if (STATE.revealed) {
        el.innerHTML = `<div class="pf-chip-inner"><div class="pf-chip-value">${chip.value}</div><div class="pf-chip-label">${chip.label}</div></div>`;
      } else {
        el.classList.add('pf-chip-face-down', 'pf-chip-clickable');
        el.innerHTML = `<div class="pf-chip-inner"><div class="pf-chip-question">?</div></div>`;
        if (!STATE.selected.includes(idx) && STATE.selected.length < 2) {
          el.dataset.chipIndex = idx;
          el.addEventListener('click', () => selectOnlineChip(idx));
        }
      }
      container.appendChild(el);
    });

    const statusEl = document.querySelector('[data-pf-status]');
    if (statusEl) {
      if (STATE.revealed && STATE.roundOver) {
        statusEl.textContent = 'Ronda finalizada';
      } else if (STATE.revealed) {
        statusEl.textContent = 'Esperando resultado...';
      } else if (STATE.selected.length === 2) {
        statusEl.textContent = 'Fichas seleccionadas. Esperando rival...';
      } else {
        statusEl.textContent = 'Elige 2 fichas';
      }
    }
  }

  function resolveOnlineRound(playerTotal, botTotal) {
    STATE.roundOver = true;
    let result, coinDelta;
    if (playerTotal > botTotal) {
      result = 'win'; coinDelta = 2; STATE.coins += coinDelta;
    } else if (botTotal > playerTotal) {
      result = 'lose'; coinDelta = 0;
    } else {
      result = 'tie'; coinDelta = 1; STATE.coins += coinDelta;
    }
    commitWallet();
    setStatus(result === 'win' ? '¡Ganaste!' : result === 'tie' ? 'Empate' : 'Perdiste',
      result === 'win' ? `+${coinDelta}` : result === 'tie' ? '±0' : '-1');
    saveOnlineState();
    setTimeout(() => {
      showOnlineEnd(result, playerTotal, botTotal, coinDelta);
    }, 700);
  }

  function showOnlineEnd(result, playerTotal, botTotal, coinDelta) {
    const icons = { win: '🏆', lose: '💀', tie: '🤝' };
    const titles = { win: '¡GANASTE!', lose: 'PERDISTE', tie: 'EMPATE' };
    const subs = {
      win: `Tu ${playerTotal} superó al ${botTotal} de ${STATE.opponentUsername}.`,
      lose: `Tu ${playerTotal} no alcanzó al ${botTotal} de ${STATE.opponentUsername}.`,
      tie: `Ambos sumaron ${playerTotal}.`
    };
    document.querySelector('[data-pf-end-icon]').textContent = icons[result];
    document.querySelector('[data-pf-end-title]').textContent = titles[result];
    document.querySelector('[data-pf-end-title]').className = `pf-end-title ${result === 'lose' ? 'pf-end-lose' : result === 'tie' ? 'pf-end-tie' : ''}`;
    document.querySelector('[data-pf-end-sub]').textContent = subs[result];
    const cEl = document.querySelector('[data-pf-end-coins]');
    cEl.textContent = result === 'win' ? `+${coinDelta} 🪙` : result === 'lose' ? '-1 🪙' : '±0 🪙';
    cEl.className = `pf-end-coins ${result === 'lose' ? 'pf-end-lose' : result === 'tie' ? 'pf-end-tie' : ''}`;
    const statsEl = document.querySelector('[data-pf-end-stats]');
    statsEl.innerHTML = `<div class="pf-stat-item"><span class="pf-stat-val">${playerTotal}</span><span class="pf-stat-lbl">TU TOTAL</span></div>
      <div class="pf-stat-item"><span class="pf-stat-val">${botTotal}</span><span class="pf-stat-lbl">${STATE.opponentUsername}</span></div>`;
    pfStopMusic();
    showScreen('pf-screen-end');
    renderCoins();
  }

  function init() {
    syncWallet();
    renderCoins();
    renderRound();
    showScreen('pf-screen-menu');
    bindEvents();
  }

  let eventsBound = false;

  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;
    const root = document.getElementById('pf-screen-menu');
    if (!root) return;

    document.addEventListener('click', event => {
      const btn = event.target.closest('[data-pf-action]');
      if (!btn) return;
      const action = btn.dataset.pfAction;
      if (action === 'start') startRound();
      else if (action === 'online') {
        if (!UI.requireSession()) return;
        if (typeof Api === "undefined" || !Api.hasConfiguredApiUrl()) {
          UI.toast('Configura Apps Script para buscar rival.', 'error');
          return;
        }
        startOnline();
      }
      else if (action === 'exit') {
        window.clearInterval(PF_ONLINE.pollTimer);
        PF_ONLINE.pollTimer = null;
        Matchmaking.leave();
        location.hash = '#/casino';
      } else if (action === 'reveal') reveal();
      else if (action === 'restart') restartGame();
    });
  }

  window.PokerFichas = {
    init,
    toggleMusic: pfToggleMusic,
    cancelOnline,
    destroy: () => {
      window.clearInterval(PF_ONLINE.pollTimer);
      PF_ONLINE.pollTimer = null;
      Matchmaking.leave();
      pfStopMusic();
    }
  };
})();
