// Блок «Ты и космос»: калькуляторы веса и возраста на планетах.
// Пересчёт идёт сразу при вводе (событие input), без кнопки.

const Calculators = (function () {
  const DAY_MS = 24 * 60 * 60 * 1000; // миллисекунд в сутках
  const MAX_WEIGHT = 500;

  // Самая длинная шкала среди планет — у Юпитера. Шкалы считаем относительно неё,
  // а Солнце (в 11 раз больше) просто заполняет свою шкалу целиком
  const JUPITER_GRAVITY = Math.max(...PLANETS.map((p) => p.gravity));

  // Число по-русски: запятая вместо точки, нужное количество знаков после неё.
  // Без пробела между тысячами: в моноширинном шрифте он выглядит дырой («1   536»)
  function formatNumber(value, digits) {
    return value.toLocaleString('ru-RU', {
      minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false
    });
  }

  // Отбрасываем лишние знаки, а не округляем: 4,99 года — это ещё 4,9, а не 5,0
  function floorTo(value, digits) {
    const k = Math.pow(10, digits);
    return Math.floor(value * k) / k;
  }

  // 1 год, 2 года, 5 лет, 11 лет, 21 год; с запятой — всегда «года» (1,5 года, 83,0 года).
  // digits — сколько знаков после запятой показано: 83,0 для JS целое, но читается как дробь
  function yearsWord(value, digits) {
    if (digits > 0) return 'года';
    const n10 = value % 10;
    const n100 = value % 100;
    if (n10 === 1 && n100 !== 11) return 'год';
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 'года';
    return 'лет';
  }

  function showMessage(element, text, isError) {
    element.textContent = text;
    element.classList.toggle('is-error', isError);
  }

  // Показать сообщение и сказать «результата нет» (null)
  function reject(element, text, isError) {
    showMessage(element, text, isError);
    return null;
  }

  // Строка списка: название, число и (для веса) шкала
  function createRow(body, withBar) {
    const li = document.createElement('li');
    li.className = 'calc__row';
    li.style.setProperty('--accent', body.base);
    li.innerHTML = `
      <span class="calc__name">${body.name}</span>
      <span class="calc__value"><span class="calc__number">—</span> <span class="calc__unit"></span></span>
      ${withBar ? '<span class="calc__bar"><span class="calc__fill"></span></span>' : ''}
    `;
    return li;
  }

  // ---------- Вес ----------
  const weight = {};

  function initWeight() {
    weight.input = document.getElementById('weight-input');
    weight.message = document.getElementById('weight-message');
    const list = document.getElementById('weight-list');
    weight.rows = [SUN, ...PLANETS].map((body, i) => {
      const row = createRow(body, true);
      row.style.setProperty('--i', i); // для задержки анимации: шкалы растут по очереди
      list.appendChild(row);
      return { body, row };
    });
    weight.input.addEventListener('input', updateWeight);
    updateWeight();
  }

  // Поле текстовое, поэтому число разбираем сами.
  // Шаблон (регулярное выражение): необязательный минус, цифры, затем
  // необязательная точка и ещё цифры. Подходят «55», «55.5», «55.» (пока печатают), «-5».
  // Не подходят «55кг», «5.5.5», «1e3» — их Number() принял бы, а нам такое не нужно
  const NUMBER_PATTERN = /^-?\d+(\.\d*)?$/;

  // Возвращает вес из поля или null, попутно показывая сообщение
  function readWeight() {
    const { input, message } = weight;
    // Убираем пробелы по краям и меняем запятую на точку: «55,5» → «55.5»
    const text = input.value.trim().replace(',', '.');
    if (text === '') return reject(message, 'Введи свой вес — и увидишь его на каждой планете.', false);
    if (!NUMBER_PATTERN.test(text)) return reject(message, 'Это не похоже на число. Пример: 55 или 55,5.', true);
    const value = Number(text);
    if (value <= 0) return reject(message, 'Вес должен быть больше нуля.', true);
    if (value > MAX_WEIGHT) return reject(message, `Слишком большое число — проверь вес (не больше ${MAX_WEIGHT} кг).`, true);
    showMessage(message, '', false);
    return value;
  }

  function updateWeight() {
    const value = readWeight();
    weight.rows.forEach(({ body, row }) => {
      const number = row.querySelector('.calc__number');
      const fill = row.querySelector('.calc__fill');
      if (value === null) {
        number.textContent = '—';
        row.querySelector('.calc__unit').textContent = '';
        fill.style.transform = 'scaleX(0)';
        return;
      }
      // Вес на планете = вес на Земле × во сколько раз там сильнее тяжесть
      number.textContent = formatNumber(value * body.gravity, 1);
      row.querySelector('.calc__unit').textContent = 'кг';
      // Доля шкалы от 0 до 1; scaleX растягивает полоску по ширине (CSS анимирует)
      const share = Math.min(1, body.gravity / JUPITER_GRAVITY);
      fill.style.transform = `scaleX(${share})`;
      row.classList.toggle('is-overflow', body.gravity > JUPITER_GRAVITY);
    });
  }

  // ---------- Возраст ----------
  const age = {};

  function today() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()); // полночь, без часов
  }

  // ---------- Маска ввода даты: ДД.ММ.ГГГГ ----------
  // Поле текстовое (type="date" в Яндекс Браузере открывал поиск), поэтому
  // точки ставим сами. Идея: из того, что в поле, берём только цифры
  // (не больше 8) и заново собираем строку с точками в нужных местах.

  // «15032006» → «15.03.2006»; «150» → «15.0»; точка появляется, только когда есть что за ней писать
  function formatDateDigits(digits) {
    let text = digits.slice(0, 2);
    if (digits.length > 2) text += '.' + digits.slice(2, 4);
    if (digits.length > 4) text += '.' + digits.slice(4, 8);
    return text;
  }

  // Позиция в отформатированной строке сразу после count-й цифры
  // (чтобы курсор не прыгал в конец, если правят середину даты)
  function caretAfterDigits(text, count) {
    if (count === 0) return 0;
    let seen = 0;
    for (let i = 0; i < text.length; i++) {
      if (/\d/.test(text[i])) seen++;
      if (seen === count) return i + 1;
    }
    return text.length;
  }

  let previousDigits = '';

  function applyDateMask(event) {
    const input = age.input;
    const caret = input.selectionStart;
    // Сколько цифр стоит до курсора — это его «настоящее» место в дате
    let digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, '').length;
    let digits = input.value.replace(/\D/g, '').slice(0, 8); // всё, кроме цифр, выбрасываем

    // Backspace сразу после точки стёр только точку — цифры не изменились,
    // и маска тут же вернула бы её на место. Тогда стираем цифру перед точкой
    if (event && event.inputType === 'deleteContentBackward' && digits === previousDigits && digitsBeforeCaret > 0) {
      digits = digits.slice(0, digitsBeforeCaret - 1) + digits.slice(digitsBeforeCaret);
      digitsBeforeCaret -= 1;
    }

    const text = formatDateDigits(digits);
    input.value = text;
    const position = caretAfterDigits(text, Math.min(digitsBeforeCaret, digits.length));
    input.setSelectionRange(position, position);
    previousDigits = digits;
  }

  function initAge() {
    age.input = document.getElementById('birth-input');
    age.message = document.getElementById('age-message');
    const list = document.getElementById('age-list');
    age.rows = PLANETS.map((body) => {
      const row = createRow(body, false);
      list.appendChild(row);
      return { body, row };
    });
    // Сначала маска поправляет текст в поле, потом пересчитываем возраст
    age.input.addEventListener('input', (event) => {
      applyDateMask(event);
      updateAge();
    });
    updateAge();
  }

  // Возвращает дату рождения или null, попутно показывая сообщение
  function readBirthDate() {
    const { input, message } = age;
    const digits = input.value.replace(/\D/g, '');
    // Пока дата не введена целиком — это не ошибка, а подсказка
    if (digits.length === 0) return reject(message, 'Введи дату рождения: ДД.ММ.ГГГГ — точки поставятся сами.', false);
    if (digits.length < 8) return reject(message, 'Допиши дату полностью: ДД.ММ.ГГГГ.', false);

    const d = Number(digits.slice(0, 2));
    const m = Number(digits.slice(2, 4));
    const y = Number(digits.slice(4, 8));
    if (m < 1 || m > 12) return reject(message, 'Месяц должен быть от 01 до 12.', true);
    if (y < 1900) return reject(message, 'Проверь год: калькулятор считает с 1900 года.', true);

    // new Date(год, месяц, день) — по местному времени. Месяцы в JS считаются с нуля.
    // Если такого дня нет, JS не ругается, а «переносит» дату: 31.02 → 3 марта.
    // Поэтому проверяем, что получился тот же день и месяц, что ввели
    const birth = new Date(y, m - 1, d);
    if (d < 1 || birth.getDate() !== d || birth.getMonth() !== m - 1) {
      return reject(message, 'Такой даты нет — проверь день и месяц.', true);
    }
    if (birth > today()) return reject(message, 'Дата рождения не может быть в будущем.', true);
    showMessage(message, '', false);
    return birth;
  }

  // Возраст на Земле — обычный, по календарю (сколько дней рождения уже было)
  function calendarAge(birth, now) {
    let years = now.getFullYear() - birth.getFullYear();
    const hadBirthday = now.getMonth() > birth.getMonth() ||
      (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
    if (!hadBirthday) years -= 1;
    return years;
  }

  function updateAge() {
    const birth = readBirthDate();
    const now = today();
    // Сколько суток прожито. Math.round — из-за перевода часов в сутках бывает 23 или 25 часов
    const days = birth ? Math.round((now - birth) / DAY_MS) : 0;

    age.rows.forEach(({ body, row }) => {
      const number = row.querySelector('.calc__number');
      const unit = row.querySelector('.calc__unit');
      if (!birth) {
        number.textContent = '—';
        unit.textContent = '';
        return;
      }
      let years;
      let digits = 0;
      if (body.id === 'earth') {
        years = calendarAge(birth, now);
      } else {
        // Возраст на планете = прожитые дни / длина года этой планеты в днях
        years = days / body.periodDays;
        if (body.id === 'mercury') digits = 1;  // год Меркурия короткий — показываем десятые
        else if (years < 1) digits = 2;         // на далёких планетах ещё и года не прошло
        years = floorTo(years, digits);
      }
      number.textContent = formatNumber(years, digits);
      unit.textContent = yearsWord(years, digits);
    });
  }

  function init() {
    initWeight();
    initAge();
  }

  return { init };
})();
