// Разделы планет под главным экраном: Солнце → Меркурий … → Нептун → Плутон.
// Разметка создаётся из данных (SUN и PLANETS), а большие планеты рисуются
// теми же функциями из planet-art.js, что и на главном экране.

const Sections = (function () {
  const container = document.getElementById('journey');
  const bodies = [SUN, ...PLANETS];   // порядок разделов
  let lastWidth = 0;

  // ---------- Разметка ----------
  function createSection(body, index) {
    const number = String(index).padStart(2, '0'); // 0 → «00», 3 → «03»
    const section = document.createElement('section');
    section.className = 'planet-section';
    section.id = body.id;
    // Цвет планеты становится акцентом раздела (номера фактов, подчёркивание)
    section.style.setProperty('--accent', body.base);

    const badge = body.dwarf
      ? '<p class="planet-section__badge">Бывшая планета · с 2006 года — карликовая</p>'
      : '';
    const facts = body.facts.map((fact) => `<li>${fact}</li>`).join('');

    section.innerHTML = `
      <div class="planet-section__art">
        <span class="planet-section__number" aria-hidden="true">${number}</span>
      </div>
      <div class="planet-section__info">
        <p class="planet-section__kicker">${number} · ${body.kind}</p>
        <h2 class="planet-section__title">${body.name}</h2>
        ${badge}
        <p class="planet-section__lead">${body.lead}</p>
        <ol class="planet-section__facts">${facts}</ol>
      </div>
    `;
    return section;
  }

  // ---------- Рисунки планет ----------
  // Базовый радиус зависит от размера окна
  function baseRadius() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w <= 700) return Math.min(w / 3.6, 110);
    return Math.max(80, Math.min(w * 0.45 / 2.5, h * 0.3, 210));
  }

  // Радиус конкретного тела: крупные планеты больше, мелкие меньше
  // (масштаб условный, иначе Юпитер не влез бы на экран, а Плутон был бы точкой)
  function radiusFor(body, maxR) {
    if (body === SUN) return maxR * 1.1;
    let r = maxR * (0.5 + 0.5 * body.size / 27);
    if (body.ring) r *= 0.7; // кольца Сатурна широкие — уменьшаем, чтобы влезли
    return r;
  }

  function drawArt() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxR = baseRadius();

    bodies.forEach((body) => {
      const art = document.querySelector(`#${body.id} .planet-section__art`);
      const r = radiusFor(body, maxR);
      // Рисуем с запасом по разрешению (dpr), чтобы на Retina было чётко
      const sprite = body === SUN ? createSunSprite(r * dpr) : createPlanetSprite(body, r * dpr, dpr);
      sprite.className = 'planet-section__canvas';
      sprite.style.width = `${sprite.width / dpr}px`;
      // У Солнца (свечение) и Сатурна (запас под кольца) вокруг рисунка много
      // прозрачного места. Отрицательный отступ сверху и снизу не даёт ему
      // раздувать высоту раздела — иначе на телефоне раздел не влезает в экран
      const trim = body === SUN ? r * 0.5 : body.ring ? r * 1.1 : 0;
      sprite.style.margin = `${-trim}px 0`;
      sprite.setAttribute('role', 'img');
      sprite.setAttribute('aria-label', body.name);

      const old = art.querySelector('canvas');
      if (old) old.replaceWith(sprite);
      else art.appendChild(sprite);
    });
  }

  // Перерисовываем только при изменении ширины окна и не чаще раза в 200 мс:
  // на телефоне высота «прыгает» при прокрутке из-за адресной строки
  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      drawArt();
    }, 200);
  }

  function init() {
    bodies.forEach((body, i) => container.appendChild(createSection(body, i)));
    lastWidth = window.innerWidth;
    drawArt();
    window.addEventListener('resize', onResize);
  }

  return { init };
})();
