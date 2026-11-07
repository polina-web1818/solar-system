// Главный экран: анимация Солнечной системы на canvas.
// Десктоп — наклонные эллиптические орбиты, телефон — планеты по диагонали.

const Hero = (function () {
  const canvas = document.getElementById('space');
  const ctx = canvas.getContext('2d');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Общая скорость анимации. 0,4 — в 2,5 раза медленнее первой версии:
  // по быстрым планетам было трудно попасть курсором
  const SPEED = reduceMotion ? 0.06 : 0.4;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let layout = null;     // геометрия: центр, наклон, радиусы орбит
  let sprites = [];      // готовые картинки планет
  let sunSprite = null;
  let stars = [];
  let asteroids = [];
  let time = 0;
  let lastFrame = 0;
  let running = false;

  // Наведение и клик: мышь, планета под ней и плавное увеличение
  let mouse = null;      // координаты курсора на canvas или null, если курсор ушёл
  let hovered = null;    // индекс планеты под курсором, 'sun' или null
  let targets = [];      // где в этом кадре нарисованы планеты и Солнце (для проверки попадания)
  const grow = PLANETS.map(() => 1); // текущий масштаб каждой планеты (1 = обычный)
  let sunGrow = 1;
  const HOVER_SCALE = 1.2;

  // Начальные углы планет на орбитах (каждый раз одинаковые)
  const rand = createRandom(2026);
  const startAngles = PLANETS.map(() => rand() * Math.PI * 2);

  // ---------- Расчёт раскладки под размер экрана ----------
  function computeLayout() {
    const mobile = width <= 700;

    if (!mobile) {
      const scale = Math.min(1.4, Math.max(0.6, width / 1440)) * 1.8;
      // Наклон и сжатие орбит — как на референсе references/5-desktop-orbits.png
      const tilt = -0.42;
      const ratio = 0.42;
      const sunR = 30 * scale;
      const rMin = sunR * 1.9;
      // Наклонённый эллипс радиуса 1 занимает halfW в стороны от центра и halfH вверх-вниз
      const halfW = Math.hypot(Math.cos(tilt), ratio * Math.sin(tilt));
      const halfH = Math.hypot(Math.sin(tilt), ratio * Math.cos(tilt));
      // Система занимает правые ~70% экрана (слева заголовок) и почти всю высоту
      const left = width * 0.28;
      const halfRoom = (width - 10 - left) / 2;   // половина ширины, отведённой под систему
      const cx = left + halfRoom;
      const cy = height * 0.48;
      // Орбиты распределены от rMin до rMax: доля f — насколько орбита близка к внешней
      const share = (i) => Math.pow(i / (PLANETS.length - 1), 0.9);
      // Для каждой планеты свой запас (её радиус с учётом увеличения при наведении):
      // на внешних орбитах маленькие Нептун и Плутон, им нужно меньше места.
      // Из условия «орбита i с планетой помещается» находим, каким может быть rMax
      let rMax = Infinity;
      PLANETS.forEach((p, i) => {
        if (i === 0) return;
        const pad = p.size * scale * 1.12 * HOVER_SCALE;
        const fit = Math.min(
          (halfRoom - pad) / halfW,                 // по бокам
          (cy - pad - 26) / halfH,                  // сверху (26 — место под подпись)
          (height - 84 - cy - pad) / halfH         // снизу (84 — надпись «Листай вниз»)
        );
        rMax = Math.min(rMax, rMin + (fit - rMin) / share(i));
      });
      return {
        mobile, scale, tilt, ratio, sunR, cx, cy,
        radii: PLANETS.map((_, i) => rMin + (rMax - rMin) * share(i))
      };
    }

    // Мобильная версия: Солнце в левом верхнем углу, планеты сверху вниз
    // по диагонали; нижняя часть экрана остаётся под заголовок
    const scale = Math.min(1.15, Math.max(0.8, width / 420)) * 1.25;
    const cx = -width * 0.1;
    const cy = -height * 0.05;
    const sunR = width * 0.36;
    const rMin = sunR * 1.45;
    // Плутон (последняя орбита) стоит слева, на 22% ширины. Его орбита должна
    // проходить выше заголовка: берём верх блока с текстом и отступаем вверх
    const textTop = document.querySelector('.hero__text').getBoundingClientRect().top -
      canvas.getBoundingClientRect().top;
    const plutoMaxY = textTop - 36;
    const rMax = Math.min(
      Math.hypot(width * 0.8 - cx, height * 0.55 - cy),
      Math.hypot(width * 0.22 - cx, plutoMaxY - cy)
    );
    return {
      mobile, scale, tilt: 0, ratio: 1, sunR, cx, cy,
      radii: PLANETS.map((_, i) => rMin + (rMax - rMin) * Math.pow(i / (PLANETS.length - 1), 0.95))
    };
  }

  // ---------- Подготовка: звёзды, астероиды, спрайты ----------
  function createStars() {
    const r = createRandom(5);
    const count = Math.round((width * height) / 2600);
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: r() * width,
        y: r() * height,
        size: 0.4 + r() * 1.1,
        alpha: 0.25 + r() * 0.6,
        twinkle: r() < 0.15 ? 1 + r() * 2 : 0,
        phase: r() * Math.PI * 2,
        sparkle: r() < 0.006 // редкие звёздочки-крестики
      });
    }
  }

  function createAsteroids() {
    const r = createRandom(9);
    asteroids = [];
    if (layout.mobile) return;
    const inner = layout.radii[3];
    const outer = layout.radii[4];
    for (let i = 0; i < 240; i++) {
      asteroids.push({
        radius: inner + (outer - inner) * (0.3 + r() * 0.4),
        angle: r() * Math.PI * 2,
        size: 0.6 + r() * 1.4,
        alpha: 0.3 + r() * 0.5
      });
    }
  }

  function createSprites() {
    // Спрайты рисуются с запасом по разрешению, чтобы были чёткими на Retina
    sprites = PLANETS.map((p) => {
      const r = p.size * layout.scale;
      return { r, image: createPlanetSprite(p, r * dpr * 1.15, dpr * 1.15) };
    });
    // На телефоне Солнце огромное и край «колючий» — рисуем его мягче
    sunSprite = createSunSprite(layout.sunR * dpr, { soft: layout.mobile });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    layout = computeLayout();
    createStars();
    createAsteroids();
    createSprites();
    draw();
  }

  // ---------- Геометрия ----------
  // Точка на орбите радиуса R при угле a (с учётом наклона)
  function orbitPoint(R, a) {
    const lx = Math.cos(a) * R;
    const ly = Math.sin(a) * R * layout.ratio;
    const cos = Math.cos(layout.tilt);
    const sin = Math.sin(layout.tilt);
    return {
      x: layout.cx + lx * cos - ly * sin,
      y: layout.cy + lx * sin + ly * cos
    };
  }

  // Текущий угол планеты i
  function planetAngle(i) {
    const p = PLANETS[i];
    const omega = 0.35 / Math.sqrt(p.period); // чем дальше планета, тем медленнее
    if (!layout.mobile) {
      return startAngles[i] + time * omega * SPEED;
    }
    // На телефоне планеты стоят «зигзагом» (то левее, то правее)
    // и слегка покачиваются вдоль своей орбиты
    const R = layout.radii[i];
    // у близких к Солнцу орбит радиус маленький — ограничиваем, чтобы планета не ушла за верх экрана
    const targetX = Math.min((i % 2 === 0 ? 0.22 : 0.72) * width, layout.cx + R * 0.8);
    const cosA = Math.min(1, Math.max(-1, (targetX - layout.cx) / R));
    return Math.acos(cosA) + Math.sin(time * omega * 2 * SPEED + i) * 0.03;
  }

  // ---------- Рисование ----------
  function drawStars() {
    for (const s of stars) {
      let a = s.alpha;
      if (s.twinkle) a *= 0.6 + 0.4 * Math.sin(time * s.twinkle + s.phase);
      ctx.fillStyle = `rgba(241, 228, 200, ${a})`;
      if (s.sparkle) {
        const l = 5;
        ctx.fillRect(s.x - l, s.y - 0.5, l * 2, 1);
        ctx.fillRect(s.x - 0.5, s.y - l, 1, l * 2);
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawOrbits() {
    layout.radii.forEach((R, i) => {
      const isPluto = PLANETS[i].dwarf;
      if (i === hovered) {
        // Орбита планеты под курсором — ярче и толще, горчичным цветом
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(227, 168, 59, 0.9)';
      } else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = isPluto ? 'rgba(241, 228, 200, 0.22)' : 'rgba(241, 228, 200, 0.32)';
      }
      ctx.setLineDash(isPluto ? [3, 6] : []);
      ctx.beginPath();
      ctx.ellipse(layout.cx, layout.cy, R, R * layout.ratio, layout.tilt, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  function drawAsteroids() {
    for (const a of asteroids) {
      const pt = orbitPoint(a.radius, a.angle + time * 0.012 * SPEED);
      ctx.fillStyle = `rgba(241, 228, 200, ${a.alpha})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, a.size * layout.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSun() {
    const size = (sunSprite.width / dpr) * sunGrow;
    ctx.save();
    ctx.translate(layout.cx, layout.cy);
    ctx.rotate(time * 0.02 * SPEED); // медленное вращение «мазков»
    ctx.drawImage(sunSprite, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  // ---------- Подписи ----------
  // Где можно поставить подпись относительно планеты: dx, dy — направление
  // выноски (вправо-вверх, влево-вверх, вправо-вниз, влево-вниз), len — её длина
  const LABEL_SPOTS = [
    { dx: 1, dy: -1, len: 8 }, { dx: -1, dy: -1, len: 8 },
    { dx: 1, dy: 1, len: 8 }, { dx: -1, dy: 1, len: 8 },
    { dx: 1, dy: -1, len: 22 }, { dx: -1, dy: -1, len: 22 },
    { dx: 1, dy: 1, len: 22 }, { dx: -1, dy: 1, len: 22 }
  ];
  const lastSpot = {}; // какое место подпись занимала в прошлом кадре (чтобы не прыгала)

  function labelFont() {
    const fontSize = Math.round(Math.max(9, 10 * Math.min(layout.scale / 1.5, 1.15)));
    return { size: fontSize, css: `300 ${fontSize}px Oswald, sans-serif` };
  }

  // Прямоугольник подписи и точки выноски для варианта места spot
  function labelBox(label, spot, font) {
    const sx = label.x + spot.dx * label.r * 0.72;
    const sy = label.y + spot.dy * label.r * 0.72;
    const ex = sx + spot.dx * spot.len;
    const ey = sy + spot.dy * spot.len;
    const w = label.width;
    const h = font.size;
    const bx = spot.dx > 0 ? ex + 3 : ex - 3 - w;
    const by = spot.dy < 0 ? ey - h - 1 : ey + 1;
    return { sx, sy, ex, ey, x: bx, y: by, w, h };
  }

  // Пересекается ли прямоугольник с кругом: ближайшая к центру круга точка
  // прямоугольника должна быть дальше радиуса
  function rectHitsCircle(b, c) {
    const nx = Math.max(b.x, Math.min(c.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(c.y, b.y + b.h));
    return Math.hypot(nx - c.x, ny - c.y) < c.r + 2;
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w + 4 && b.x < a.x + a.w + 4 && a.y < b.y + b.h + 2 && b.y < a.y + a.h + 2;
  }

  // Для каждой подписи пробуем места по очереди и берём первое, где она
  // не вылезает за экран и не задевает планеты, Солнце и уже поставленные подписи
  function placeLabels(labels, circles) {
    const font = labelFont();
    ctx.font = font.css;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
    const placed = [];
    labels.forEach((label) => {
      label.width = ctx.measureText(label.text).width;
      const order = lastSpot[label.text] !== undefined
        ? [lastSpot[label.text], ...LABEL_SPOTS.keys()]
        : [...LABEL_SPOTS.keys()];
      let chosen = null;
      for (const index of order) {
        const box = labelBox(label, LABEL_SPOTS[index], font);
        const inside = box.x > 4 && box.y > 4 && box.x + box.w < width - 4 && box.y + box.h < height - 4;
        const free = inside &&
          !placed.some((other) => rectsOverlap(box, other)) &&
          !circles.some((c) => c.id !== label.id && rectHitsCircle(box, c));
        if (free) {
          chosen = { box, index };
          break;
        }
      }
      // Если свободного места нет совсем — ставим на привычное место (лучше, чем не показать)
      if (!chosen) chosen = { box: labelBox(label, LABEL_SPOTS[order[0]], font), index: order[0] };
      lastSpot[label.text] = chosen.index;
      label.box = chosen.box;
      placed.push(chosen.box);
    });
    return font;
  }

  function drawLabels(labels, circles) {
    const font = placeLabels(labels, circles);
    ctx.textBaseline = 'top';
    labels.forEach((label) => {
      const b = label.box;
      // Тонкая выноска от планеты к подписи
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(241, 228, 200, 0.35)';
      ctx.beginPath();
      ctx.moveTo(b.sx, b.sy);
      ctx.lineTo(b.ex, b.ey);
      ctx.stroke();
      // Тёмная обводка цвета фона под буквами — подпись читается даже поверх Солнца
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(15, 27, 45, 0.8)';
      ctx.strokeText(label.text, b.x, b.y);
      ctx.fillStyle = label.active ? '#e3a83b' : 'rgba(241, 228, 200, 0.78)';
      ctx.fillText(label.text, b.x, b.y);
    });
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    return font;
  }


  // ---------- Наведение: какая планета под точкой (x, y)? ----------
  // Планета — круг. Точка внутри круга, если расстояние от неё до центра
  // меньше радиуса. Расстояние считаем по теореме Пифагора (Math.hypot).
  // extra — запас в пикселях: маленькие планеты трудно «поймать», особенно пальцем.
  function pickTarget(x, y, extra) {
    // Проверяем с конца: последними нарисованы ближние планеты, они «сверху»
    for (let j = targets.length - 1; j >= 0; j--) {
      const t = targets[j];
      const distance = Math.hypot(x - t.x, y - t.y);
      if (distance < Math.max(t.r, 10) + extra) return t.id;
    }
    return null;
  }

  // Плавно приближаем масштаб к цели: каждый кадр проходим 20% оставшегося пути
  function approach(current, target) {
    return reduceMotion ? target : current + (target - current) * 0.2;
  }

  function draw() {
    if (!layout) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Собираем объекты и сортируем по глубине: дальние рисуем первыми
    const items = PLANETS.map((p, i) => {
      const a = planetAngle(i);
      const pt = orbitPoint(layout.radii[i], a);
      const depth = layout.mobile ? 0 : Math.sin(a);
      const k = layout.mobile ? 1 : 1 + 0.12 * depth; // ближе — крупнее
      return { i, p, x: pt.x, y: pt.y, depth, k };
    });
    items.push({ sun: true, depth: 0.0001 });
    items.sort((a, b) => a.depth - b.depth);

    // Запоминаем, где что нарисовано, и проверяем, что сейчас под курсором.
    // Проверка каждый кадр: планеты движутся и могут «уехать» из-под курсора
    targets = items.map((it) => it.sun
      ? { id: 'sun', x: layout.cx, y: layout.cy, r: layout.sunR * 0.95 * sunGrow }
      : { id: it.i, x: it.x, y: it.y, r: sprites[it.i].r * it.k * grow[it.i] });
    hovered = mouse ? pickTarget(mouse.x, mouse.y, 4) : null;
    canvas.style.cursor = hovered === null ? '' : 'pointer';

    PLANETS.forEach((_, i) => { grow[i] = approach(grow[i], hovered === i ? HOVER_SCALE : 1); });
    sunGrow = approach(sunGrow, hovered === 'sun' ? 1.05 : 1);

    drawStars();
    drawOrbits();
    drawAsteroids();

    const labels = [];
    for (const it of items) {
      if (it.sun) {
        drawSun();
        continue;
      }
      const sprite = sprites[it.i];
      const k = it.k * grow[it.i];
      const size = (sprite.image.width / dpr / 1.15) * k;
      ctx.drawImage(sprite.image, it.x - size / 2, it.y - size / 2, size, size);
      labels.push({ id: it.i, text: it.p.name.toUpperCase(), x: it.x, y: it.y, r: sprite.r * k, active: hovered === it.i });
    }
    // Подписи — отдельным проходом, после всех планет и Солнца, чтобы их ничего
    // не перекрывало. Подпись планеты под курсором ставим первой — ей лучшее место
    labels.sort((a, b) => b.active - a.active);
    // У Сатурна кольца шире планеты — для подписей считаем его кругом побольше
    const obstacles = targets.map((t) => (t.id !== 'sun' && PLANETS[t.id].ring ? { ...t, r: t.r * 1.7 } : t));
    drawLabels(labels, obstacles);
  }

  // ---------- Мышь и пальцы ----------
  // Координаты события относительно левого верхнего угла canvas
  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function goToSection(target) {
    const id = target === 'sun' ? SUN.id : PLANETS[target].id;
    mouse = null; // страница уедет, курсор окажется уже не над главным экраном
    document.getElementById(id).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function bindPointer() {
    canvas.addEventListener('pointermove', (event) => {
      // На телефоне наведения нет — подсветку по движению пальца не включаем
      if (event.pointerType === 'mouse') mouse = pointerPosition(event);
    });
    canvas.addEventListener('pointerleave', () => { mouse = null; });

    // Клик мышью и тап пальцем приходят одним событием click
    let lastPointerType = 'mouse';
    canvas.addEventListener('pointerdown', (event) => { lastPointerType = event.pointerType; });
    canvas.addEventListener('click', (event) => {
      const pos = pointerPosition(event);
      // Палец толще курсора, поэтому для тапа запас попадания больше
      const target = pickTarget(pos.x, pos.y, lastPointerType === 'mouse' ? 4 : 16);
      if (target !== null) goToSection(target);
    });
  }

  // ---------- Анимационный цикл ----------
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0);
    lastFrame = now;
    // Пока курсор над планетой или Солнцем, система стоит на паузе —
    // время просто не идёт, и все планеты замирают на месте
    if (hovered === null) time += dt;
    draw();
    requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    lastFrame = performance.now();
    requestAnimationFrame(frame);
  }

  function stop() {
    running = false;
  }

  function init() {
    resize();
    window.addEventListener('resize', resize);
    bindPointer();

    // Анимация работает, только пока главный экран виден — экономим батарею
    const observer = new IntersectionObserver((entries) => {
      entries[0].isIntersecting ? start() : stop();
    });
    observer.observe(canvas);

    // Когда шрифты загрузятся — перерисовать подписи
    if (document.fonts) document.fonts.ready.then(draw);
  }

  return { init };
})();
