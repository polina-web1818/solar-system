// Калькулятор «Сколько лететь»: выбираешь планету и транспорт кнопками,
// результат считается сразу. Время = расстояние / скорость.

const Travel = (function () {
  const KM_IN_AU = 149597870.7;          // километров в 1 астрономической единице
  const HOURS_IN_YEAR = 365.25 * 24;
  const HUMAN_LIFE_YEARS = 73;           // средняя продолжительность жизни в мире

  // Транспорт по возрастанию скорости (км/ч).
  // how — начало фразы под результатом; «без остановок» — только там, где это звучит естественно
  const TRANSPORTS = [
    { id: 'walk', name: 'Пешком', how: 'Пешком без остановок', speed: 5, label: '5 км/ч' },
    { id: 'bike', name: 'Велосипед', how: 'На велосипеде без остановок', speed: 20, label: '20 км/ч' },
    { id: 'car', name: 'Машина', how: 'На машине без остановок', speed: 100, label: '100 км/ч' },
    { id: 'helicopter', name: 'Вертолёт', how: 'На вертолёте без остановок', speed: 250, label: '250 км/ч' },
    { id: 'plane', name: 'Самолёт', how: 'На самолёте без остановок', speed: 900, label: '900 км/ч' },
    // Солнечный зонд «Паркер» — самый быстрый аппарат, созданный людьми
    { id: 'rocket', name: 'Ракета', how: 'Со скоростью зонда «Паркер»', speed: 690000, label: '690 000 км/ч' },
    { id: 'light', name: 'Свет', how: 'Со скоростью света', speed: 299792.458 * 3600, label: '300 000 км/с' }
  ];

  // Единицы времени от мелких к крупным: сколько в них часов и до какого числа
  // ими удобно пользоваться (дальше переходим к следующей единице)
  const UNITS = [
    { hours: 1 / 3600, limit: 60, forms: ['секунда', 'секунды', 'секунд'] },
    { hours: 1 / 60, limit: 60, forms: ['минута', 'минуты', 'минут'] },
    { hours: 1, limit: 48, forms: ['час', 'часа', 'часов'] },
    { hours: 24, limit: 365, forms: ['день', 'дня', 'дней'] },
    { hours: HOURS_IN_YEAR, limit: 1000, forms: ['год', 'года', 'лет'] },
    { hours: HOURS_IN_YEAR * 1e3, limit: 1000, forms: ['тысяча лет', 'тысячи лет', 'тысяч лет'] },
    { hours: HOURS_IN_YEAR * 1e6, limit: Infinity, forms: ['миллион лет', 'миллиона лет', 'миллионов лет'] }
  ];

  const bodies = [SUN, ...PLANETS];
  const state = { target: 'mars', transport: 'car' }; // что выбрано сейчас
  const el = {};

  // ---------- Числа и слова ----------
  // Меньше 10 — с одним знаком после запятой (2,5), больше — целым (85)
  function roundNice(value) {
    return value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  }

  function formatNumber(value) {
    return value.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  }

  // forms: [1 минута, 2 минуты, 5 минут]; дробное число — всегда вторая форма (2,5 минуты)
  function plural(value, forms) {
    if (!Number.isInteger(value)) return forms[1];
    const n10 = value % 10;
    const n100 = value % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
    return forms[2];
  }

  // Подбор единиц: идём от секунд к миллионам лет и берём первую единицу,
  // в которой число получается «удобным» (меньше её предела)
  function humanTime(hours) {
    for (const unit of UNITS) {
      const value = roundNice(hours / unit.hours);
      if (value < unit.limit) return `≈\u00a0${formatNumber(value)}\u00a0${plural(value, unit.forms)}`;
    }
  }

  function humanDistance(km) {
    // \u00a0 — неразрывный пробел: число и «млн км» не разорвутся переносом строки
    if (km >= 1e9) return `${formatNumber(roundNice(km / 1e9))}\u00a0млрд\u00a0км`;
    return `${formatNumber(Math.round(km / 1e6))}\u00a0млн\u00a0км`;
  }

  // ---------- Кнопки-чипсы ----------
  function createChip(group, id, html, color) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.dataset.id = id;
    if (color) button.style.setProperty('--accent', color);
    button.innerHTML = html;
    button.addEventListener('click', () => {
      state[group] = id;
      update();
    });
    return button;
  }

  function createChips() {
    el.targets = bodies.map((body) => createChip('target', body.id,
      `<span class="chip__dot"></span>${body.name}`, body.base));
    el.targets.forEach((chip) => document.getElementById('travel-targets').appendChild(chip));

    el.transports = TRANSPORTS.map((t) => createChip('transport', t.id,
      `${t.name}<span class="chip__hint">${t.label}</span>`));
    el.transports.forEach((chip) => document.getElementById('travel-transports').appendChild(chip));
  }

  // aria-pressed="true" — «кнопка нажата»: по нему и CSS подсвечивает выбранную
  function markSelected(chips, selectedId) {
    chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.id === selectedId)));
  }

  // ---------- Анимация полёта ----------
  // Скорость анимации условная: чем дольше настоящий полёт, тем медленнее точка.
  // Берём логарифм (сколько цифр в числе часов), иначе свет мелькал бы,
  // а пешеход шёл бы миллион лет
  function flightDuration(hours) {
    const seconds = 0.8 + 0.45 * Math.log10(Math.max(hours, 1));
    return Math.min(6, seconds);
  }

  function restartFlight(seconds) {
    const ship = el.ship;
    ship.style.setProperty('--flight', `${seconds}s`);
    // Чтобы анимация началась заново: выключаем, заставляем браузер это «заметить»
    // (чтение offsetWidth пересчитывает страницу) и включаем обратно
    ship.classList.remove('is-flying');
    void ship.offsetWidth;
    ship.classList.add('is-flying');
  }

  // ---------- Пересчёт ----------
  function update() {
    markSelected(el.targets, state.target);
    markSelected(el.transports, state.transport);

    const body = bodies.find((b) => b.id === state.target);
    const transport = TRANSPORTS.find((t) => t.id === state.transport);

    el.targetDot.style.setProperty('--accent', body.base);
    el.targetDot.classList.toggle('is-sun', body === SUN);
    el.targetName.textContent = body.name;

    if (body.id === 'earth') {
      el.time.textContent = 'Ты уже на месте!';
      el.details.textContent = 'Чтобы попасть на Землю, никуда лететь не нужно — достаточно посмотреть под ноги.';
      el.lives.textContent = '';
      el.ship.classList.remove('is-flying');
      return;
    }

    const km = body.distanceAU * KM_IN_AU;
    const hours = km / transport.speed;       // время = расстояние / скорость
    const years = hours / HOURS_IN_YEAR;

    el.time.textContent = humanTime(hours);
    // \u2060 после «/» — невидимый символ, который запрещает перенос «км/ ч»
    const speed = transport.label.replace('/', '/\u2060');
    el.details.textContent = `${transport.how} (${speed}) · расстояние ≈\u00a0${humanDistance(km)}`;

    if (years > 100) {
      const lives = roundNice(years / HUMAN_LIFE_YEARS);
      el.lives.textContent = `Это примерно ${formatNumber(lives)} ${plural(lives, ['жизнь', 'жизни', 'жизней'])} человека (по ${HUMAN_LIFE_YEARS} года).`;
    } else {
      el.lives.textContent = '';
    }

    restartFlight(flightDuration(hours));
  }

  function init() {
    el.time = document.getElementById('travel-time');
    el.details = document.getElementById('travel-details');
    el.lives = document.getElementById('travel-lives');
    el.ship = document.getElementById('travel-ship');
    el.targetDot = document.getElementById('travel-target-dot');
    el.targetName = document.getElementById('travel-target-name');
    createChips();
    update();
  }

  return { init };
})();
