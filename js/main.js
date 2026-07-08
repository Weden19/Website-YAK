// ===== КОНФИГ =====
const SHEET_ID = '1x6L5vMbK3nu68oUATruuKS3aPyBobaneE8m9p6r4vvE';

function sheetUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
}

function parseSheet(raw) {
  const json = JSON.parse(raw.substring(47).slice(0, -2));
  const cols = json.table.cols.map(c => c.label.trim());
  return json.table.rows
    .filter(row => row.c && row.c.some(cell => cell && cell.v !== null))
    .map(row => {
      const obj = {};
      row.c.forEach((cell, i) => {
        if (!cell || cell.v === null || cell.v === undefined) {
          obj[cols[i]] = '';
          return;
        }
        // Форматированное значение приоритетнее
        if (cell.f) {
          obj[cols[i]] = cell.f;
        } else if (typeof cell.v === 'string') {
          obj[cols[i]] = cell.v;
        } else if (typeof cell.v === 'number') {
          obj[cols[i]] = String(cell.v);
        } else {
          obj[cols[i]] = String(cell.v);
        }
      });
      return obj;
    });
}

async function fetchSheet(sheetName) {
  const res = await fetch(sheetUrl(sheetName));
  const text = await res.text();
  return parseSheet(text);
}

// ===== СТАТИСТИКА ИЗ SHEETS =====
async function loadStats() {
  try {
    const rows = await fetchSheet('stats');
    rows.forEach(row => {
      const el = document.getElementById('stat-' + row.key);
      if (el && row.value) el.textContent = row.value;
    });
  } catch (e) {
    console.warn('Не удалось загрузить stats:', e);
  }
}

// ===== СПЕЦИАЛЬНЫЕ ИВЕНТЫ ИЗ SHEETS =====
async function loadSpecialEvents() {
  const container = document.getElementById('specialEvents');
  try {
    const rows = await fetchSheet('events');
    if (!rows.length) {
      container.innerHTML = '<p class="events-empty">Специальных ивентов пока нет</p>';
      return;
    }
    container.innerHTML = rows.map(r => {
      const isUpcoming = r.status === 'upcoming';
      return `
        <div class="event-card ${isUpcoming ? 'event-upcoming' : ''}">
          <div class="event-badge ${isUpcoming ? '' : 'event-badge-past'}">${isUpcoming ? 'Скоро' : 'Прошёл'}</div>
          <div class="event-body">
            <p class="event-date">${r.date} · ${r.time} МСК</p>
            <h3 class="event-name">${r.name}</h3>
            <p class="event-desc">${r.description}</p>
          </div>
          <div class="event-world">Мир: <span>${r.world || 'Загадка'}</span></div>
        </div>
      `;
    }).join('');
  } catch (e) {
    if (container) container.innerHTML = '<p class="events-empty">Ошибка загрузки</p>';
    console.warn(e);
  }
}

// ===== ДАННЫЕ ИЗ VRCHAT.JSON =====
async function loadVRChatData() {
  try {
    const res = await fetch('data/vrchat.json');
    if (!res.ok) throw new Error('Network error');
    const data = await res.json();

    // Участники
    const membersEl = document.getElementById('stat-members');
    if (membersEl && data.members) membersEl.textContent = data.members;

    // Ближайший ивент из VRChat
    const regularContainer = document.getElementById('regularEvents');
    if (regularContainer) {
      if (data.nextEvent) {
        const e = data.nextEvent;
        regularContainer.innerHTML = `
          <div class="event-card event-upcoming">
            <div class="event-badge">Скоро</div>
            <div class="event-body">
              <p class="event-date">${e.date} · ${e.time + 3 * 60 * 60 * 1000} МСК</p>
              <h3 class="event-name">${e.name}</h3>
              ${e.description ? `<p class="event-desc">${e.description}</p>` : ''}
            </div>
            <div class="event-world">Мир: <span>${e.world || 'загадка'}</span></div>
          </div>
        `;
      } else {
        regularContainer.innerHTML = '<p class="events-empty">Пока нет запланированных ивентов</p>';
      }
    }

    // Галерея
    if (data.gallery && data.gallery.length > 0) {
      initSlider(data.gallery);
    } else {
      const track = document.getElementById('sliderTrack');
      if (track) track.innerHTML = '<div class="slider-placeholder">Фото появятся после первого ивента</div>';
    }

  } catch (err) {
    console.warn('Не удалось загрузить vrchat.json:', err);
    const regularContainer = document.getElementById('regularEvents');
    if (regularContainer) regularContainer.innerHTML = '<p class="events-empty">Данные недоступны</p>';
  }
}

