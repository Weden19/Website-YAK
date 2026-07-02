// ===== ПРАВИЛА АВАТАРОВ – ДАННЫЕ СЛАЙДОВ =====
const RULES_SLIDES = [
  {
    eyebrow: 'Академия Яковлева',
    title: 'Внешний вид служебных аватаров',
    blocks: [
      { type: 'text', text: 'Руководство по оформлению аватаров. Листайте стрелками или точками внизу.' },
    ],
  },
  {
    eyebrow: '01',
    title: 'Зачем нужен дресс-код?',
    blocks: [
      {
        type: 'checklist',
        items: [
          'Единый стиль – все узнают своих с первого взгляда',
          'Узнаваемость Академии на любом мероприятии',
          'Атмосфера погружения в авиационную тематику',
          'Уважение к окружающим и другим участникам',
          'Корпоративная культура сообщества',
        ],
      },
    ],
  },
  {
    eyebrow: '02',
    title: 'Какие аватары допускаются?',
    blocks: [
      {
        type: 'cards',
        cards: [
          { type: 'allowed', label: '✓ Разрешено', items: ['Человек', 'Гуманоидный фурри', 'Гуманоидный робот'] },
          { type: 'forbidden', label: '✕ Запрещено', items: ['Loli', 'Babyfur', 'Brony', 'NSFW'] },
        ],
      },
    ],
  },
  {
    eyebrow: '03',
    title: 'Если ваш аватар – человек',
    blocks: [
      { type: 'text', text: 'Главное требование простое: соблюдайте форму одежды и требования Академии.' },
      {type: 'checklist',
      items: [
        'Форма соответствует установленному образцу',
        'Погоны и знаки различия на своих местах',
        'Внешний вид опрятный и аккуратный',
        'Отсутствуют неуставные элементы',
      ],
      }
    ],
  },
  {
    eyebrow: '04',
    title: 'Если ваш аватар – фурри',
    blocks: [
      {
        type: 'checklist',
        items: [
          'Форма должна сидеть корректно, без искажений силуэта',
          'Шевроны должны быть читаемыми',
          'Большие хвосты могут мешать, когда Вы сидите в кабине самолета',
        ],
      },
    ],
  },
  {
    eyebrow: '05',
    title: 'Если ваш аватар – робот',
    blocks: [
      {
        type: 'cards',
        cards: [
          { type: 'allowed', label: '✓ Допускается', items: ['Конструктивные особенности модели', 'Неоновые конструктивные элементы'] },
          { type: 'warning', label: '⚠ Нежелательно', items: ['Военная одежда с неоновой подсветкой'] },
        ],
      },
    ],
  },
  {
    eyebrow: '06',
    title: 'Формы одежды',
    blocks: [
      {
        type: 'cards',
        cards: [
          { type: 'allowed', label: 'Повседневная', items: ['Для обычных сборов и патрулей'] },
          { type: 'allowed', label: 'Полевая', items: ['Для учений и полевых мероприятий'] },
          { type: 'allowed', label: 'Лётная', items: ['Для полётов и лётных ивентов'] },
        ],
      },
    ],
  },
  {
    eyebrow: '07',
    title: 'Нашивки и флаги',
    blocks: [
      {
        type: 'cards',
        cards: [
          { type: 'allowed', label: 'Правое плечо', items: ['Шеврон Академии', 'Флаг ВКС или ВМФ'] },
          { type: 'allowed', label: 'Левое плечо', items: ['Флаг РФ', 'Либо флаг страны происхождения', 'Либо флаг исторического государства'] },
        ],
      },
      { type: 'image', src: 'assets/rules/Chev-Officer.png', alt: 'шеврон офицера из Приказа №102-р' }
      { type: 'image', src: 'assets/rules/Chev-Recruit.png', alt: 'шеврон курсанта из Приказа №102-р' },
      {
        type: 'text',
        text: 'Не допускаются флаги и символика, способные вызвать политические конфликты: Украина, ДНР, ЛНР, Косово, Турецкая Республика Северного Кипра, ЛГБТ-флаги и иная политическая символика.',
      },
      { type: 'link', href: 'assets/rules/prikaz-102r.pdf', label: 'Открыть Приказ №102-р – шаблоны шевронов' },
    ],
  },
  {
    eyebrow: '08',
    title: 'Общая схема размещения знаков',
    blocks: [
      { type: 'text', text: 'Общий принцип, принятый в ВС РФ (Приказ МО РФ №300): рукав делится на общее и частное. Наша схема в Приказе №102-р следует той же логике.' },
      {
        type: 'imageRow',
        images: [
          { src: 'https://forma-odezhda.com/image/data/images/Dop/forma.jpg', alt: 'Схема размещения знаков на форме' },
          { src: 'https://forma-odezhda.com/image/data/upload/stati/5656.jpeg', alt: 'Пример расположения шевронов' },
        ],
      },
      { type: 'text', text: 'Источник: forma-odezhda.com – справочный материал, не документ Академии.' },
    ],
  },
  {
    eyebrow: '09',
    title: 'Аксессуары',
    blocks: [
      {
        type: 'cards',
        cards: [
          { type: 'allowed', label: '✓ Допускается', items: ['Очки', 'Планшеты', 'Рации', 'Бронежилеты', 'Оружие', 'Часы', 'Кобуры'] },
          { type: 'warning', label: '⚠ Нежелательно', items: ['Чрезмерная RGB-подсветка', 'Неоновая военная одежда', 'Слишком большие хвосты'] },
        ],
      },
    ],
  },
  {
    eyebrow: '10',
    title: 'Свет и спецэффекты',
    blocks: [
      {
        type: 'cards',
        cards: [
          { type: 'allowed', label: '✓ Разрешено', items: ['Фонари', 'Жезлы маршалла', 'Конструктивная подсветка роботов', 'Эффекты оружия'] },
          { type: 'forbidden', label: '✕ Запрещено', items: ['Эффекты, перекрывающие обзор окружающим'] },
        ],
      },
    ],
  },
  {
    eyebrow: '11',
    title: 'Анимации',
    blocks: [
      { type: 'text', text: 'Любые анимации разрешены. Единственное ограничение – они не должны:' },
      {
        type: 'checklist',
        items: [
          'Мешать проведению мероприятия',
          'Порочить честь и достоинство военнослужащего Академии',
          'Намеренно нарушать дисциплину',
        ],
      },
    ],
  },
  {
    eyebrow: '12',
    title: 'Лётная экипировка',
    blocks: [
      { type: 'text', text: 'Главное – не использовать лишние металлические элементы.' },
      {
        type: 'cards',
        cards: [
          { type: 'allowed', label: '✓ Допускается', items: ['Элементы подвесной системы', 'ППК', 'Штатная фурнитура'] },
        ],
      },
    ],
  },
  {
    eyebrow: '13',
    title: 'Оптимизация – это рекомендация',
    blocks: [
      { type: 'text', text: 'Из-за оружия и интерактивных систем многие служебные аватары автоматически получают рейтинг Poor или Very Poor. Рейтинг VRChat не является критерием допуска.' },
      {
        type: 'checklist',
        items: ['По возможности оптимизируйте материалы', 'Оптимизируйте текстуры', 'Следите за количеством PhysBones'],
      },
    ],
  },
  {
    eyebrow: 'Финал',
    title: 'Итоговый чек-лист',
    blocks: [
      {
        type: 'checklist',
        items: [
          'Надета нужная форма',
          'Погоны соответствуют званию',
          'Установлены правильные шевроны',
          'Размещены правильные флаги',
          'Отсутствует запрещённая символика',
          'Спецэффекты не мешают окружающим',
          'Внешний вид соответствует атмосфере Академии',
        ],
      },
    ],
  },
];

