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
      if (typeof CasinoMiniGames !== "undefined") CasinoMiniGames.render();
    }
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

  return { bind };
})();
