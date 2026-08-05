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
                if (cell.f) {
                    obj[cols[i]] = cell.f;
                } else if (typeof cell.v === 'string') {
                    obj[cols[i]] = cell.v;
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

// ===== ФОРМАТИРОВАНИЕ ВРЕМЕНИ ИВЕНТОВ =====
function parseEventDateTime(event) {
    if (!event) return null;

    const dateValue = event.date || event.datetime || event.start || '';
    const timeValue = event.time || event.startTime || '';

    if (typeof dateValue === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(dateValue)) {
        const [day, month, year] = dateValue.split('.').map(Number);
        const [hours = 0, minutes = 0] = typeof timeValue === 'string' && timeValue.includes(':')
            ? timeValue.split(':').map(Number)
            : [0, 0];
        const moscowOffsetMs = 3 * 60 * 60 * 1000;
        return new Date(Date.UTC(year, month - 1, day, hours, minutes) - moscowOffsetMs);
    }

    if (typeof dateValue === 'string' && dateValue.includes('T')) {
        const parsed = new Date(dateValue);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        const parsed = new Date(`${dateValue}T${timeValue || '00:00'}`);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    return null;
}

function formatEventDateTime(event) {
    const start = parseEventDateTime(event);
    if (!start) {
        return event?.date ? `${event.date}${event.time ? ` · ${event.time}` : ''}` : '';
    }

    const dateStr = start.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const timeStr = start.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });

    return `${dateStr} · ${timeStr}`;
}

function getStartOfWeek(date) {
    const copy = new Date(date);
    const day = copy.getDay() || 7;
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() - day + 1);
    return copy;
}

function isSameWeek(date, weekStart) {
    const candidate = getStartOfWeek(date);
    return candidate.getFullYear() === weekStart.getFullYear()
        && candidate.getMonth() === weekStart.getMonth()
        && candidate.getDate() === weekStart.getDate();
}

function getEventDisplayState(event, now = new Date()) {
    const start = parseEventDateTime(event);
    if (!start) {
        return { label: 'Скоро', badgeClass: '', cardClass: 'event-upcoming' };
    }

    const startTime = new Date(start.getTime());
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    if (now >= startTime && now <= endTime) {
        return { label: 'Проходит', badgeClass: 'event-badge-active', cardClass: 'event-upcoming' };
    }

    if (now < startTime) {
        return { label: 'Скоро', badgeClass: '', cardClass: 'event-upcoming' };
    }

    return { label: 'Прошёл', badgeClass: 'event-badge-past', cardClass: '' };
}

function getRegularEventsForDisplay(data, now = new Date()) {
    const rawEvents = Array.isArray(data?.events)
        ? data.events
        : (data?.nextEvent ? [data.nextEvent] : []);

    const parsedEvents = rawEvents
        .map((event, index) => ({ ...event, _parsedDate: parseEventDateTime(event), _index: index }))
        .filter(event => event._parsedDate)
        .sort((a, b) => a._parsedDate - b._parsedDate);

    if (!parsedEvents.length) return [];

    const upcoming = parsedEvents.filter(event => event._parsedDate >= now);
    const baseEvents = upcoming.length ? upcoming : parsedEvents;
    const weekStart = getStartOfWeek(baseEvents[0]._parsedDate);
    const sameWeekEvents = baseEvents.filter(event => isSameWeek(event._parsedDate, weekStart));

    if (sameWeekEvents.length > 1) {
        return sameWeekEvents;
    }

    return baseEvents.length ? [baseEvents[0]] : [];
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
            const state = getEventDisplayState(r);
            const worldName = r.world || 'Загадка';
            const worldHref = r.world_link || r.worldLink || r.world_url || r.worldUrl || r.link || r.url || '';
            const worldHtml = worldHref
                ? `<a href="${worldHref}" class="event-world-link" target="_blank" rel="noopener noreferrer">${worldName}</a>`
                : `<span>${worldName}</span>`;
            return `
            <div class="event-card ${state.cardClass}">
                <div class="event-badge ${state.badgeClass}">${state.label}</div>
                <div class="event-body">
                    <p class="event-date">${formatEventDateTime(r)}</p>
                    <h3 class="event-name">${r.name}</h3>
                    <p class="event-desc">${r.description}</p>
                </div>
                <div class="event-world">Мир: ${worldHtml}</div>
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

        // Ивенты по неделе или ближайший ивент
        const regularContainer = document.getElementById('regularEvents');
        if (regularContainer) {
            const events = getRegularEventsForDisplay(data);
            if (events.length) {
                regularContainer.innerHTML = events.map(event => {
                    const state = getEventDisplayState(event);
                    return `
                    <div class="event-card ${state.cardClass}">
                        <div class="event-badge ${state.badgeClass}">${state.label}</div>
                        <div class="event-body">
                            <p class="event-date">${formatEventDateTime(event)}</p>
                            <h3 class="event-name">${event.name}</h3>
                            ${event.description ? `<p class="event-desc">${event.description}</p>` : ''}
                        </div>
                        <div class="event-world">Мир: <span>${event.world || 'Загадка'}</span></div>
                    </div>
                    `;
                }).join('');
            } else {
                regularContainer.innerHTML = '<p class="events-empty">Пока нет запланированных ивентов</p>';
            }
        }

        // Галерея
        if (data.gallery && data.gallery.length > 0) {
            initSlider(data.gallery);
        } else {
            const viewport = document.getElementById('sliderViewport');
            if (viewport) viewport.innerHTML = '<div class="slider-placeholder">Фото появятся после первого ивента</div>';
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
    const viewport = document.getElementById('sliderViewport');
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
        slide.className = 'slider-slide' + (i === 0 ? ' active' : '');
        slide.dataset.index = i;

        const img = document.createElement('img');
        img.src = url;
        img.alt = `Фото ${i + 1}`;
        img.loading = i < 2 ? 'eager' : 'lazy';
        img.referrerPolicy = 'no-referrer';
        
        slide.appendChild(img);
        viewport.appendChild(slide);

        if (dotsContainer) {
            const dot = document.createElement('button');
            dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
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

    slides[sliderState.current]?.classList.remove('active');
    dots[sliderState.current]?.classList.remove('active');

    sliderState.current = next;

    slides[next]?.classList.add('active');
    dots[next]?.classList.add('active');

    if (currentEl) currentEl.textContent = next + 1;
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
    const colors = ['#38bdf8','#2a9d6c','#d85a30','#378add','#ba7517','#d4537e','#639922'];
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