const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GROUP_ID = 'grp_629eb128-47c7-40c5-848b-c0b8cb8e8a7a';
const GALLERY_NAME = 'Фотографии группы';
const BASE_URL = 'https://api.vrchat.cloud/api/1';
const DATA_FILE = path.join(__dirname, '../../data/vrchat.json');
const UA = 'YakovlevAcademy/1.0.0 (bot; +discord.gg/yakovlev-academy)';

const USERNAME = process.env.VRCHAT_USERNAME;
const PASSWORD = process.env.VRCHAT_PASSWORD;
const TOTP_SECRET = process.env.VRCHAT_TOTP_SECRET;

class CookieJar {
    constructor() { this.cookies = {}; }
    add(setCookieHeaders) {
        if (!setCookieHeaders) return;
        const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
        list.forEach(h => {
            const [pair] = h.split(';');
            const [k, v] = pair.split('=');
            if (k && v) this.cookies[k.trim()] = v.trim();
        });
    }
    toString() {
        return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    }
}

// ===== Moscow week helpers =====
function getMoscowWeekStart(date) {
    const moscowOffsetMs = 3 * 60 * 60 * 1000;
    const localMs = date.getTime() + moscowOffsetMs;
    const localDate = new Date(localMs);
    const weekday = localDate.getUTCDay() || 7;
    const monday = new Date(Date.UTC(
        localDate.getUTCFullYear(),
        localDate.getUTCMonth(),
        localDate.getUTCDate() - (weekday - 1)
    ));
    return new Date(monday.getTime() - moscowOffsetMs);
}

// ===== Fetch events from the ONE real endpoint =====
// GET /calendar/{groupId}?date=<month>&n=<1..100>&offset=0
// "date" = месяц поиска (по докам). Без него поведение недокументировано,
// поэтому дергаем явно текущий и следующий месяц и мержим по id.
async function fetchGroupCalendarEvents(headers) {
    const now = new Date();
    const monthDates = [0, 1, 2].map(offset =>
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1)).toISOString()
    );

    const byId = new Map();

    for (const monthDate of monthDates) {
        try {
            const res = await axios.get(`${BASE_URL}/calendar/${GROUP_ID}`, {
                headers,
                params: { date: monthDate, n: 100, offset: 0 },
            });
            const results = Array.isArray(res.data?.results) ? res.data.results : [];
            console.log(`[calendar] date=${monthDate} -> ${results.length} events (hasNext=${res.data?.hasNext}, totalCount=${res.data?.totalCount})`);
            for (const ev of results) {
                console.log(`  - id=${ev.id} title="${ev.title}" startsAt=${ev.startsAt} isDraft=${ev.isDraft} deletedAt=${ev.deletedAt}`);
                if (ev.isDraft) continue;      // черновики не показываем
                if (ev.deletedAt) continue;    // удалённые не показываем
                if (!ev.id || !byId.has(ev.id)) {
                    byId.set(ev.id || `${ev.title}|${ev.startsAt}`, ev);
                }
            }
        } catch (err) {
            console.warn(`[calendar] Failed for date=${monthDate}:`, err.response?.status, err.response?.data || err.message);
        }
    }

    return Array.from(byId.values());
}

