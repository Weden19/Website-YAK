// Проверка внутренних ссылок сайта: страницы, ассеты, якоря.
// Смотрит HTML (href/src/srcset), CSS (url(...)), JS (строки вида '/assets/...') и манифест.
// Внешние ссылки (https://...) не проверяет — они часто отвечают ботам 403 и дают ложные падения.
// Запуск: node .github/scripts/check-links.js  (из корня репозитория)
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['.git', 'node_modules', '.github']);
const errors = [];

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

const files = walk(ROOT);
const rel = f => path.relative(ROOT, f);

// URL сайта → файл в репозитории (как это делает GitHub Pages)
function resolveSitePath(urlPath) {
    const clean = decodeURIComponent(urlPath);
    const target = path.join(ROOT, clean);
    const candidates = clean.endsWith('/')
        ? [path.join(target, 'index.html')]
        : [target, target + '.html', path.join(target, 'index.html')];
    return candidates.find(c => fs.existsSync(c) && fs.statSync(c).isFile()) || null;
}

const idCache = new Map();
function idsOf(file) {
    if (!idCache.has(file)) {
        const html = fs.readFileSync(file, 'utf8');
        idCache.set(file, new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1])));
    }
    return idCache.get(file);
}

function check(ref, fromFile, baseUrlPath, { checkAnchor = true } = {}) {
    if (!ref || /^(https?:|mailto:|tel:|data:|javascript:|#?$)/i.test(ref) || ref.includes('${')) return;
    const [beforeHash, hash] = ref.split('#');
    const withoutQuery = beforeHash.split('?')[0];
    let urlPath;
    if (withoutQuery === '') urlPath = baseUrlPath; // «#якорь» на этой же странице
    else if (withoutQuery.startsWith('/')) urlPath = withoutQuery;
    else urlPath = path.posix.join(path.posix.dirname(baseUrlPath + (baseUrlPath.endsWith('/') ? 'x' : '')), withoutQuery);
    const file = resolveSitePath(urlPath);
    if (!file) {
        errors.push(`${rel(fromFile)}: нет файла для «${ref}»`);
        return;
    }
    if (checkAnchor && hash && file.endsWith('.html') && !idsOf(file).has(decodeURIComponent(hash))) {
        errors.push(`${rel(fromFile)}: на странице ${rel(file)} нет якоря «#${hash}»`);
    }
}

// URL, по которому файл открывается на сайте
function urlPathOf(file) {
    const r = '/' + rel(file).split(path.sep).join('/');
    return r.endsWith('/index.html') ? r.slice(0, -'index.html'.length) : r;
}

for (const file of files) {
    const ext = path.extname(file);
    const text = ext === '.html' || ext === '.css' || ext === '.js' || ext === '.webmanifest' || ext === '.svg'
        ? fs.readFileSync(file, 'utf8') : null;
    if (text === null) continue;
    const base = urlPathOf(file);

    if (ext === '.html' || ext === '.svg') {
        // 404.html открывается по любому адресу — в нём допустимы только абсолютные ссылки
        for (const m of text.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
            if (path.basename(file) === '404.html' && m[1] && !/^(https?:|#|\/|data:|mailto:)/.test(m[1])) {
                errors.push(`404.html: относительная ссылка «${m[1]}» сломается на вложенных адресах`);
            }
            check(m[1], file, base);
        }
    }
    if (ext === '.css') {
        for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) check(m[1], file, base);
    }
    if (ext === '.js' || ext === '.webmanifest') {
        // Строки с путём от корня сайта: '/assets/…', "/data/…", `/en/…`
        for (const m of text.matchAll(/['"`](\/(?:assets|data|js|css|en|main|rules|members|join|faq)\/[^'"`\s]*)['"`]/g)) {
            check(m[1], file, base, { checkAnchor: false });
        }
        // Относительные пути к ассетам в JS — частая ошибка (на /members/ резолвятся не туда)
        if (ext === '.js') {
            for (const m of text.matchAll(/['"`]((?:\.\.\/|\.\/)?assets\/[^'"`\s]+)['"`]/g)) {
                errors.push(`${rel(file)}: относительный путь «${m[1]}» — используйте путь от корня (/assets/…)`);
            }
        }
    }
}

if (errors.length) {
    console.error(`Найдено проблем: ${errors.length}`);
    for (const e of [...new Set(errors)]) console.error('  ✗ ' + e);
    process.exit(1);
}
console.log(`Ссылки в порядке (${files.length} файлов проверено)`);
