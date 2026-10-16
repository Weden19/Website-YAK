// ===== ЯЗЫК =====
const LANG = document.documentElement.lang === 'en' ? 'en' : 'ru';
const I18N = {
    ru: {
        locale: 'ru-RU',
        soon: 'Скоро', live: 'Проходит', past: 'Прошёл',
        world: 'Мир: ', worldLink: 'Ссылка на мир', mystery: 'Загадка',
        msk: 'МСК', yourTime: 'у вас',
        noSpecial: 'Специальных ивентов пока нет', loadError: 'Ошибка загрузки',
        noEvents: 'Пока нет запланированных ивентов', noData: 'Данные недоступны',
        noPhotos: 'Фото появятся после первого ивента',
        photo: n => `Фото с ивента ${n}`, photoDot: n => `Фото ${n}`, slideOf: (n, t) => `${n} из ${t}`, slide: 'слайд',
        updated: ago => `Данные из VRChat обновлены ${ago}`,
        justNow: 'только что', minAgo: n => `${n} мин назад`, hAgo: n => `${n} ч назад`, dAgo: n => `${n} дн назад`,
        until: name => `До события «${name}»`, liveNow: name => `${name} — идёт сейчас`,
        liveWorld: (world, users) => `Мир: ${world}${users ? ` · в инстансе ${users} чел.` : ''}`,
        join: 'Присоединиться', openGroup: 'Открыть группу VRChat',
        units: { d: 'д', h: 'ч', m: 'мин', s: 'с' },
    },
    en: {
        locale: 'en-GB',
        soon: 'Upcoming', live: 'Live', past: 'Finished',
        world: 'World: ', worldLink: 'World link', mystery: 'Mystery',
        msk: 'MSK', yourTime: 'your time',
        noSpecial: 'No special events yet', loadError: 'Failed to load',
        noEvents: 'No events scheduled yet', noData: 'Data unavailable',
        noPhotos: 'Photos will appear after the first event',
        photo: n => `Event photo ${n}`, photoDot: n => `Photo ${n}`, slideOf: (n, t) => `${n} of ${t}`, slide: 'slide',
        updated: ago => `VRChat data updated ${ago}`,
        justNow: 'just now', minAgo: n => `${n} min ago`, hAgo: n => `${n} h ago`, dAgo: n => `${n} d ago`,
        until: name => `Until “${name}”`, liveNow: name => `${name} — live now`,
        liveWorld: (world, users) => `World: ${world}${users ? ` · ${users} in the instance` : ''}`,
        join: 'Join', openGroup: 'Open VRChat group',
        units: { d: 'd', h: 'h', m: 'min', s: 's' },
    },
};
const T = I18N[LANG];
const VRCHAT_GROUP_URL = 'https://vrchat.com/home/group/grp_629eb128-47c7-40c5-848b-c0b8cb8e8a7a';

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
const EVENT_DURATION_MS = 2 * 60 * 60 * 1000; // Лётная среда идёт 2 часа
const MSK_TZ = 'Europe/Moscow';
const MSK_OFFSET_MS = 3 * 60 * 60 * 1000; // в России нет перехода на летнее время