// ===== РЕНДЕР БЛОКОВ =====
function renderRulesBlock(block) {
  switch (block.type) {
    case 'text':
      return `<p class="rules-slide-text">${block.text}</p>`;
    case 'checklist':
      return `<ul class="rules-slide-checklist">${block.items.map(i => `<li>${i}</li>`).join('')}</ul>`;
    case 'cards':
      return `<div class="rules-cards">${block.cards.map(c => `
        <div class="rules-card rules-card-${c.type}">
          <span class="rules-card-label">${c.label}</span>
          <ul>${c.items.map(i => `<li>${i}</li>`).join('')}</ul>
        </div>
      `).join('')}</div>`;
    case 'image':
      return `<img class="rules-slide-img" src="${block.src}" alt="${block.alt}" loading="lazy">`;
    case 'imageRow':
      return `<div class="rules-slide-img-row">${block.images.map(i => `<img src="${i.src}" alt="${i.alt}" loading="lazy">`).join('')}</div>`;
    case 'link':
      return `<a class="rules-source-link" href="${block.href}" target="_blank" rel="noopener">↗ ${block.label}</a>`;
    default:
      return '';
  }
}

function renderRulesSlide(slide, index) {
  return `
    <div class="rules-slide${index === 0 ? ' active' : ''}" data-index="${index}">
      <p class="rules-slide-eyebrow">${slide.eyebrow}</p>
      <h3 class="rules-slide-title">${slide.title}</h3>
      ${slide.blocks.map(renderRulesBlock).join('')}
    </div>
  `;
}

