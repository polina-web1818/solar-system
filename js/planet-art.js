// Рисование планет в ретро-стиле. Каждая планета рисуется один раз
// на отдельный невидимый canvas («спрайт»), а потом просто копируется
// на главный экран в каждом кадре — так анимация работает быстро.

// Генератор псевдослучайных чисел с «зерном» (seed):
// при одном и том же seed узор планеты всегда одинаковый.
function createRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Мазок «кистью»: волнистая полоса поперёк планеты
function brushStroke(ctx, rand, r, y, thickness, color, tilt) {
  ctx.save();
  ctx.rotate(tilt);
  ctx.fillStyle = color;
  ctx.beginPath();
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const x = -r * 1.2 + (i / steps) * r * 2.4;
    const wobble = (rand() - 0.5) * thickness * 0.6;
    if (i === 0) ctx.moveTo(x, y + wobble);
    else ctx.lineTo(x, y + wobble);
  }
  for (let i = steps; i >= 0; i--) {
    const x = -r * 1.2 + (i / steps) * r * 2.4;
    const wobble = (rand() - 0.5) * thickness * 0.6;
    ctx.lineTo(x, y + thickness + wobble);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Неровное пятно (материк, кратер)
function blob(ctx, rand, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const points = 9;
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const d = size * (0.6 + rand() * 0.5);
    const px = x + Math.cos(a) * d;
    const py = y + Math.sin(a) * d;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// Рисует узор поверхности в зависимости от типа планеты
function drawSurface(ctx, p, r, rand) {
  const [c1, c2, c3] = p.stripes;

  if (p.type === 'gas') {
    // Газовый гигант: много диагональных полос кистью
    for (let i = 0; i < 14; i++) {
      const y = -r + rand() * r * 2;
      const color = [c1, c2, c3 || c1][i % 3];
      ctx.globalAlpha = 0.55 + rand() * 0.4;
      brushStroke(ctx, rand, r, y, r * (0.04 + rand() * 0.12), color, -0.25);
    }
    ctx.globalAlpha = 1;
    if (p.spot) {
      // Большое красное пятно Юпитера
      ctx.fillStyle = '#f1e4c8';
      ctx.beginPath();
      ctx.ellipse(r * 0.25, r * 0.45, r * 0.2, r * 0.1, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a83526';
      ctx.beginPath();
      ctx.ellipse(r * 0.25, r * 0.45, r * 0.12, r * 0.055, -0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (p.type === 'swirl') {
    // Венера: крупные завитки облаков
    for (let i = 0; i < 5; i++) {
      blob(ctx, rand, (rand() - 0.5) * r * 1.4, (rand() - 0.5) * r * 1.4, r * (0.2 + rand() * 0.25), i % 2 ? c1 : c2);
    }
  }

  if (p.type === 'earth') {
    // Земля: светлые материки на голубом
    for (let i = 0; i < 4; i++) {
      blob(ctx, rand, (rand() - 0.5) * r * 1.3, (rand() - 0.5) * r * 1.3, r * (0.22 + rand() * 0.22), c1);
    }
  }

  if (p.type === 'rocky') {
    // Каменистые планеты: россыпь кратеров и пятен
    for (let i = 0; i < 22; i++) {
      ctx.globalAlpha = 0.5 + rand() * 0.5;
      blob(ctx, rand, (rand() - 0.5) * r * 2, (rand() - 0.5) * r * 2, r * (0.05 + rand() * 0.12), rand() > 0.5 ? c1 : c2);
    }
    ctx.globalAlpha = 1;
  }

  if (p.type === 'plain') {
    // Уран: почти гладкий, с мягкой светлой полосой
    ctx.globalAlpha = 0.6;
    brushStroke(ctx, rand, r, -r * 0.5, r * 0.25, c1, -0.1);
    ctx.globalAlpha = 1;
  }

  if (p.type === 'streak') {
    // Нептун: светлые штрихи ветров
    ctx.strokeStyle = c1;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      ctx.lineWidth = r * (0.04 + rand() * 0.06);
      ctx.beginPath();
      const y = (rand() - 0.5) * r * 1.2;
      ctx.moveTo(-r * 0.5 + rand() * r * 0.3, y);
      ctx.lineTo(r * 0.1 + rand() * r * 0.5, y - r * 0.25);
      ctx.stroke();
    }
  }
}

// Полутоновые точки в тени — как в старой типографской печати.
// pixelRatio — во сколько раз спрайт крупнее экранных пикселей.
// Шаг сетки не больше ~4,5 экранных px: на больших планетах точки остаются
// мелкой текстурой, а у маленьких шаг по-прежнему зависит от радиуса.
function drawHalftone(ctx, r, pixelRatio) {
  const step = Math.max(2, Math.min(r * 0.13, 4.5 * pixelRatio));
  ctx.fillStyle = 'rgba(15, 27, 45, 0.35)';
  for (let x = -r; x <= r; x += step) {
    for (let y = -r; y <= r; y += step) {
      // Чем дальше к правому нижнему краю, тем крупнее точка
      const k = (x + y) / (r * 2) + 0.15;
      if (k <= 0) continue;
      ctx.beginPath();
      ctx.arc(x, y, step * 0.38 * Math.min(1, k * 1.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Кольцо Сатурна (рисуется в повёрнутой системе координат)
function drawRing(ctx, r, color, onlyFront) {
  ctx.save();
  ctx.rotate(-0.38);
  if (onlyFront) {
    ctx.beginPath();
    ctx.rect(-r * 3, 0, r * 6, r * 3);
    ctx.clip();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.9, r * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(15, 27, 45, 0.5)';
  ctx.lineWidth = r * 0.03;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.75, r * 0.44, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Главная функция: создаёт спрайт планеты радиусом r пикселей.
// pixelRatio — запас по разрешению, с которым спрайт рисуется (обычно dpr)
function createPlanetSprite(p, r, pixelRatio = 1) {
  const pad = p.ring ? 2.2 : 1.15;
  const size = Math.ceil(r * 2 * pad);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = createRandom(p.seed);

  ctx.translate(size / 2, size / 2);

  if (p.ring) drawRing(ctx, r, p.ring, false);

  // Тело планеты — всё рисуется внутри круга (clip)
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = p.base;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  drawSurface(ctx, p, r, rand);

  // Тень-полумесяц справа снизу
  ctx.fillStyle = 'rgba(15, 27, 45, 0.38)';
  ctx.beginPath();
  ctx.rect(-r, -r, r * 2, r * 2);
  ctx.arc(-r * 0.2, -r * 0.2, r * 1.02, 0, Math.PI * 2, true);
  ctx.fill('evenodd');

  drawHalftone(ctx, r, pixelRatio);
  ctx.restore();

  // Тонкий контур цвета фона, как обводка на постере.
  // Непрозрачный — иначе поверх светлой планеты получается серый ободок
  ctx.strokeStyle = '#0f1b2d';
  ctx.lineWidth = Math.max(1, Math.min(r * 0.07, 2 * pixelRatio));
  ctx.beginPath();
  ctx.arc(0, 0, r - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();

  if (p.ring) drawRing(ctx, r, p.ring, true);

  return canvas;
}

// Солнце: светлая сердцевина и рваный «мазками» край
// options.soft — мягкий край: без штрихов наружу (для огромного Солнца на телефоне)
function createSunSprite(r, options = {}) {
  const soft = Boolean(options.soft);
  const size = Math.ceil(r * 3.2);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = createRandom(7);
  ctx.translate(size / 2, size / 2);

  // Мягкое свечение
  const glow = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.6);
  glow.addColorStop(0, 'rgba(232, 134, 42, 0.35)');
  glow.addColorStop(1, 'rgba(232, 134, 42, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-size / 2, -size / 2, size, size);

  if (soft) {
    // Мягкая оранжевая кайма вместо острых штрихов
    const rim = ctx.createRadialGradient(0, 0, r * 0.9, 0, 0, r * 1.06);
    rim.addColorStop(0, 'rgba(217, 87, 62, 0.9)');
    rim.addColorStop(1, 'rgba(217, 87, 62, 0)');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.06, 0, Math.PI * 2);
    ctx.fill();
  }

  // Рваный край из мазков «кистью»: дуги вдоль края с круглыми концами
  const colors = ['#c2412d', '#d9573e', '#e8862a'];
  ctx.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const a = rand() * Math.PI * 2;
    ctx.strokeStyle = colors[Math.floor(rand() * colors.length)];
    ctx.globalAlpha = 0.55 + rand() * 0.45;
    ctx.lineWidth = r * (0.012 + rand() * 0.025);
    ctx.beginPath();
    ctx.arc(0, 0, r * (0.92 + rand() * 0.08), a, a + 0.04 + rand() * 0.16);
    ctx.stroke();
  }

  // Короткие штрихи наружу — чтобы край был неровным, но не «мохнатым».
  // В мягком режиме их нет: на огромном Солнце они и выглядят «колючками»
  for (let i = 0; i < (soft ? 0 : 160); i++) {
    const a = rand() * Math.PI * 2;
    const d = r * (0.94 + rand() * 0.04);
    const len = r * (0.02 + rand() * 0.05);
    ctx.strokeStyle = colors[Math.floor(rand() * colors.length)];
    ctx.globalAlpha = 0.5 + rand() * 0.5;
    ctx.lineWidth = r * (0.008 + rand() * 0.014);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d);
    ctx.lineTo(Math.cos(a + 0.02) * (d + len), Math.sin(a + 0.02) * (d + len));
    ctx.stroke();
  }

  // Брызги краски у самого края
  for (let i = 0; i < (soft ? 20 : 50); i++) {
    const a = rand() * Math.PI * 2;
    const d = r * (1.02 + rand() * 0.08);
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.globalAlpha = 0.4 + rand() * 0.5;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.004 + rand() * 0.01), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Тело Солнца: от кремового центра к оранжевому краю
  const body = ctx.createRadialGradient(-r * 0.1, -r * 0.1, r * 0.1, 0, 0, r);
  body.addColorStop(0, '#fbeccb');
  body.addColorStop(0.45, '#f6d58e');
  body.addColorStop(0.75, '#e8862a');
  body.addColorStop(1, '#c2412d');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}
