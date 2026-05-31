const Casino = (() => {
  function bind() {
    const usernameEl = document.getElementById("casino-username");
    const user = Auth.user();

    if (usernameEl) {
      usernameEl.textContent = user?.username ? `@${user.username}` : "Jugador";
    }

    if (typeof CasinoCoins !== "undefined") {
      CasinoCoins.initializeCoins();
      CasinoCoins.renderCoinBalance(document);
      bindPlayButtons();
    }

    document.querySelectorAll("[data-casino-play-button]").forEach(button => {
      button.style.pointerEvents = "";
      button.removeAttribute("inert");
    });

    updateStats();
  }

  function bindPlayButtons() {
    document.querySelectorAll("[data-casino-play-button]").forEach(button => {
      if (button.dataset.coinsBound === "true") return;
      button.dataset.coinsBound = "true";
      button.addEventListener("click", event => {
        if (!CasinoCoins.canPlayCasinoGame()) {
          event.preventDefault();
          CasinoCoins.showNoCoinsMessage();
        }
      });
    });
  }

  function updateStats() {
    const coinsEl = document.getElementById("casinoMyCoins");
    const wonEl = document.getElementById("casinoGamesWon");
    const playedEl = document.getElementById("casinoGamesPlayed");

    if (coinsEl && typeof CasinoCoins !== "undefined") {
      coinsEl.textContent = CasinoCoins.getCoins();
    }

    if (typeof Profile !== "undefined") {
      const stats = Profile.getStats();
      if (wonEl) wonEl.textContent = stats.games || 0;
      if (playedEl) {
        const played = (stats.games || 0) + Math.floor(Math.random() * 5);
        playedEl.textContent = played;
      }
    }
  }

  return { bind };
})();
