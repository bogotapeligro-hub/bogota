const CasinoArcade = (() => {
  const COST = 1;
  let currentGameId = "";
  let busy = false;
  let monserrateLevel = 0;
  let monserrateBank = 0;

  const games = {
    tejo: {
      title: "Tejo Digital",
      icon: "TD",
      rules: "Elige fuerza y direccion. Fallo no paga, Cerca devuelve 1, Mecha paga 3 y Monona paga 6.",
      controls: () => `
        <label>Fuerza <input id="tejoPower" type="range" min="1" max="10" value="6"></label>
        <label>Direccion
          <select id="tejoDirection">
            <option value="izquierda">Izquierda</option>
            <option value="centro" selected>Centro</option>
            <option value="derecha">Derecha</option>
          </select>
        </label>
      `,
      play: () => {
        const power = Number(document.getElementById("tejoPower")?.value || 6);
        const direction = document.getElementById("tejoDirection")?.value || "centro";
        const targetPower = roll(4, 8);
        const dirScore = direction === "centro" ? 2 : 0;
        const score = 10 - Math.abs(power - targetPower) + dirScore + roll(-2, 2);
        if (score >= 11) return outcome("Monona", 6, `Fuerza ${power}, direccion ${direction}. Le pegaste perfecto.`);
        if (score >= 8) return outcome("Mecha", 3, `Fuerza ${power}, direccion ${direction}. Encendiste la mecha.`);
        if (score >= 5) return outcome("Cerca", 1, `Fuerza ${power}, direccion ${direction}. Quedaste cerca.`);
        return outcome("Fallo", 0, `Fuerza ${power}, direccion ${direction}. El tejo se fue largo.`);
      }
    },
    chiva: {
      title: "Chiva Ruleta",
      icon: "CH",
      rules: "La chiva avanza por casillas: premio, perdida, bonus o nada.",
      controls: () => `<div class="arcade-track" id="chivaTrack">${["Nada", "+2", "Pierde", "+1", "Bonus +5", "Nada", "+3"].map((x, i) => `<span data-cell="${i}">${x}</span>`).join("")}</div>`,
      play: () => {
        const cells = [
          outcome("Nada", 0, "La chiva paro en una casilla sin premio."),
          outcome("Premio", 2, "La chiva paro en premio de ruta."),
          outcome("Perdida", 0, "La chiva paro en trancón."),
          outcome("Premio", 1, "La chiva recogio pasajeros."),
          outcome("Bonus", 5, "La chiva encontro bonus urbano."),
          outcome("Nada", 0, "La chiva siguio sin premio."),
          outcome("Premio", 3, "La chiva llego a la plaza.")
        ];
        const index = roll(0, cells.length - 1);
        markTrackCell(index);
        return cells[index];
      }
    },
    transmi: {
      title: "TransMilenio Rush",
      icon: "TM",
      rules: "Elige una puerta antes de que cierre. Una ruta paga, otra devuelve, otra pierde.",
      controls: () => `
        <div class="arcade-choice-grid">
          ${["Portal Norte", "Calle 76", "Museo Nacional"].map((name, i) => `<button class="game-btn game-btn-locked" type="button" data-arcade-choice="${i}">${name}</button>`).join("")}
        </div>
      `,
      play: () => {
        const choice = selectedChoice();
        const winning = roll(0, 2);
        if (choice === winning) return outcome("Ruta perfecta", 4, "Entraste por la puerta correcta antes del cierre.");
        if (Math.abs(choice - winning) === 1) return outcome("Casi", 1, "Alcanzaste a entrar, pero de pie.");
        return outcome("Puerta cerrada", 0, "La puerta se cerro justo antes.");
      }
    },
    pico: {
      title: "Pico y Placa Challenge",
      icon: "PP",
      rules: "Mira la placa y decide si puede circular. Si aciertas, ganas.",
      beforeRender: () => {
        const plate = roll(0, 9);
        const restricted = [1, 2, 3, 4, 5].includes(plate);
        return { plate, restricted };
      },
      controls: data => `
        <div class="arcade-plate">BAU-${data.plate}${roll(10, 99)}</div>
        <div class="arcade-choice-grid">
          <button class="game-btn game-btn-locked" type="button" data-arcade-choice="circula">Puede circular</button>
          <button class="game-btn game-btn-locked" type="button" data-arcade-choice="no">No puede circular</button>
        </div>
      `,
      play: data => {
        const choice = selectedChoice("circula");
        const correct = data.restricted ? "no" : "circula";
        if (choice === correct) return outcome("Acertaste", 3, `La placa terminaba en ${data.plate}. Decision correcta.`);
        return outcome("Comparendo", 0, `La placa terminaba en ${data.plate}. Decision incorrecta.`);
      }
    },
    monserrate: {
      title: "Monserrate Lucky Climb",
      icon: "MO",
      rules: "Sube niveles para aumentar premio. Puedes cobrar o seguir arriesgando.",
      controls: () => `
        <div class="arcade-climb">
          <strong>Nivel <span id="climbLevel">0</span></strong>
          <span>Bolsa: <b id="climbBank">0</b> monedas</span>
        </div>
        <div class="arcade-choice-grid">
          <button class="game-btn game-btn-locked" type="button" data-arcade-choice="subir">Subir</button>
          <button class="game-btn game-btn-locked" type="button" data-arcade-choice="cobrar">Cobrar</button>
        </div>
      `,
      reset: () => { monserrateLevel = 0; monserrateBank = 0; },
      play: () => {
        const choice = selectedChoice("subir");
        if (choice === "cobrar") {
          const reward = monserrateBank || 1;
          monserrateLevel = 0;
          monserrateBank = 0;
          updateClimb();
          return outcome("Cobraste", reward, `Te retiraste a tiempo con ${reward} monedas.`);
        }
        monserrateLevel += 1;
        const failChance = 0.18 + monserrateLevel * 0.08;
        if (Math.random() < failChance) {
          monserrateLevel = 0;
          monserrateBank = 0;
          updateClimb();
          return outcome("Resbalon", 0, "Arriesgaste demasiado y perdiste la subida.");
        }
        monserrateBank += monserrateLevel * 2;
        updateClimb();
        return outcome("Subiste", monserrateBank, `Llegaste al nivel ${monserrateLevel}. Puedes cobrar o seguir.`);
      },
      keepRound: result => result.title === "Subiste"
    },
    sello: {
      title: "Cara o Sello Rolo",
      icon: "CS",
      rules: "Elige cara o sello. Si aciertas, ganas 2 monedas.",
      controls: () => `
        <div class="arcade-choice-grid">
          <button class="game-btn game-btn-locked" type="button" data-arcade-choice="cara">Cara</button>
          <button class="game-btn game-btn-locked" type="button" data-arcade-choice="sello">Sello</button>
        </div>
      `,
      play: () => {
        const choice = selectedChoice("cara");
        const result = Math.random() < 0.5 ? "cara" : "sello";
        if (choice === result) return outcome("Acertaste", 2, `Cayo ${result}.`);
        return outcome("Fallaste", 0, `Cayo ${result}.`);
      }
    },
    dados: {
      title: "Dados de la Candelaria",
      icon: "DC",
      rules: "Lanza dos dados. 7 u 11 paga 3, dobles pagan 5, suma baja pierde.",
      controls: () => `<div class="arcade-dice" id="arcadeDice">--</div>`,
      play: () => {
        const dice = [roll(1, 6), roll(1, 6)];
        const sum = dice[0] + dice[1];
        const diceEl = document.getElementById("arcadeDice");
        if (diceEl) diceEl.textContent = `${dice[0]} + ${dice[1]}`;
        if (dice[0] === dice[1]) return outcome("Dobles", 5, `Sacaste ${sum} con dobles.`);
        if ([7, 11].includes(sum)) return outcome("Suma ganadora", 3, `Sacaste ${sum}.`);
        if (sum >= 8) return outcome("Devuelve", 1, `Sacaste ${sum}. Recuperas la entrada.`);
        return outcome("Perdiste", 0, `Sacaste ${sum}.`);
      }
    },
    tragamonedas: {
      title: "Mini Tragamonedas Bogotana",
      icon: "MB",
      rules: "Gira tres símbolos urbanos. Tres iguales pagan 8, dos iguales pagan 2.",
      controls: () => `<div class="arcade-slots" id="arcadeSlots"><span>TM</span><span>MO</span><span>CH</span></div>`,
      play: () => {
        const symbols = ["TM", "MO", "CH", "DC", "PP"];
        const spin = [pick(symbols), pick(symbols), pick(symbols)];
        document.getElementById("arcadeSlots").innerHTML = spin.map(x => `<span>${UI.escapeHTML(x)}</span>`).join("");
        const unique = new Set(spin).size;
        if (unique === 1) return outcome("Linea completa", 8, `Tres ${spin[0]}.`);
        if (unique === 2) return outcome("Dos iguales", 2, "Dos simbolos coincidieron.");
        return outcome("Sin linea", 0, "No hubo combinacion.");
      }
    }
  };

  function render(gameId) {
    currentGameId = gameId;
    const game = games[gameId];
    if (!game) {
      UI.renderApp(UI.emptyState("Juego no encontrado", "Esta mesa no existe.", `<a class="warning-btn inline-btn" href="#/casino">Volver al casino</a>`));
      return;
    }
    if (!UI.requireSession()) return;
    CasinoCoins.initializeCoins();
    if (game.reset) game.reset();
    const data = game.beforeRender ? game.beforeRender() : {};
    UI.renderApp(`
      <section class="arcade-root" data-arcade-game="${UI.escapeHTML(gameId)}">
        <div class="game-topbar">
          <a href="#/casino" class="back-link">← Casino</a>
          <div class="round-info">Entrada: ${COST} moneda</div>
          <div class="casino-coins ruleta-coins" data-casino-coins>
            <img src="assets/casino.png" alt="Moneda de casino" class="casino-coin-icon">
            <span>x <strong data-casino-coin-amount>5</strong></span>
            <small class="coin-timer" data-casino-coin-timer>Monedas listas</small>
          </div>
        </div>
        <section class="arcade-panel">
          <div class="arcade-header">
            <div class="duelo-symbol">${UI.escapeHTML(game.icon)}</div>
            <div>
              <span class="badge-alert">Juego activo</span>
              <h1>${UI.escapeHTML(game.title)}</h1>
              <p>${UI.escapeHTML(game.rules)}</p>
            </div>
          </div>
          <div class="arcade-controls" data-arcade-controls>${game.controls(data)}</div>
          <div class="turn-indicator" data-arcade-status>Listo. Presiona jugar cuando quieras iniciar.</div>
          <div class="arcade-actions">
            <button class="game-btn game-btn-play" type="button" data-arcade-play>Jugar por ${COST}</button>
            <button class="game-btn game-btn-locked" type="button" data-arcade-online>Online en preparacion</button>
          </div>
          <div class="duelo-result arcade-result" data-arcade-result>Sin resultado todavía.</div>
        </section>
      </section>
    `);
    CasinoCoins.renderCoinBalance(document);
    bind(game, data);
  }

  function bind(game, data) {
    document.querySelectorAll("[data-arcade-choice]").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-arcade-choice]").forEach(item => item.classList.remove("arcade-choice-selected"));
        button.classList.add("arcade-choice-selected");
      });
    });
    document.querySelector("[data-arcade-play]")?.addEventListener("click", () => runGame(game, data));
    document.querySelector("[data-arcade-online]")?.addEventListener("click", () => {
      UI.toast("Modo online preparado para una siguiente fase. No se descontaron monedas.", "info");
    });
  }

  async function runGame(game, data) {
    if (busy) return;
    const button = document.querySelector("[data-arcade-play]");
    if (CasinoCoins.getCoins() < COST) {
      CasinoCoins.showNoCoinsMessage();
      setStatus("No tienes monedas suficientes para jugar.");
      return;
    }
    busy = true;
    UI.setLoading(button, true, "Preparando...");
    setStatus("Preparando partida...");
    let charged = false;
    try {
      await delay(220);
      CasinoCoins.setCoins(CasinoCoins.getCoins() - COST);
      charged = true;
      CasinoCoins.renderCoinBalance(document);
      setStatus("Jugando...");
      animate();
      await delay(620);
      const result = game.play(data);
      if (result.reward > 0) CasinoCoins.setCoins(CasinoCoins.getCoins() + result.reward);
      CasinoCoins.renderCoinBalance(document);
      setResult(result);
      setStatus(result.reward > COST ? `Ganaste ${result.reward} monedas.` : result.reward === COST ? "Recuperaste la entrada." : "Perdiste la entrada.");
      if (!game.keepRound?.(result)) {
        data = game.beforeRender ? game.beforeRender() : data;
      }
    } catch (error) {
      if (charged) {
        CasinoCoins.setCoins(CasinoCoins.getCoins() + COST);
        CasinoCoins.renderCoinBalance(document);
        UI.toast("Tus monedas fueron devueltas por un error.", "warning");
      }
      setStatus("No se pudo completar el juego. No se descontaron monedas.");
      UI.toast(error.message || "Error en el juego.", "error");
    } finally {
      busy = false;
      UI.setLoading(button, false);
    }
  }

  function outcome(title, reward, detail) {
    return { title, reward: Number(reward || 0), detail };
  }

  function selectedChoice(fallback = "0") {
    return document.querySelector(".arcade-choice-selected")?.dataset.arcadeChoice || fallback;
  }

  function setStatus(message) {
    const el = document.querySelector("[data-arcade-status]");
    if (el) el.textContent = message;
  }

  function setResult(result) {
    const el = document.querySelector("[data-arcade-result]");
    if (!el) return;
    el.innerHTML = `<strong>${UI.escapeHTML(result.title)}</strong><span>${UI.escapeHTML(result.detail)}</span><em>${result.reward ? `+${result.reward} monedas` : "Sin premio"}</em>`;
  }

  function animate() {
    const panel = document.querySelector(".arcade-panel");
    if (!panel) return;
    panel.classList.remove("arcade-shake");
    void panel.offsetWidth;
    panel.classList.add("arcade-shake");
  }

  function updateClimb() {
    const level = document.getElementById("climbLevel");
    const bank = document.getElementById("climbBank");
    if (level) level.textContent = String(monserrateLevel);
    if (bank) bank.textContent = String(monserrateBank);
  }

  function roll(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(items) {
    return items[roll(0, items.length - 1)];
  }

  function markTrackCell(index) {
    document.querySelectorAll("[data-cell]").forEach(cell => cell.classList.toggle("arcade-choice-selected", Number(cell.dataset.cell) === index));
  }

  function delay(ms) {
    return new Promise(resolve => window.setTimeout(resolve, ms));
  }

  window.addEventListener("hashchange", () => {
    busy = false;
    currentGameId = "";
  });

  return { render };
})();
