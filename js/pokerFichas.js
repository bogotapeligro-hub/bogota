(() => {
  const STATE = {
    coins: 5,
    chips: [],
    playerIndices: [],
    botIndices: [],
    selected: [],
    revealed: false,
    roundOver: false,
    round: 0
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
    startRound();
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
      else if (action === 'exit') {
        location.hash = '#/casino';
      } else if (action === 'reveal') reveal();
      else if (action === 'restart') restartGame();
    });
  }

  window.PokerFichas = {
    init,
    toggleMusic: pfToggleMusic,
    destroy: () => {
      pfStopMusic();
    }
  };
})();
