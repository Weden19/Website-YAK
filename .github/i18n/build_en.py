"""Собирает английские страницы /en/... из русских и обновляет шапки RU-страниц."""
import re, os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
import chrome
from en_dict import EN, EN_DECK, EN_SVG

PAGES = [('main', 'main/index.html', False), ('rules', 'rules/index.html', True),
         ('members', 'members/index.html', True), ('join', 'join/index.html', True), ('faq', 'faq/index.html', True)]
CYR = re.compile(r'[А-Яа-яЁё]')
KEEP = {'Табельник', 'Ярик ПолуКринж', 'Русская версия'}
missing = []

def tr(text):
    t = text.strip()
    if not CYR.search(t) or t in KEEP:
        return text
    m = re.fullmatch(r'Ссылка на пункт (\d+\.\d+)', t)
    if m:
        return text.replace(t, f'Link to rule {m.group(1)}')
    if t in EN:
        return text.replace(t, EN[t])
    missing.append(t)
    return text

def translate_html(s):
    # атрибуты
    s = re.sub(r'\b(alt|aria-label|title|content|data-desc|placeholder|aria-roledescription)="([^"]*)"',
               lambda m: f'{m.group(1)}="{tr(m.group(2))}"', s)
    # текстовые узлы вне <script>
    parts = re.split(r'(<script\b.*?</script>)', s, flags=re.S)
    for i in range(0, len(parts), 2):
        parts[i] = re.sub(r'>([^<>]+)<', lambda m: '>' + tr(m.group(1)) + '<', parts[i])
    return ''.join(parts)

def set_header(s, home, lang, page):
    s, n = chrome.HEADER_RE.subn(lambda m: chrome.header(home, lang, page), s)
    assert n == 1, page
    s, n = chrome.FOOTER_RE.subn(lambda m: chrome.footer(lang), s)
    assert n == 1, page
    # hreflang-альтернативы
    s = re.sub(r'  <link rel="alternate" hreflang="[^"]+" href="[^"]+">\n', '', s)
    s = s.replace('  <link rel="icon"', chrome.alternates(page) + '  <link rel="icon"', 1)
    return s

def build():
    for page, path, home in PAGES:
        ru = open(path, encoding='utf-8').read()
        ru = set_header(ru, home, 'ru', page)
        open(path, 'w', encoding='utf-8').write(ru)

        en = set_header(ru, home, 'en', page)
        en = en.replace('<html lang="ru">', '<html lang="en">', 1)
        en = en.replace('content="ru_RU"', 'content="en_US"')
        en = re.sub(r'https://yakovlev-academy\.ru/(main|rules|members|join|faq)/', r'https://yakovlev-academy.ru/en/\1/', en)
        # ссылки внутри сайта → английские страницы (ассеты и данные не трогаем)
        en = re.sub(r'href="/(main|rules|members|join|faq)(/?(?:#[^"]*)?)"', r'href="/en/\1\2"', en)
        # alternates после замены url: вернуть ru-ссылку
        en = en.replace('hreflang="ru" href="https://yakovlev-academy.ru/en/', 'hreflang="ru" href="https://yakovlev-academy.ru/')
        en = translate_html(en)
        if page == 'members':
            en = en.replace('<script src="/js/rules-deck.js"></script>',
                            '<script src="/js/rules-deck-en.js"></script>\n  <script src="/js/rules-deck.js"></script>')
        os.makedirs(f'en/{page}', exist_ok=True)
        open(f'en/{page}/index.html', 'w', encoding='utf-8').write(en)

    # схема нашивок
    svg = open('assets/rules/sleeve-scheme.svg', encoding='utf-8').read()
    for ru_t, en_t in EN_SVG.items():
        svg = svg.replace(f'>{ru_t}<', f'>{en_t}<').replace(f'  {ru_t}<', f'  {en_t}<').replace(f'"{ru_t}"', f'"{en_t}"')
    svg = re.sub(r'<tspan([^>]*)>(\d)</tspan>  ', r'<tspan\1>\2</tspan>  ', svg)
    for m in re.finditer(r'>([^<>]*[А-Яа-яЁё][^<>]*)<', svg):
        missing.append('SVG: ' + m.group(1).strip())
    open('assets/rules/sleeve-scheme-en.svg', 'w', encoding='utf-8').write(svg)

    left = sorted(set(missing))
    if left:
        print('НЕ ПЕРЕВЕДЕНО:'); [print('  ', t) for t in left]
        sys.exit(1)
    print('ok')

if __name__ == '__main__':
    build()
