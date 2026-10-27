// ===== ОБЩЕЕ ДЛЯ ВСЕХ СТРАНИЦ: меню, активный пункт, год в подвале =====
(function () {
    const burger = document.querySelector('.burger');
    const mobileNav = document.getElementById('mobileNav');

    function setMenu(open) {
        if (!mobileNav) return;
        mobileNav.classList.toggle('open', open);
        if (burger) burger.setAttribute('aria-expanded', String(open));
    }

    if (burger && mobileNav) {
        burger.addEventListener('click', () => setMenu(!mobileNav.classList.contains('open')));
        mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && mobileNav.classList.contains('open')) {
                setMenu(false);
                burger.focus();
            }
        });
    }

    // Подсветка текущего раздела в меню
    const normalize = path => path.replace(/index\.html$/, '').replace(/\/?$/, '/');
    const current = normalize(location.pathname);
    document.querySelectorAll('.nav a, .mobile-nav a').forEach(a => {
        const href = a.getAttribute('href');
        if (href && href !== '/main' && normalize(href) === current) a.setAttribute('aria-current', 'page');
    });

    // Мягкое появление секций при прокрутке (не для «уменьшить движение» и старых браузеров)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion && 'IntersectionObserver' in window) {
        const targets = document.querySelectorAll('main > section:not(.hero) > .container, main > section:not(.hero) > .slider');
        if (targets.length) {
            document.documentElement.classList.add('reveal-on');
            const observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                });
            }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
            targets.forEach(el => { el.classList.add('reveal'); observer.observe(el); });
        }
    }

    // Год в подвале
    const START_YEAR = 2025;
    const year = new Date().getFullYear();
    document.querySelectorAll('.js-year').forEach(el => {
        el.textContent = year > START_YEAR ? `${START_YEAR}–${year}` : String(START_YEAR);
    });

    // Уведомление о cookies: показываем, пока посетитель не нажмёт «Понятно»
    const COOKIE_KEY = 'cookieNoticeAccepted';
    const COOKIE_TEXT = document.documentElement.lang === 'en'
        ? { label: 'Cookie notice', text: 'This site uses cookies (Google Tag Manager) to collect anonymous visit statistics. By continuing to use the site, you agree to this.', ok: 'Got it' }
        : { label: 'Уведомление о cookies', text: 'Сайт использует cookies (Google Tag Manager) для сбора обезличенной статистики посещений. Продолжая пользоваться сайтом, вы соглашаетесь с этим.', ok: 'Понятно' };

    let accepted = false;
    try { accepted = localStorage.getItem(COOKIE_KEY) === '1'; } catch (e) {}

    if (!accepted) {
        const notice = document.createElement('div');
        notice.className = 'cookie-notice';
        notice.setAttribute('role', 'region');
        notice.setAttribute('aria-label', COOKIE_TEXT.label);

        const text = document.createElement('p');
        text.className = 'cookie-notice-text';
        text.textContent = COOKIE_TEXT.text;

        const ok = document.createElement('button');
        ok.type = 'button';
        ok.className = 'cookie-notice-btn';
        ok.textContent = COOKIE_TEXT.ok;
        ok.addEventListener('click', () => {
            try { localStorage.setItem(COOKIE_KEY, '1'); } catch (e) {}
            notice.remove();
        });

        notice.append(text, ok);
        document.body.appendChild(notice);
    }
})();
