const SHEET_ID = '1x6L5vMbK3nu68oUATruuKS3aPyBobaneE8m9p6r4vvE';

function sheetUrl(sheetName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
}

function parseSheet(raw) {
  const json = JSON.parse(raw.substring(47).slice(0, -2));
  const cols = json.table.cols.map(c => c.label.trim());
  return json.table.rows.map(row => {
    const obj = {};
    row.c.forEach((cell, i) => {
      obj[cols[i]] = cell ? (cell.v !== null && cell.v !== undefined ? String(cell.v) : '') : '';
    });
    return obj;
  });
}

async function fetchSheet(sheetName) {
  const res = await fetch(sheetUrl(sheetName));
  const text = await res.text();
  return parseSheet(text);
}

// ─── STATS (только миры из Sheets) ───
async function loadStats() {
  try {
    const rows = await fetchSheet('stats');
    rows.forEach(row => {
      if (row.key === 'worlds') {
        const el = document.getElementById('stat-worlds');
        if (el) el.textContent = row.value;
      }
    });
  } catch (e) {
    console.warn('Не удалось загрузить stats:', e);
  }
}

// ─── VRCHAT DATA (участники, ивент, галерея) ───
async function loadVRChatData() {
  try {
    const res = await fetch('data/vrchat.json');
    const data = await res.json();

    // Участники
    if (data.members) {
      const el = document.getElementById('stat-members');
      if (el) el.textContent = data.members;
    }

    // Ближайший ивент
    const regularContainer = document.getElementById('regularEvents');
    if (regularContainer && data.nextEvent) {
      const e = data.nextEvent;
      regularContainer.innerHTML = `
        <div class="event-card event-upcoming">
          <div class="event-badge">Скоро</div>
          <div class="event-body">
            <p class="event-date">${e.date} · ${e.time} МСК</p>
            <h3 class="event-name">${e.name}</h3>
            <p class="event-desc">${e.description || ''}</p>
          </div>
          <div class="event-world">Мир: <span>${e.world || '–'}</span></div>
        </div>
      `;
    } else if (regularContainer) {
      regularContainer.innerHTML = '<p class="events-empty">Ближайших ивентов нет</p>';
    }

    // Галерея
    if (data.gallery && data.gallery.length) {
      initSlider(data.gallery);
    } else {
      const track = document.getElementById('sliderTrack');
      if (track) track.innerHTML = '<div class="slider-empty">Фото появятся после первого ивента</div>';
    }

  } catch (e) {
    console.warn('Не удалось загрузить vrchat.json:', e);
    const regularContainer = document.getElementById('regularEvents');
    if (regularContainer) regularContainer.innerHTML = '<p class="events-empty">Нет данных</p>';
  }
}

// ─── SPECIAL EVENTS (из Sheets) ───
async function loadEvents() {
  const container = document.getElementById('specialEvents');
  if (!container) return;
  try {
    const rows = await fetchSheet('events');
    if (!rows.length) { container.innerHTML = '<p class="events-empty">Специальных ивентов пока нет</p>'; return; }
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
          <div class="event-world">Мир: <span>${r.world}</span></div>
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = '<p class="events-empty">Ошибка загрузки</p>';
  }
}

// ─── SLIDER ───
let sliderIndex = 0;
let sliderImages = [];
let sliderTimer = null;

function initSlider(images) {
  sliderImages = images;
  const track = document.getElementById('sliderTrack');
  const dots = document.getElementById('sliderDots');
  if (!track) return;

  track.innerHTML = images.map((url, i) => `
    <div class="slider-slide ${i === 0 ? 'active' : ''}">
      <img src="${url}" alt="Фото ивента ${i + 1}" loading="lazy">
    </div>
  `).join('');

  if (dots) {
    dots.innerHTML = images.map((_, i) => `
      <button class="slider-dot ${i === 0 ? 'active' : ''}" onclick="sliderGo(${i})"></button>
    `).join('');
  }

  startSliderAuto();
}

function sliderGo(index) {
  const slides = document.querySelectorAll('.slider-slide');
  const dots = document.querySelectorAll('.slider-dot');
  slides.forEach(s => s.classList.remove('active'));
  dots.forEach(d => d.classList.remove('active'));
  sliderIndex = (index + sliderImages.length) % sliderImages.length;
  if (slides[sliderIndex]) slides[sliderIndex].classList.add('active');
  if (dots[sliderIndex]) dots[sliderIndex].classList.add('active');
  resetSliderAuto();
}

function sliderPrev() { sliderGo(sliderIndex - 1); }
function sliderNext() { sliderGo(sliderIndex + 1); }

function startSliderAuto() {
  sliderTimer = setInterval(() => sliderGo(sliderIndex + 1), 4000);
}

function resetSliderAuto() {
  clearInterval(sliderTimer);
  startSliderAuto();
}

// ─── АВАТАРКИ ОРГСОСТАВА ───
function initAvatars() {
  const colors = ['#29abe2','#2a9d6c','#d85a30','#378add','#ba7517','#d4537e','#639922'];
  document.querySelectorAll('.team-avatar[data-name]').forEach(el => {
    const name = el.dataset.name || '?';
    const letter = [...name][0].toUpperCase();
    const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
    const bg = colors[hash % colors.length];
    el.textContent = letter;
    el.style.background = bg + '22';
    el.style.color = bg;
    el.style.border = `1px solid ${bg}55`;
  });
}

// ─── МЕНЮ ───
function toggleMenu() {
  document.getElementById('mobileNav').classList.toggle('open');
}

function closeMenu() {
  document.getElementById('mobileNav').classList.remove('open');
}

// ─── INIT ───
loadStats();
loadVRChatData();
loadEvents();
initAvatars();
