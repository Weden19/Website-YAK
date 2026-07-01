// ===== КОНФИГ =====
const SHEETS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1x6L5vMbK3nu68oUATruuKS3aPyBobaneE8m9p6r4vvE/export?format=csv&gid=0';

// ===== ЗАГРУЗКА ДАННЫХ САЙТА =====
async function loadSiteData() {
  try {
    const response = await fetch('data/vrchat.json');
    if (!response.ok) throw new Error('Network error');
    const data = await response.json();

    // Участники
    const membersEl = document.getElementById('stat-members');
    if (membersEl && data.members) {
      membersEl.textContent = data.members;
    }

    // Галерея
    if (data.gallery && data.gallery.length > 0) {
      initSlider(data.gallery);
    } else {
      const viewport = document.querySelector('.slider-viewport');
      if (viewport) {
        viewport.innerHTML = '<div class="slider-placeholder">Фото появятся после первого ивента</div>';
      }
    }

    // Ивенты из Google Sheets
    await loadEventsFromSheets();

  } catch (err) {
    console.error('Failed to load site data:', err);
  }
}

// ===== ФЕТЧ ИВЕНТОВ ИЗ GOOGLE SHEETS =====
async function loadEventsFromSheets() {
  if (!SHEETS_CSV_URL) {
    console.warn('Google Sheets URL не настроен');
    return;
  }

  try {
    const response = await fetch(SHEETS_CSV_URL);
    if (!response.ok) throw new Error('Sheets fetch failed');
    
    const csvText = await response.text();
    const events = parseCSV(csvText);
    
    if (events.length === 0) {
      console.log('No events in Google Sheets');
      showEmptyEvents();
      return;
    }

    const now = new Date();
    const upcoming = events
      .filter(e => new Date(e.date) > now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Ближайший ивент
    const regularContainer = document.getElementById('regularEvents');
    if (regularContainer) {
      if (upcoming.length > 0) {
        const next = upcoming[0];
        const d = new Date(next.date);
        regularContainer.innerHTML = `
          <div class="event-card">
            <h3 class="event-name">${escapeHtml(next.title)}</h3>
            <p class="event-date">${d.toLocaleDateString('ru-RU')} в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
            <p class="event-world">${escapeHtml(next.world || '–')}</p>
            ${next.description ? `<p class="event-desc">${escapeHtml(next.description)}</p>` : ''}
          </div>
        `;
      } else {
        regularContainer.innerHTML = '<p class="events-empty">Пока нет запланированных ивентов</p>';
      }
    }

    // Специальные ивенты
    const special = upcoming.filter(e => e.type === 'special');
    const specialContainer = document.getElementById('specialEvents');
    if (specialContainer) {
      if (special.length > 0) {
        specialContainer.innerHTML = special.map(e => {
          const d = new Date(e.date);
          return `
            <div class="event-card">
              <h3 class="event-name">${escapeHtml(e.title)}</h3>
              <p class="event-date">${d.toLocaleDateString('ru-RU')} в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
              <p class="event-world">${escapeHtml(e.world || '–')}</p>
              ${e.description ? `<p class="event-desc">${escapeHtml(e.description)}</p>` : ''}
            </div>
          `;
        }).join('');
      } else {
        specialContainer.innerHTML = '<p class="events-empty">Пока нет специальных ивентов</p>';
      }
    }

    console.log(`Loaded ${upcoming.length} upcoming events from Sheets`);

  } catch (err) {
    console.error('Failed to load events from Sheets:', err);
    showEmptyEvents();
  }
}

function showEmptyEvents() {
  const regularContainer = document.getElementById('regularEvents');
  const specialContainer = document.getElementById('specialEvents');
  if (regularContainer) regularContainer.innerHTML = '<p class="events-empty">Расписание временно недоступно</p>';
  if (specialContainer) specialContainer.innerHTML = '<p class="events-empty">Расписание временно недоступно</p>';
}

// ===== ПАРСЕР CSV =====
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  const events = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (values[idx] || '').trim();
    });
    if (obj.title) events.push(obj);
  }
  
  return events;
}

