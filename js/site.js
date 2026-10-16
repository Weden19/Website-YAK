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

    // Год в подвале
    const START_YEAR = 2025;
    const year = new Date().getFullYear();
    document.querySelectorAll('.js-year').forEach(el => {
        el.textContent = year > START_YEAR ? `${START_YEAR}–${year}` : String(START_YEAR);
    });
})();