// ===== СЛАЙДЕР =====
const sliderState = {
  images: [],
  current: 0,
  timer: null,
  SLIDE_DURATION: 5000,
};

function initSlider(images) {
  const track = document.getElementById('sliderTrack');
  const dotsContainer = document.getElementById('sliderDots');

  if (!track || !images || images.length === 0) return;

  sliderState.images = images;
  sliderState.current = 0;

  track.innerHTML = '';
  if (dotsContainer) dotsContainer.innerHTML = '';

  images.forEach((url, i) => {
    const slide = document.createElement('div');
    slide.className = 'slider-slide' + (i === 0 ? ' active' : '');
    slide.dataset.index = i;
    const img = document.createElement('img');
    img.src = url;
    img.alt = `Фото ${i + 1}`;
    img.loading = i < 2 ? 'eager' : 'lazy';
    slide.appendChild(img);
    track.appendChild(slide);

    if (dotsContainer) {
      const dot = document.createElement('button');
      dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Слайд ${i + 1}`);
      dot.onclick = () => goToSlide(i);
      dotsContainer.appendChild(dot);
    }
  });

  startAutoPlay();
}

function goToSlide(index) {
  const slides = document.querySelectorAll('.slider-slide');
  const dots = document.querySelectorAll('.slider-dot');
  const total = sliderState.images.length;
  if (total === 0) return;

  const next = ((index % total) + total) % total;
  slides[sliderState.current]?.classList.remove('active');
  dots[sliderState.current]?.classList.remove('active');
  sliderState.current = next;
  slides[next]?.classList.add('active');
  dots[next]?.classList.add('active');
}

function startAutoPlay() {
  stopAutoPlay();
  sliderState.timer = setInterval(() => goToSlide(sliderState.current + 1), sliderState.SLIDE_DURATION);
}

function stopAutoPlay() {
  if (sliderState.timer) { clearInterval(sliderState.timer); sliderState.timer = null; }
}

window.sliderNext = function() { goToSlide(sliderState.current + 1); startAutoPlay(); };
window.sliderPrev = function() { goToSlide(sliderState.current - 1); startAutoPlay(); };

// ===== АВАТАРКИ =====
function initAvatars() {
  const colors = ['#7c6df0','#2a9d6c','#d85a30','#378add','#ba7517','#d4537e','#639922'];
  document.querySelectorAll('.team-avatar[data-name]').forEach(el => {
    const name = el.getAttribute('data-name');
    if (!name) return;
    const letter = [...name][0].toUpperCase();
    const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
    const bg = colors[hash % colors.length];
    el.textContent = letter;
    el.style.background = bg + '33';
    el.style.color = bg;
  });
}

// ===== МОБИЛЬНОЕ МЕНЮ =====
window.toggleMenu = function() {
  document.getElementById('mobileNav')?.classList.toggle('open');
};
window.closeMenu = function() {
  document.getElementById('mobileNav')?.classList.remove('open');
};

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
  initAvatars();
  loadStats();
  loadVRChatData();
  loadSpecialEvents();

  const slider = document.querySelector('.slider');
  if (slider) {
    slider.addEventListener('mouseenter', stopAutoPlay);
    slider.addEventListener('mouseleave', startAutoPlay);
  }

  document.addEventListener('keydown', (e) => {
    if (!sliderState.images.length) return;
    if (e.key === 'ArrowLeft') window.sliderPrev();
    if (e.key === 'ArrowRight') window.sliderNext();
  });
});