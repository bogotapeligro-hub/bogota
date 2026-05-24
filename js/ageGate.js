const AgeGate = (() => {
  function isConfirmed() {
    return localStorage.getItem(APP_CONFIG.ageGateKey) === "true";
  }

  function confirm() {
    localStorage.setItem(APP_CONFIG.ageGateKey, "true");
    render();
  }

  function deny() {
    localStorage.setItem(APP_CONFIG.ageGateKey, "false");
    const root = document.getElementById("ageGateRoot");
    root.innerHTML = `
      <div class="age-lock-screen">
        <div class="age-card denied">
          <span class="badge-alert">Acceso bloqueado</span>
          <h1>Este sitio es solo para mayores de 18 años.</h1>
          <p>No se permite el acceso a menores de edad. Esta barrera es una confirmación básica, no una verificación legal real.</p>
        </div>
      </div>
    `;
  }

  function render() {
    const root = document.getElementById("ageGateRoot");
    if (!root) return;

    if (isConfirmed()) {
      root.innerHTML = "";
      document.body.classList.remove("age-gated");
      return;
    }

    if (localStorage.getItem(APP_CONFIG.ageGateKey) === "false") {
      deny();
      return;
    }

    document.body.classList.add("age-gated");
    root.innerHTML = `
      <div class="age-modal-backdrop">
        <section class="age-card" role="dialog" aria-modal="true" aria-labelledby="ageTitle">
          <span class="badge-alert">18+ / contenido urbano sensible</span>
          <h1 id="ageTitle">¿Confirmas que tienes 18 años o más?</h1>
          <p>Esta plataforma puede contener reportes ciudadanos sobre emergencias, conflictos en vía pública, movilidad y situaciones sensibles. No se permite contenido relacionado con menores en situación vulnerable.</p>
          <div class="age-actions">
            <button class="warning-btn" id="confirmAgeBtn">Sí, tengo 18+</button>
            <button class="ghost-btn" id="denyAgeBtn">No soy mayor de edad</button>
          </div>
          <p class="muted small">Para pruebas: ejecuta <code>localStorage.removeItem('${APP_CONFIG.ageGateKey}')</code> en consola.</p>
        </section>
      </div>
    `;
    document.getElementById("confirmAgeBtn")?.addEventListener("click", confirm);
    document.getElementById("denyAgeBtn")?.addEventListener("click", deny);
  }

  document.addEventListener("DOMContentLoaded", render);

  return { isConfirmed, confirm, deny, render };
})();
