// Главный экран: анимация Солнечной системы на canvas.
// Десктоп — наклонные эллиптические орбиты, телефон — планеты по диагонали.

const Hero = (function () {
  const canvas = document.getElementById('space');
  const ctx = canvas.getContext('2d');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPEED = reduceMotion ? 0.15 : 1;

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
      const scale = Math.min(1.4, Math.max(0.6, width / 1440)) * 1.5;
      const tilt = -0.28;
      const ratio = 0.34;
      const sunR = 30 * scale;
      const rMin = sunR * 1.9;
      const rMax = Math.min(width * 0.55, height * 1.1);
      return {
        mobile, scale, tilt, ratio, sunR,
        cx: width * 0.6,
        cy: height * 0.56,
        radii: PLANETS.map((_, i) => rMin + (rMax - rMin) * Math.pow(i / (PLANETS.length - 1), 0.9))
      };
    }

    // Мобильная версия: Солнце в левом верхнем углу, планеты сверху вниз
    // по диагонали; нижняя часть экрана остаётся под заголовок
    const scale = Math.min(1.15, Math.max(0.8, width / 420)) * 1.25;
    const cx = -width * 0.1;
    const cy = -height * 0.05;
    const sunR = width * 0.36;
    const rMin = sunR * 1.45;
    const rMax = Math.hypot(width * 0.8 - cx, height * 0.55 - cy);
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
    sunSprite = createSunSprite(layout.sunR * dpr);
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

  function drawLabel(name, x, y, r, active) {
    const fontSize = Math.round(Math.max(10, 11 * Math.min(layout.scale, 1.2)));
    ctx.font = `500 ${fontSize}px Oswald, sans-serif`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    ctx.fillStyle = active ? '#e3a83b' : 'rgba(241, 228, 200, 0.9)';
    ctx.strokeStyle = 'rgba(241, 228, 200, 0.45)';
    // Короткая линия-выноска от планеты к подписи.
    // Если справа не хватает места — подпись уходит влево.
    const text = name.toUpperCase();
    const textWidth = ctx.measureText(text).width;
    const flip = x + r + textWidth + 30 > width;
    const dir = flip ? -1 : 1;
    const sx = x + dir * r * 0.75;
    const sy = y - r * 0.75;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + dir * 10, sy - 10);
    ctx.stroke();
    ctx.textAlign = flip ? 'right' : 'left';
    ctx.fillText(text, sx + dir * 13, sy - 12);
    ctx.textAlign = 'left';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
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

    for (const it of items) {
      if (it.sun) {
        drawSun();
        continue;
      }
      const sprite = sprites[it.i];
      const k = it.k * grow[it.i];
      const size = (sprite.image.width / dpr / 1.15) * k;
      ctx.drawImage(sprite.image, it.x - size / 2, it.y - size / 2, size, size);
      drawLabel(it.p.name, it.x, it.y, sprite.r * k, hovered === it.i);
    }
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
    time += dt;
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
