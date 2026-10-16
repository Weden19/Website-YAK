import re

NAV = {
    'ru': {
        'prefix': '',
        'links': [('rules', 'Правила'), ('members', 'Для участников'), ('join', 'Как вступить'), ('faq', 'FAQ')],
        'home': '← Главная', 'logo_label': 'Академия Яковлева — на главную', 'logo': 'АКАДЕМИЯ ЯКОВЛЕВА',
        'main_menu': 'Основное меню', 'menu': 'Меню', 'mobile_menu': 'Мобильное меню',
        'switch': ('en', 'EN', 'English version'),
    },
    'en': {
        'prefix': '/en',
        'links': [('rules', 'Rules'), ('members', 'For members'), ('join', 'How to join'), ('faq', 'FAQ')],
        'home': '← Home', 'logo_label': 'Yakovlev Academy — home', 'logo': 'YAKOVLEV ACADEMY',
        'main_menu': 'Main menu', 'menu': 'Menu', 'mobile_menu': 'Mobile menu',
        'switch': ('ru', 'RU', 'Русская версия'),
    },
}


def counterpart(lang, page):
    """Адрес той же страницы на другом языке (page=None — главная)."""
    page = page or 'main'
    return f'/{page}/' if lang == 'en' else f'/en/{page}/'


def header(home, lang='ru', page=None):
    n = NAV[lang]
    p = n['prefix']
    links = ([(f'{p}/main', n['home'])] if home else []) + [(f'{p}/{slug}', t) for slug, t in n['links']]
    sw_lang, sw_text, sw_label = n['switch']
    sw_href = counterpart(lang, page)
    sw = f'<a href="{sw_href}" class="nav-link nav-lang" lang="{sw_lang}" hreflang="{sw_lang}" aria-label="{sw_label}">{sw_text}</a>'
    sw_mob = f'<a href="{sw_href}" class="nav-lang" lang="{sw_lang}" hreflang="{sw_lang}" aria-label="{sw_label}">{sw_text}</a>'
    nav = '\n'.join(f'        <a href="{h}" class="nav-link">{t}</a>' for h, t in links) + f'\n        {sw}'
    mob = '\n'.join(f'    <a href="{h}">{t}</a>' for h, t in links) + f'\n    {sw_mob}'
    return f'''  <header class="site-header">
    <div class="container">
      <a href="{p}/main" class="logo" aria-label="{n['logo_label']}">
        <img src="/assets/logo.png" alt="" class="logo-img">
        <span class="logo-text">{n['logo']}</span>
      </a>
      <nav class="nav" aria-label="{n['main_menu']}">
{nav}
      </nav>
      <button class="burger" type="button" aria-label="{n['menu']}" aria-controls="mobileNav" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>

  <nav class="mobile-nav" id="mobileNav" aria-label="{n['mobile_menu']}">
{mob}
  </nav>'''


def footer(lang='ru'):
    logo = NAV[lang]['logo']
    return f'''  <footer class="site-footer">
    <div class="container">
      <div class="footer-logo">
        <img src="/assets/logo.png" alt="" class="logo-img">
        <span class="logo-text">{logo}</span>
      </div>
      <p class="footer-copy">VRChat · © <span class="js-year">2025</span></p>
    </div>
  </footer>'''


FOOTER = footer('ru')

HEADER_RE = re.compile(r'  <header class="site-header">.*?</header>\n\n  <nav class="mobile-nav".*?</nav>', re.S)
FOOTER_RE = re.compile(r'  <footer class="site-footer">.*?</footer>', re.S)


def alternates(page):
    page = page or 'main'
    return (f'  <link rel="alternate" hreflang="ru" href="https://yakovlev-academy.ru/{page}/">\n'
            f'  <link rel="alternate" hreflang="en" href="https://yakovlev-academy.ru/en/{page}/">\n')