// Корректный парсер строки CSV (учитывает кавычки и запятые внутри них)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Экранирование HTML
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== СЛАЙДЕР =====
const sliderState = {
  images: [],
  current: 0,
  timer: null,
  SLIDE_DURATION: 5000,
};

function initSlider(images) {
  const viewport = document.querySelector('.slider-viewport');
  const dotsContainer = document.getElementById('sliderDots');
  const totalEl = document.getElementById('sliderTotal');
  const currentEl = document.getElementById('sliderCurrent');

  if (!viewport || !images || images.length === 0) return;

  sliderState.images = images;
  sliderState.current = 0;

  viewport.innerHTML = '';
  if (dotsContainer) dotsContainer.innerHTML = '';

  images.forEach((url, i) => {
    const slide = document.createElement('div');
    slide.className = 'slider-slide' + (i === 0 ? ' is-active' : '');
    slide.dataset.index = i;

    const img = document.createElement('img');
    img.src = url;
    img.alt = `Фото ${i + 1}`;
    img.loading = i < 2 ? 'eager' : 'lazy';
    img.decoding = 'async';

    slide.appendChild(img);
    viewport.appendChild(slide);

    if (dotsContainer) {
      const dot = document.createElement('button');
      dot.className = 'slider-dot' + (i === 0 ? ' is-active' : '');
      dot.setAttribute('aria-label', `Слайд ${i + 1}`);
      dot.onclick = () => goToSlide(i);
      dotsContainer.appendChild(dot);
    }
  });

  if (totalEl) totalEl.textContent = images.length;
  if (currentEl) currentEl.textContent = 1;

  startAutoPlay();
}

function goToSlide(index) {
  const slides = document.querySelectorAll('.slider-slide');
  const dots = document.querySelectorAll('.slider-dot');
  const currentEl = document.getElementById('sliderCurrent');
  const total = sliderState.images.length;

  if (total === 0) return;

  const next = ((index % total) + total) % total;

  slides[sliderState.current]?.classList.remove('is-active');
  dots[sliderState.current]?.classList.remove('is-active');

  sliderState.current = next;
  slides[next]?.classList.add('is-active');
  dots[next]?.classList.add('is-active');

  if (currentEl) currentEl.textContent = next + 1;
}

function startAutoPlay() {
  stopAutoPlay();
  sliderState.timer = setInterval(() => {
    goToSlide(sliderState.current + 1);
  }, sliderState.SLIDE_DURATION);
}

function stopAutoPlay() {
  if (sliderState.timer) {
    clearInterval(sliderState.timer);
    sliderState.timer = null;
  }
}

function sliderNext() {
  goToSlide(sliderState.current + 1);
  startAutoPlay();
}

function sliderPrev() {
  goToSlide(sliderState.current - 1);
  startAutoPlay();
}

window.sliderNext = sliderNext;
window.sliderPrev = sliderPrev;

// ===== АВАТАРКИ-ЗАГЛУШКИ =====
function initAvatars() {
  const avatars = document.querySelectorAll('.team-avatar[data-name]');
  avatars.forEach(el => {
    const name = el.getAttribute('data-name');
    if (!name) return;
    
    const initials = name
      .split(' ')
      .map(word => word[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
    
    el.textContent = initials;
  });
}

// ===== МОБИЛЬНОЕ МЕНЮ =====
window.toggleMenu = function() {
  const nav = document.getElementById('mobileNav');
  if (nav) nav.classList.toggle('open');
};

window.closeMenu = function() {
  const nav = document.getElementById('mobileNav');
  if (nav) nav.classList.remove('open');
};

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
  initAvatars();
  loadSiteData();

  const slider = document.querySelector('.slider');
  if (slider) {
    slider.addEventListener('mouseenter', stopAutoPlay);
    slider.addEventListener('mouseleave', startAutoPlay);
  }

  document.addEventListener('keydown', (e) => {
    if (!sliderState.images.length) return;
    if (e.key === 'ArrowLeft') sliderPrev();
    if (e.key === 'ArrowRight') sliderNext();
  });
});