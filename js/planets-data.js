// Данные о планетах. Размеры на экране стилизованные (не в реальном масштабе),
// а периоды обращения — настоящие (в земных годах), от них зависит скорость.

const PLANETS = [
  {
    id: 'mercury', name: 'Меркурий', period: 0.24, size: 7, type: 'rocky',
    base: '#b5452f', stripes: ['#8f2f22', '#d86a4a'], seed: 11
  },
  {
    id: 'venus', name: 'Венера', period: 0.62, size: 11, type: 'swirl',
    base: '#e8862a', stripes: ['#c2412d', '#f2b45a'], seed: 23
  },
  {
    id: 'earth', name: 'Земля', period: 1, size: 12, type: 'earth',
    base: '#5aa6cf', stripes: ['#f1e4c8', '#3f7fae'], seed: 37
  },
  {
    id: 'mars', name: 'Марс', period: 1.88, size: 9, type: 'rocky',
    base: '#c2412d', stripes: ['#8f2f22', '#e0694c'], seed: 41
  },
  {
    id: 'jupiter', name: 'Юпитер', period: 11.86, size: 27, type: 'gas',
    base: '#d9573e', stripes: ['#f1e4c8', '#a83526', '#f2c9a8'], seed: 53, spot: true
  },
  {
    id: 'saturn', name: 'Сатурн', period: 29.46, size: 22, type: 'gas',
    base: '#f2c9a8', stripes: ['#e6b48e', '#f7dcc2'], seed: 67, ring: '#e3a83b'
  },
  {
    id: 'uranus', name: 'Уран', period: 84, size: 16, type: 'plain',
    base: '#9fc4d6', stripes: ['#c6dde8', '#7aa6bd'], seed: 71
  },
  {
    id: 'neptune', name: 'Нептун', period: 164.8, size: 15, type: 'streak',
    base: '#3f7fae', stripes: ['#f1e4c8', '#2b5f88'], seed: 83
  },
  {
    id: 'pluto', name: 'Плутон', period: 248, size: 5, type: 'rocky',
    base: '#c9b49a', stripes: ['#9c8670', '#e8d8c0'], seed: 97, dwarf: true
  }
];