async function main() {
    try {
        const jar = new CookieJar();
        const credentials = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

        console.log('User-Agent:', UA);
        console.log('Logging in...');

        const authRes = await axios.get(`${BASE_URL}/auth/user`, {
            headers: {
                'Authorization': `Basic ${credentials}`,
                'User-Agent': UA,
            },
        });
        jar.add(authRes.headers['set-cookie']);

        const requiresTwoFactor = authRes.data?.requiresTwoFactorAuth;
        if (requiresTwoFactor) {
            if (requiresTwoFactor.includes('totp')) {
                console.log('2FA required (TOTP), verifying...');
                const otplib = require('otplib');
                const secret = TOTP_SECRET.replace(/\s/g, '');
                const result = await otplib.generate({ secret, encoding: 'base32' });
                const token = typeof result === 'string' ? result : result.otp || result.token || String(result);
                console.log('TOTP token:', token);

                const tfaRes = await axios.post(`${BASE_URL}/auth/twofactorauth/totp/verify`,
                    { code: token },
                    {
                        headers: {
                            'Cookie': jar.toString(),
                            'User-Agent': UA,
                            'Content-Type': 'application/json',
                        },
                    }
                );
                jar.add(tfaRes.headers['set-cookie']);
                console.log('2FA passed');
            } else if (requiresTwoFactor.includes('emailOtp')) {
                throw new Error('Email OTP не поддерживается. Переключи на TOTP.');
            }
        }

        console.log('Logged in successfully');

        const headers = {
            'Cookie': jar.toString(),
            'User-Agent': UA,
        };

        console.log('Fetching group data...');
        const groupRes = await axios.get(`${BASE_URL}/groups/${GROUP_ID}`, { headers });
        const group = groupRes.data;
        const members = group.memberCount || 0;
        console.log(`Members: ${members}`);

        // ===== EVENTS =====
        const events = [];
        let nextEvent = null;
        try {
            const rawEvents = await fetchGroupCalendarEvents(headers);

            const DEFAULT_DURATION_MS = 60 * 60 * 1000; // 1 час — совпадает с допущением в main.js (getEventDisplayState)

            const parsed = rawEvents
                .map(e => {
                    const starts = e.startsAt ? new Date(e.startsAt) : null;
                    if (!starts || Number.isNaN(starts.getTime())) return null;
                    const endsRaw = e.endsAt ? new Date(e.endsAt) : null;
                    const ends = (endsRaw && !Number.isNaN(endsRaw.getTime()))
                        ? endsRaw
                        : new Date(starts.getTime() + DEFAULT_DURATION_MS);
                    return {
                        id: e.id,
                        name: e.title || 'Ивент',
                        description: e.description || '',
                        date: starts.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }),
                        time: starts.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }),
                        starts,
                        ends,
                    };
                })
                .filter(Boolean)
                .sort((a, b) => a.starts - b.starts);

            const now = new Date();
            const groups = new Map();
            for (const p of parsed) {
                const wk = getMoscowWeekStart(p.starts).toISOString();
                if (!groups.has(wk)) groups.set(wk, []);
                groups.get(wk).push(p);
            }

            const currentWeekStart = getMoscowWeekStart(now).toISOString();
            const nextWeekStart = new Date(new Date(currentWeekStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

            const currentWeekEvents = groups.get(currentWeekStart) || [];
            const nextWeekEvents = groups.get(nextWeekStart) || [];

            // Ивенты текущей недели, которые ещё не прошли: считаем прошедшим,
            // только когда now >= ends (а не now >= starts — иначе ивент исчезал бы
            // из выдачи в момент старта, хотя main.js ещё час показывает "Проходит")
            const currentWeekUpcoming = currentWeekEvents.filter(p => now < p.ends);

            let chosen;
            if (currentWeekUpcoming.length > 0) {
                chosen = currentWeekUpcoming;
                console.log(`Using current week (upcoming only): ${chosen.length} event(s)`);
            } else {
                chosen = nextWeekEvents;
                console.log(`Current week has no upcoming events -> using next week: ${chosen.length} event(s)`);
            }

            for (const p of chosen) {
                events.push({ name: p.name, description: p.description, date: p.date, time: p.time });
            }

            const upcoming = parsed.filter(p => now < p.ends);
            if (upcoming.length) {
                const n = upcoming[0];
                nextEvent = { name: n.name, description: n.description, date: n.date, time: n.time };
            }

            console.log(`Prepared ${events.length} event(s) for display`);
        } catch (e) {
            console.warn('Could not fetch events list:', e.response?.data || e.message);
        }

        let gallery = [];
        try {
            const galleries = group.galleries || [];
            if (galleries.length > 0) {
                const target = galleries.find(g => g.name === GALLERY_NAME) || galleries[0];
                const galleryId = target.id;
                console.log(`Using gallery "${target.name}" (${galleryId})`);

                const galleryRes = await axios.get(
                    `${BASE_URL}/groups/${GROUP_ID}/galleries/${galleryId}`,
                    { headers, params: { n: 20, approved: true } }
                );
                gallery = (galleryRes.data || [])
                    .filter(i => i.imageUrl)
                    .map(i => i.imageUrl);
                console.log(`Gallery: ${gallery.length} images`);
            } else {
                console.warn('У группы нет ни одной галереи (group.galleries пуст)');
            }
        } catch (e) {
            console.warn('Could not fetch gallery:', e.response?.data || e.message);
        }

        const data = {
            members,
            events,
            nextEvent: nextEvent || events[0] || null,
            gallery,
            updated: new Date().toISOString(),
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
        console.log('Data saved to vrchat.json');

    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
        process.exit(1);
    }
}

main();