// botRuleta.js - IA probabilistica para RuletaBogotana.

function botDecide(gameState) {
  const bot = gameState.players.enemy;
  const player = gameState.players.player;
  const realLeft = Math.max(0, Number(gameState.realCount || 0));
  const fakeLeft = Math.max(0, Number(gameState.fakeCount || 0));
  const total = realLeft + fakeLeft;

  if (total === 0) return { action: 'pass', target: null, power: null };

  const realProb = realLeft / total;
  const fakeProb = fakeLeft / total;
  const power = chooseBotPower(bot, player, gameState, realProb, fakeProb);
  if (power) return { action: 'power', target: null, power };

  const roll = Math.random();

  if (realProb >= 0.65) {
    return { action: 'shoot', target: roll < 0.82 ? 'player' : 'self' };
  }

  if (fakeProb >= 0.65) {
    return { action: 'shoot', target: roll < 0.78 ? 'self' : 'player' };
  }

  if (player.lives <= 2 && roll < 0.62) {
    return { action: 'shoot', target: 'player' };
  }

  if (bot.lives <= 2 && fakeProb >= 0.45 && roll < 0.58) {
    return { action: 'shoot', target: 'self' };
  }

  return { action: 'shoot', target: roll < 0.52 ? 'player' : 'self' };
}

function chooseBotPower(bot, player, gameState, realProb, fakeProb) {
  if (!bot.powers || bot.powers.length === 0) return null;

  const manzana = bot.powers.find(p => p.id === 'manzana');
  if (manzana && bot.lives <= 2 && bot.lives < gameState.maxLives && Math.random() < 0.85) {
    return 'manzana';
  }

  const curita = bot.powers.find(p => p.id === 'curita');
  if (curita && bot.lives <= 1 && Math.random() < 0.9) {
    return 'curita';
  }

  const esposas = bot.powers.find(p => p.id === 'esposas');
  if (esposas && !esposas.usedThisRound && player.lives > bot.lives + 1 && Math.random() < 0.55) {
    return 'esposas';
  }

  const doble = bot.powers.find(p => p.id === 'doble');
  if (doble && !bot.doubleDamage && realProb > 0.68 && Math.random() < 0.65) {
    return 'doble';
  }

  const escudo = bot.powers.find(p => p.id === 'escudo');
  if (escudo && !bot.shield && bot.lives <= 3 && realProb > 0.45 && Math.random() < 0.5) {
    return 'escudo';
  }

  const cambio = bot.powers.find(p => p.id === 'cambio');
  if (cambio && realProb > 0.5 && bot.lives <= 2 && Math.random() < 0.22) {
    return 'cambio';
  }

  const recarga = bot.powers.find(p => p.id === 'recarga');
  if (recarga && realProb > 0.7 && bot.lives <= 2 && Math.random() < 0.28) {
    return 'recarga';
  }

  return null;
}

function botThink(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
