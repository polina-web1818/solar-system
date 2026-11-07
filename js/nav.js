// Навигация точками справа: одна точка на каждое тело (Солнце … Плутон).
// Активный раздел определяется через IntersectionObserver — браузер сам
// сообщает, какой раздел сейчас пересекает середину экрана.

const Nav = (function () {
  const bodies = [SUN, ...PLANETS];
  let nav = null;
  let links = {}; // id раздела → ссылка-точка

  function createNav() {
    nav = document.createElement('nav');
    nav.className = 'dots';
    nav.setAttribute('aria-label', 'Разделы');

    bodies.forEach((body) => {
      const link = document.createElement('a');
      link.className = 'dots__link';
      link.href = `#${body.id}`; // клик = переход к разделу (плавность даёт CSS)
      link.style.setProperty('--accent', body.base);
      link.innerHTML = `<span class="dots__label">${body.name}</span>`;
      links[body.id] = link;
      nav.appendChild(link);
    });

    document.body.appendChild(nav);
  }

  function setActive(id) {
    for (const key in links) {
      const isActive = key === id;
      links[key].classList.toggle('is-active', isActive);
      if (isActive) links[key].setAttribute('aria-current', 'true');
      else links[key].removeAttribute('aria-current');
    }
  }

  function watchSections() {
    // rootMargin сужает «зону наблюдения» до тонкой полоски (1% высоты)
    // посередине экрана: срабатывает тот раздел, который её пересекает.
    // Так ровно один раздел активен, даже если он выше экрана.
    // Полоска, а не линия нулевой высоты: с нулевой браузеры работают ненадёжно.
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        // На главном экране точки прячем, в разделах — показываем
        nav.classList.toggle('is-visible', id !== 'hero');
        if (id !== 'hero') setActive(id);
      });
    }, { rootMargin: '-49.5% 0px -49.5% 0px' });

    observer.observe(document.getElementById('hero'));
    bodies.forEach((body) => observer.observe(document.getElementById(body.id)));
  }

  function init() {
    createNav();
    watchSections();
  }

  return { init };
})();
