// Точка входа: запускаем все части сайта после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
  Hero.init();
  Sections.init();
  Nav.init(); // после Sections: точкам нужны уже созданные разделы
});