function parseEventDateTime(event) {
    if (!event) return null;

    const dateValue = event.date || event.datetime || event.start || '';
    const timeValue = event.time || event.startTime || '';

    if (typeof dateValue === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(dateValue)) {
        const [day, month, year] = dateValue.split('.').map(Number);
        const [hours = 0, minutes = 0] = typeof timeValue === 'string' && timeValue.includes(':')
            ? timeValue.split(':').map(Number)
            : [0, 0];
        return new Date(Date.UTC(year, month - 1, day, hours, minutes) - MSK_OFFSET_MS);
    }

    if (typeof dateValue === 'string' && dateValue.includes('T')) {
        const parsed = new Date(dateValue);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        const parsed = new Date(`${dateValue}T${timeValue || '00:00'}:00+03:00`);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    return null;
}

function formatEventDateTime(event) {
    const start = parseEventDateTime(event);
    if (!start) {
        return event?.date ? `${event.date}${event.time ? ` · ${event.time}` : ''}` : '';
    }

    const dateOpts = { day: '2-digit', month: '2-digit', year: 'numeric' };
    const timeOpts = { hour: '2-digit', minute: '2-digit' };
    const mskDate = start.toLocaleDateString('ru-RU', { ...dateOpts, timeZone: MSK_TZ });
    const mskTime = start.toLocaleTimeString('ru-RU', { ...timeOpts, timeZone: MSK_TZ });
    let text = `${mskDate} · ${mskTime} ${T.msk}`;

    // Если у зрителя другой часовой пояс — подсказываем его время
    const localDate = start.toLocaleDateString('ru-RU', dateOpts);
    const localTime = start.toLocaleTimeString('ru-RU', timeOpts);
    if (localTime !== mskTime || localDate !== mskDate) {
        text += localDate === mskDate ? ` (${T.yourTime} ${localTime})` : ` (${T.yourTime} ${localDate.slice(0, 5)} ${localTime})`;
    }
    return text;
}

// Неделя считается по московскому времени: понедельник 00:00 МСК
function getStartOfWeek(date) {
    const msk = new Date(date.getTime() + MSK_OFFSET_MS);
    const weekday = msk.getUTCDay() || 7;
    const monday = Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() - (weekday - 1));
    return new Date(monday - MSK_OFFSET_MS);
}

function isSameWeek(date, weekStart) {
    return getStartOfWeek(date).getTime() === weekStart.getTime();
}

function getEventDisplayState(event, now = new Date()) {
    const start = parseEventDateTime(event);
    if (!start) {
        return { label: T.soon, badgeClass: '', cardClass: 'event-upcoming' };
    }

    const startTime = new Date(start.getTime());
    const endTime = new Date(startTime.getTime() + EVENT_DURATION_MS);

    if (now >= startTime && now <= endTime) {
        return { label: T.live, badgeClass: 'event-badge-active', cardClass: 'event-upcoming' };
    }

    if (now < startTime) {
        return { label: T.soon, badgeClass: '', cardClass: 'event-upcoming' };
    }

    return { label: T.past, badgeClass: 'event-badge-past', cardClass: '' };
}

function createEventCard(event, { linkWorld = false, showEmptyDescription = false, liveUrl = null } = {}) {
    const state = getEventDisplayState(event);
    const card = document.createElement('div');
    card.className = `event-card ${state.cardClass}`;

    const badge = document.createElement('div');
    badge.className = `event-badge ${state.badgeClass}`;
    badge.textContent = state.label;
    card.appendChild(badge);

    const body = document.createElement('div');
    body.className = 'event-body';

    const date = document.createElement('p');
    date.className = 'event-date';
    date.textContent = formatEventDateTime(event);
    body.appendChild(date);

    const name = document.createElement('h3');
    name.className = 'event-name';
    name.textContent = event?.name || '';
    body.appendChild(name);

    if (event?.description || showEmptyDescription) {
        const description = document.createElement('p');
        description.className = 'event-desc';
        description.textContent = event?.description || '';
        body.appendChild(description);
    }
    card.appendChild(body);

    const world = document.createElement('div');
    world.className = 'event-world';
    world.append(T.world);
    const worldName = event?.world || T.mystery;
    const worldHref = event?.world_link || event?.worldLink || event?.world_url
        || event?.worldUrl || event?.link || event?.url || '';
    // Ссылку прячем под текст «Ссылка на мир» — название мира не нужно переводить
    let safeWorldUrl = null;
    if (state.badgeClass === 'event-badge-active' && liveUrl) safeWorldUrl = liveUrl;
    else if (linkWorld && typeof worldHref === 'string') {
        try {
            const url = new URL(worldHref);
            if (url.protocol === 'https:' || url.protocol === 'http:') safeWorldUrl = url.href;
        } catch {
            safeWorldUrl = null;
        }
    }

    const worldElement = document.createElement(safeWorldUrl ? 'a' : 'span');
    if (safeWorldUrl) {
        worldElement.href = safeWorldUrl;
        worldElement.className = 'event-world-link';
        worldElement.target = '_blank';
        worldElement.rel = 'noopener noreferrer';
    }
    worldElement.textContent = safeWorldUrl ? T.worldLink : worldName;
    world.appendChild(worldElement);
    card.appendChild(world);

    return card;
}

