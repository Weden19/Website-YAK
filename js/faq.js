// ===== FAQ: поиск по вопросам и ответам =====
(function () {
    const input = document.getElementById('faqSearch');
    const empty = document.getElementById('faqEmpty');
    const items = [...document.querySelectorAll('.faq-item')];
    const groups = [...document.querySelectorAll('.faq-group')];
    if (!input || !items.length) return;

    // ё = е, регистр не важен
    const norm = text => text.toLowerCase().replace(/ё/g, 'е');
    const original = new Map(items.map(item => [item, item.innerHTML]));
    const wasOpen = new Map(items.map(item => [item, item.open]));

    // Подсветить совпадения в текстовых узлах (ссылки и разметку не ломаем)
    function highlight(root, query) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            const text = node.nodeValue;
            const hay = norm(text);
            let from = 0, idx = hay.indexOf(query);
            if (idx === -1) return;
            const frag = document.createDocumentFragment();
            while (idx !== -1) {
                frag.append(text.slice(from, idx));
                const mark = document.createElement('mark');
                mark.textContent = text.slice(idx, idx + query.length);
                frag.append(mark);
                from = idx + query.length;
                idx = hay.indexOf(query, from);
            }
            frag.append(text.slice(from));
            node.replaceWith(frag);
        });
    }

    function apply() {
        const query = norm(input.value.trim());
        let shown = 0;
        items.forEach(item => {
            item.innerHTML = original.get(item);
            if (!query) {
                item.hidden = false;
                item.open = wasOpen.get(item);
                return;
            }
            const match = norm(item.textContent).includes(query);
            item.hidden = !match;
            if (match) {
                shown++;
                item.open = true;
                highlight(item, query);
            }
        });
        // Заголовок группы прячем, если в ней ничего не осталось
        groups.forEach(group => {
            let el = group.nextElementSibling, any = false;
            while (el && !el.matches('.faq-group')) {
                if (el.matches('.faq-item') && !el.hidden) any = true;
                el = el.nextElementSibling;
            }
            group.hidden = !any;
        });
        if (empty) empty.hidden = !query || shown > 0;
    }

    input.addEventListener('input', apply);
    input.addEventListener('keydown', e => {
        if (e.key === 'Escape' && input.value) { input.value = ''; apply(); }
    });
})();
