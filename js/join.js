// ===== КАК ВСТУПИТЬ: ближайший ивент из vrchat.json =====
(async function () {
    const el = document.getElementById('joinNextEvent');
    if (!el) return;
    const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
    const DURATION_MS = 2 * 60 * 60 * 1000; // как в main.js

    function parse(event) {
        const d = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(event?.date || '');
        const t = /^(\d{1,2}):(\d{2})$/.exec(event?.time || '');
        if (!d) return null;
        const [hh, mm] = t ? [Number(t[1]), Number(t[2])] : [0, 0];
        return new Date(Date.UTC(Number(d[3]), Number(d[2]) - 1, Number(d[1]), hh, mm) - MSK_OFFSET_MS);
    }

    try {
        const res = await fetch('/data/vrchat.json');
        if (!res.ok) return;
        const data = await res.json();
        const now = Date.now();
        const next = (data.events || [])
            .map(e => ({ e, start: parse(e) }))
            .filter(x => x.start && x.start.getTime() + DURATION_MS > now)
            .sort((a, b) => a.start - b.start)[0];
        if (!next) return;
        const live = next.start.getTime() <= now;
        const en = document.documentElement.lang === 'en';
        el.textContent = en
            ? `${live ? 'Live now' : 'Next'}: ${next.e.name} — ${next.e.date} at ${next.e.time} MSK`
            : `${live ? 'Идёт сейчас' : 'Ближайший'}: ${next.e.name} — ${next.e.date} в ${next.e.time} МСК`;
        el.hidden = false;
    } catch {
        // без ближайшего ивента шаг всё равно понятен
    }
})();