function getRegularEventsForDisplay(data, now = new Date()) {
    const rawEvents = Array.isArray(data?.events) ? [...data.events] : [];

    if (!rawEvents.length && data?.nextEvent) {
        rawEvents.push(data.nextEvent);
    }

    const uniqueEvents = [];
    const seen = new Set();
    rawEvents.forEach(event => {
        const key = `${event?.name || ''}||${event?.date || ''}||${event?.time || ''}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueEvents.push(event);
        }
    });

    const parsedEvents = uniqueEvents
        .map((event, index) => ({ ...event, _parsedDate: parseEventDateTime(event), _index: index }))
        .filter(event => event._parsedDate)
        .sort((a, b) => a._parsedDate - b._parsedDate);

    // Ивент остаётся в списке, пока идёт (длительность — как в getEventDisplayState)
    const futureEvents = parsedEvents.filter(event => event._parsedDate.getTime() + EVENT_DURATION_MS > now.getTime());
    if (!futureEvents.length) return [];

    const currentWeekStart = getStartOfWeek(now);
    const currentWeekEvents = futureEvents.filter(event => isSameWeek(event._parsedDate, currentWeekStart));
    if (currentWeekEvents.length) return currentWeekEvents;

    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const nextWeekStart = new Date(currentWeekStart.getTime() + WEEK_MS);
    const nextWeekEnd = new Date(nextWeekStart.getTime() + WEEK_MS);

    const nextWeekEvents = futureEvents.filter(event => event._parsedDate >= nextWeekStart && event._parsedDate < nextWeekEnd);
    if (nextWeekEvents.length) return nextWeekEvents;

    return futureEvents.slice(0, 3);
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
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'events-empty';
            emptyMessage.textContent = T.noSpecial;
            container.replaceChildren(emptyMessage);
            return;
        }
        container.replaceChildren(...rows.map(row => createEventCard(row, {
            linkWorld: true,
            showEmptyDescription: true,
        })));
    } catch (e) {
        if (container) {
            const errorMessage = document.createElement('p');
            errorMessage.className = 'events-empty';
            errorMessage.textContent = T.loadError;
            container.replaceChildren(errorMessage);
        }
        console.warn(e);
    }
}

// ===== «ДАННЫЕ ОБНОВЛЕНЫ N МИН НАЗАД» =====
function formatAgo(date, now = new Date()) {
    const minutes = Math.max(0, Math.round((now - date) / 60000));
    if (minutes < 1) return T.justNow;
    if (minutes < 60) return T.minAgo(minutes);
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return T.hAgo(hours);
    const days = Math.floor(hours / 24);
    return T.dAgo(days);
}

function renderUpdatedAt(updated) {
    const el = document.getElementById('eventsUpdated');
    const date = updated ? new Date(updated) : null;
    if (!el || !date || Number.isNaN(date.getTime())) return;
    const render = () => {
        el.textContent = T.updated(formatAgo(date));
        el.title = date.toLocaleString(T.locale, { timeZone: MSK_TZ }) + ' ' + T.msk;
    };
    render();
    el.hidden = false;
    setInterval(render, 60000);
}

// ===== БАННЕР: ОТСЧЁТ ДО ИВЕНТА / «ИДЁТ СЕЙЧАС» =====
function formatCountdown(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    const u = T.units;
    if (d > 0) return `${d} ${u.d} ${h} ${u.h} ${m} ${u.m}`;
    if (h > 0) return `${h} ${u.h} ${m} ${u.m}`;
    return `${m} ${u.m} ${String(sec).padStart(2, '0')} ${u.s}`;
}

function initNextEventBanner(data, liveInstance) {
    const banner = document.getElementById('nextEvent');
    if (!banner) return;
    const titleEl = banner.querySelector('.next-event-title');
    const timerEl = banner.querySelector('.next-event-timer');
    const metaEl = banner.querySelector('.next-event-meta');
    const button = banner.querySelector('.next-event-btn');

    const events = (Array.isArray(data?.events) ? data.events : [])
        .map(e => ({ e, start: parseEventDateTime(e) }))
        .filter(x => x.start)
        .sort((a, b) => a.start - b.start);

    let timer = null;
    const render = () => {
        const now = Date.now();
        const next = events.find(x => x.start.getTime() + EVENT_DURATION_MS > now);
        if (!next) { banner.hidden = true; clearInterval(timer); return; }
        const isLive = next.start.getTime() <= now;
        banner.hidden = false;
        banner.classList.toggle('next-event--live', isLive);
        if (isLive) {
            titleEl.textContent = T.liveNow(next.e.name);
            timerEl.textContent = '';
            metaEl.textContent = liveInstance?.worldName ? T.liveWorld(liveInstance.worldName, liveInstance.users) : '';
            button.textContent = liveInstance ? T.join : T.openGroup;
            button.href = liveInstance ? liveInstance.url : VRCHAT_GROUP_URL;
            button.hidden = false;
        } else {
            titleEl.textContent = T.until(next.e.name);
            timerEl.textContent = formatCountdown(next.start.getTime() - now);
            metaEl.textContent = formatEventDateTime(next.e);
            button.hidden = true;
        }
    };
    render();
    timer = setInterval(render, 1000);
}

// ===== ДАННЫЕ ИЗ VRCHAT.JSON =====
async function loadVRChatData() {
    try {
        const res = await fetch('/data/vrchat.json');
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();

        renderUpdatedAt(data.updated);
        const liveInstance = Array.isArray(data.live) && data.live.length ? data.live[0] : null;
        initNextEventBanner(data, liveInstance);

        // Участники
        const membersEl = document.getElementById('stat-members');
        if (membersEl && data.members) membersEl.textContent = data.members;

        // Ивенты по неделе или ближайший ивент
        const regularContainer = document.getElementById('regularEvents');
        if (regularContainer) {
            const events = getRegularEventsForDisplay(data);
            if (events.length) {
                regularContainer.replaceChildren(...events.map(event => createEventCard(event, { liveUrl: liveInstance?.url })));
            } else {
                const emptyMessage = document.createElement('p');
                emptyMessage.className = 'events-empty';
                emptyMessage.textContent = T.noEvents;
                regularContainer.replaceChildren(emptyMessage);
            }
        }

        // Галерея
        if (data.gallery && data.gallery.length > 0) {
            initSlider(data.gallery);
        } else {
            const viewport = document.getElementById('sliderViewport');
            if (viewport) viewport.innerHTML = `<div class="slider-placeholder">${T.noPhotos}</div>`;
        }
    } catch (err) {
        console.warn('Не удалось загрузить vrchat.json:', err);
        const regularContainer = document.getElementById('regularEvents');
        if (regularContainer) {
            const errorMessage = document.createElement('p');
            errorMessage.className = 'events-empty';
            errorMessage.textContent = T.noData;
            regularContainer.replaceChildren(errorMessage);
        }
    }
}

// ===== СЛАЙДЕР =====
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const sliderState = {
    images: [],
    current: 0,
    timer: null,
    hovered: false,
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
        slide.setAttribute('role', 'group');
        slide.setAttribute('aria-roledescription', T.slide);
        slide.setAttribute('aria-label', T.slideOf(i + 1, images.length));

        const img = document.createElement('img');
        img.src = url;
        img.alt = T.photo(i + 1);
        img.loading = i < 2 ? 'eager' : 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('click', () => openLightbox(i));

        slide.appendChild(img);
        viewport.appendChild(slide);

        if (dotsContainer) {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', T.photoDot(i + 1));
            dot.onclick = () => { goToSlide(i); startAutoPlay(); };
            dotsContainer.appendChild(dot);
        }
    });

    if (totalEl) totalEl.textContent = images.length;
    if (currentEl) currentEl.textContent = 1;
    viewport.classList.add('slider-viewport--ready');
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
    dots[sliderState.current]?.removeAttribute('aria-current');

    sliderState.current = next;

    slides[next]?.classList.add('active');
    dots[next]?.classList.add('active');
    dots[next]?.setAttribute('aria-current', 'true');

    if (currentEl) currentEl.textContent = next + 1;
}

// Автопрокрутка: не крутим при «уменьшить движение», под курсором, в фоновой вкладке и при открытом просмотре
function startAutoPlay() {
    stopAutoPlay();
    if (sliderState.images.length < 2 || reducedMotion.matches || sliderState.hovered
        || document.hidden || lightboxState.open) return;
    sliderState.timer = setInterval(() => goToSlide(sliderState.current + 1), sliderState.SLIDE_DURATION);
}

function stopAutoPlay() {
    if (sliderState.timer) { clearInterval(sliderState.timer); sliderState.timer = null; }
}

window.sliderNext = function() { goToSlide(sliderState.current + 1); startAutoPlay(); };
window.sliderPrev = function() { goToSlide(sliderState.current - 1); startAutoPlay(); };

// ===== СВАЙП =====
// Горизонтальный свайп (а не вертикальный скролл страницы) → onLeft / onRight
function addSwipe(element, onLeft, onRight) {
    let startX = 0, startY = 0, tracking = false;
    element.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) { tracking = false; return; }
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        tracking = true;
    }, { passive: true });
    element.addEventListener('touchend', e => {
        if (!tracking) return;
        tracking = false;
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        if (dx < 0) onLeft(); else onRight();
    }, { passive: true });
}

// ===== ПОЛНОЭКРАННЫЙ ПРОСМОТР =====
const lightboxState = { open: false, index: 0, returnFocus: null };

function renderLightbox() {
    const img = document.getElementById('lightboxImg');
    const counter = document.getElementById('lightboxCounter');
    const total = sliderState.images.length;
    img.src = sliderState.images[lightboxState.index];
    img.alt = T.photo(lightboxState.index + 1);
    counter.textContent = `${lightboxState.index + 1} / ${total}`;
}

function openLightbox(index) {
    const box = document.getElementById('lightbox');
    if (!box || !sliderState.images.length) return;
    lightboxState.open = true;
    lightboxState.index = index;
    lightboxState.returnFocus = document.activeElement;
    renderLightbox();
    box.hidden = false;
    document.body.classList.add('no-scroll');
    stopAutoPlay();
    document.getElementById('lightboxClose').focus();
}

function closeLightbox() {
    const box = document.getElementById('lightbox');
    if (!box || !lightboxState.open) return;
    lightboxState.open = false;
    box.hidden = true;
    document.body.classList.remove('no-scroll');
    goToSlide(lightboxState.index);
    lightboxState.returnFocus?.focus?.();
    startAutoPlay();
}

function stepLightbox(delta) {
    const total = sliderState.images.length;
    lightboxState.index = ((lightboxState.index + delta) % total + total) % total;
    renderLightbox();
}

function initLightbox() {
    const box = document.getElementById('lightbox');
    if (!box) return;
    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    document.getElementById('lightboxPrev').addEventListener('click', () => stepLightbox(-1));
    document.getElementById('lightboxNext').addEventListener('click', () => stepLightbox(1));
    box.addEventListener('click', e => { if (e.target === box) closeLightbox(); });
    addSwipe(box, () => stepLightbox(1), () => stepLightbox(-1));

    // Фокус не уходит из окна просмотра
    box.addEventListener('keydown', e => {
        if (e.key !== 'Tab') return;
        const buttons = [...box.querySelectorAll('button')];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
}

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

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    initAvatars();
    initLightbox();
    loadStats();
    loadVRChatData();
    loadSpecialEvents();

    const slider = document.getElementById('slider');
    if (slider) {
        slider.addEventListener('mouseenter', () => { sliderState.hovered = true; stopAutoPlay(); });
        slider.addEventListener('mouseleave', () => { sliderState.hovered = false; startAutoPlay(); });
        // Пока фокус на кнопках слайдера — не листаем сами
        slider.addEventListener('focusin', stopAutoPlay);
        slider.addEventListener('focusout', startAutoPlay);
        addSwipe(slider, window.sliderNext, window.sliderPrev);
    }

    document.addEventListener('visibilitychange', () => (document.hidden ? stopAutoPlay() : startAutoPlay()));
    reducedMotion.addEventListener?.('change', startAutoPlay);

    document.addEventListener('keydown', (e) => {
        if (!sliderState.images.length) return;
        if (lightboxState.open) {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') stepLightbox(-1);
            if (e.key === 'ArrowRight') stepLightbox(1);
            return;
        }
        if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        if (e.key === 'ArrowLeft') window.sliderPrev();
        if (e.key === 'ArrowRight') window.sliderNext();
    });
});