// ===== СОСТОЯНИЕ И НАВИГАЦИЯ =====
const rulesDeckState = { current: 0, total: RULES_SLIDES.length };

function initRulesDeck() {
  const viewport = document.getElementById('rulesDeckViewport');
  const dotsContainer = document.getElementById('rulesDeckDots');
  const counter = document.getElementById('rulesDeckCounter');
  if (!viewport) return;

  viewport.innerHTML = RULES_SLIDES.map(renderRulesSlide).join('');

  if (dotsContainer) {
    dotsContainer.innerHTML = RULES_SLIDES.map((_, i) => `
      <button class="rules-deck-dot${i === 0 ? ' active' : ''}" aria-label="Слайд ${i + 1}" onclick="goToRulesSlide(${i})"></button>
    `).join('');
  }

  if (counter) counter.textContent = `1 / ${rulesDeckState.total}`;
  updateRulesNavButtons();
}

function goToRulesSlide(index) {
  const slides = document.querySelectorAll('.rules-slide');
  const dots = document.querySelectorAll('.rules-deck-dot');
  const counter = document.getElementById('rulesDeckCounter');
  const total = rulesDeckState.total;
  if (total === 0) return;

  const next = Math.max(0, Math.min(total - 1, index));
  slides[rulesDeckState.current]?.classList.remove('active');
  dots[rulesDeckState.current]?.classList.remove('active');
  rulesDeckState.current = next;
  slides[next]?.classList.add('active');
  dots[next]?.classList.add('active');
  if (counter) counter.textContent = `${next + 1} / ${total}`;
  updateRulesNavButtons();
}

function updateRulesNavButtons() {
  const prevBtn = document.getElementById('rulesPrevBtn');
  const nextBtn = document.getElementById('rulesNextBtn');
  if (prevBtn) prevBtn.disabled = rulesDeckState.current === 0;
  if (nextBtn) nextBtn.disabled = rulesDeckState.current === rulesDeckState.total - 1;
}

window.rulesDeckNext = function() { goToRulesSlide(rulesDeckState.current + 1); };
window.rulesDeckPrev = function() { goToRulesSlide(rulesDeckState.current - 1); };
window.goToRulesSlide = goToRulesSlide;

document.addEventListener('DOMContentLoaded', initRulesDeck);
