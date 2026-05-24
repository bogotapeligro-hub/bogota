// powersRuleta.js - Sistema de poderes RuletaBogotana

const POWERS_CATALOG = {
  manzana: {
    id: "manzana",
    name: "Manzana de la Septima",
    icon: "🍎",
    desc: "Recupera 1 vida. Maximo 5.",
    consumesTurn: false,
    oncePerRound: true
  },
  doble: {
    id: "doble",
    name: "Golpe Doble",
    icon: "⚡",
    desc: "Proximo disparo real hace 2 de dano. Si falla, pierdes el turno.",
    consumesTurn: false,
    oncePerRound: false
  },
  esposas: {
    id: "esposas",
    name: "Esposas del CAI",
    icon: "⛓",
    desc: "El enemigo pierde su proximo turno.",
    consumesTurn: false,
    oncePerRound: true
  },
  escudo: {
    id: "escudo",
    name: "Chaleco Improvisado",
    icon: "🛡",
    desc: "Bloquea 1 punto de dano recibido.",
    consumesTurn: false,
    oncePerRound: false
  },
  scanner: {
    id: "scanner",
    name: "Ojo de Halcon",
    icon: "🔍",
    desc: "Revela solamente si la proxima carga es real o falsa.",
    consumesTurn: false,
    oncePerRound: false
  },
  cambio: {
    id: "cambio",
    name: "Cambio de Ritmo",
    icon: "🔄",
    desc: "Pasa el turno al enemigo sin disparar.",
    consumesTurn: true,
    oncePerRound: false
  },
  recarga: {
    id: "recarga",
    name: "Recarga Sucia",
    icon: "🎲",
    desc: "Mezcla las cargas restantes. No cambia la cantidad.",
    consumesTurn: false,
    oncePerRound: false
  },
  curita: {
    id: "curita",
    name: "Curita de Barrio",
    icon: "🩹",
    desc: "Si tienes 2 vidas o menos, recupera 1 vida.",
    consumesTurn: false,
    oncePerRound: false
  }
};

const ALL_POWER_IDS = Object.keys(POWERS_CATALOG);

function getRandomPowers(count) {
  const shuffled = [...ALL_POWER_IDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((id) => ({ ...POWERS_CATALOG[id], usedThisRound: false }));
}

function canUsePower(powerId, gameState, whoIsUsing) {
  const catalogPower = POWERS_CATALOG[powerId];
  if (!catalogPower || gameState.isRoundIntro) return false;
  const actor = gameState.players[whoIsUsing];
  const power = actor.powers.find((pw) => pw.id === powerId);
  if (!power) return false;
  if (catalogPower.oncePerRound && power.usedThisRound) return false;

  switch (powerId) {
    case "manzana":
      return actor.lives < gameState.maxLives;
    case "curita":
      return actor.lives <= 2;
    case "escudo":
      return !actor.shield;
    case "doble":
      return !actor.doubleDamage;
    case "scanner":
      return Boolean(gameState.chamber && gameState.chamber.length);
    default:
      return true;
  }
}

function applyPower(powerId, gameState, whoIsUsing) {
  const actor = gameState.players[whoIsUsing];
  const enemy = whoIsUsing === "player" ? gameState.players.enemy : gameState.players.player;
  const power = actor.powers.find((pw) => pw.id === powerId);

  let msg = "";
  let consumesTurn = false;
  let scanResult = "";

  switch (powerId) {
    case "manzana":
      if (actor.lives < gameState.maxLives) {
        actor.lives = Math.min(gameState.maxLives, actor.lives + 1);
        msg = `${actor.name} uso Manzana de la Septima. +1 vida. Vidas: ${actor.lives}`;
      } else {
        msg = "Ya tienes vidas al maximo.";
      }
      break;

    case "doble":
      actor.doubleDamage = true;
      msg = `${actor.name} activo Golpe Doble. Proximo disparo real hara 2 de dano.`;
      break;

    case "esposas":
      enemy.skipTurn = true;
      msg = `${actor.name} uso Esposas del CAI. ${enemy.name} pierde su proximo turno.`;
      break;

    case "escudo":
      actor.shield = true;
      msg = `${actor.name} equipo Chaleco Improvisado. Bloquea 1 dano.`;
      break;

    case "scanner": {
      const nextLoad = gameState.chamber && gameState.chamber.length ? gameState.chamber[0] : "";
      if (!nextLoad) {
        msg = "No quedan cargas en la recamara.";
      } else {
        scanResult = nextLoad === "real" ? "REAL" : "FALSA";
        msg = `Ojo de Halcon: la proxima carga parece ${scanResult}.`;
      }
      break;
    }

    case "cambio":
      consumesTurn = true;
      msg = `${actor.name} uso Cambio de Ritmo. Turno pasado al ${enemy.name}.`;
      break;

    case "recarga":
      gameState.chamber = [...gameState.chamber].sort(() => Math.random() - 0.5);
      msg = "Recarga Sucia: las cargas restantes fueron mezcladas.";
      break;

    case "curita":
      if (actor.lives <= 2) {
        actor.lives = Math.min(gameState.maxLives, actor.lives + 1);
        msg = `${actor.name} uso Curita de Barrio. +1 vida. Vidas: ${actor.lives}`;
      } else {
        msg = "Curita solo funciona con 2 vidas o menos.";
      }
      break;

    default:
      msg = "Poder desconocido.";
  }

  if (power) power.usedThisRound = true;
  actor.powers = actor.powers.filter((pw) => pw.id !== powerId);

  return { msg, consumesTurn, scanResult };
}

function refreshPowersIfNeeded(gameState, who) {
  const actor = gameState.players[who];
  if (actor.powers.length === 0) {
    actor.powers = getRandomPowers(2);
  }
}

function renderPowers(gameState, who, container, onUsePower) {
  if (!container) return;
  const actor = gameState.players[who];
  container.innerHTML = "";

  if (!actor.powers || actor.powers.length === 0) {
    container.innerHTML = '<p class="no-powers">Sin poderes disponibles</p>';
    return;
  }

  actor.powers.forEach((power) => {
    const ok = canUsePower(power.id, gameState, who);
    const card = document.createElement("button");
    card.className = "power-card" + (ok ? "" : " power-disabled");
    card.disabled = !ok;
    card.innerHTML = `
      <span class="power-icon">${power.icon}</span>
      <span class="power-name">${power.name}</span>
      <span class="power-desc">${power.desc}</span>
    `;
    card.addEventListener("click", () => {
      if (ok && onUsePower) onUsePower(power.id);
    });
    container.appendChild(card);
  });
}
