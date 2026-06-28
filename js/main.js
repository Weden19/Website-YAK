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

// ─── STATS ───
async function loadStats() {
  try {
    const rows = await fetchSheet('stats');
    rows.forEach(row => {
      const el = document.getElementById('stat-' + row.key);
      if (el) el.textContent = row.value;
    });
  } catch (e) {
    console.warn('Не удалось загрузить stats:', e);
  }
}

// ─── REGULAR EVENTS ───
async function loadRegular() {
  const container = document.getElementById('regularEvents');
  try {
    const rows = await fetchSheet('regular');
    if (!rows.length) { container.innerHTML = '<p class="events-empty">Нет данных</p>'; return; }
    container.innerHTML = rows.map(r => `
      <div class="event-card event-regular">
        <div class="event-badge event-badge-regular">Каждую неделю</div>
        <div class="event-body">
          <p class="event-date">${r.day} · ${r.time} МСК</p>
          <h3 class="event-name">${r.description || 'Еженедельная встреча'}</h3>
        </div>
        <div class="event-world">Мир: <span>${r.world}</span></div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = '<p class="events-empty">Ошибка загрузки</p>';
    console.warn(e);
  }
}

// ─── SPECIAL EVENTS ───
async function loadEvents() {
  const container = document.getElementById('specialEvents');
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
    console.warn(e);
  }
}

// ─── МЕНЮ ───
function toggleMenu() {
  document.getElementById('mobileNav').classList.toggle('open');
}

function closeMenu() {
  document.getElementById('mobileNav').classList.remove('open');
}

// ─── АКТИВНАЯ ССЫЛКА ───
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
  let current = '';
  sections.forEach(sec => {
    if (window.scrollY >= sec.offsetTop - 100) current = sec.getAttribute('id');
  });
  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + current) link.classList.add('active');
  });
});

// ─── AVATAR FALLBACK ───
function avatarFallback(img) {
  const name = img.alt || '?';
  const letter = [...name][0].toUpperCase();
  const colors = ['#7c6df0','#2a9d6c','#d85a30','#378add','#ba7517','#d4537e','#639922'];
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = colors[hash % colors.length];
  const div = document.createElement('div');
  div.className = 'team-avatar';
  div.textContent = letter;
  div.style.background = bg + '33';
  div.style.color = bg;
  img.replaceWith(div);
}

// ─── INIT ───
loadStats();
loadRegular();
loadEvents();