// ===== ССЫЛКИ НА ПУНКТЫ ПРАВИЛ =====
// Клик по номеру пункта: переходим к нему (подсветка через :target) и копируем ссылку
document.querySelectorAll('.rule-num').forEach(link => {
    link.addEventListener('click', async () => {
        const url = new URL(link.getAttribute('href'), location.href).href;
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            return; // нет доступа к буферу — остаётся обычный переход по якорю
        }
        link.classList.add('copied');
        setTimeout(() => link.classList.remove('copied'), 1500);
    });
});
