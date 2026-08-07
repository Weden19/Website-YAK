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

        // ===== EVENTS: fetch upcoming events and pick week's events per rule =====
        const events = [];
        // temporary holder for earliest upcoming event
        var __nextEventTemp = null;
        try {
            const tryUrls = [
                `${BASE_URL}/calendar/${GROUP_ID}/week`,
                `${BASE_URL}/calendar/${GROUP_ID}/events`,
                `${BASE_URL}/calendar/${GROUP_ID}`,
                `${BASE_URL}/calendar/${GROUP_ID}/next?n=50`,
                `${BASE_URL}/calendar/${GROUP_ID}/next`,
            ];

            let fetched = null;
            for (const url of tryUrls) {
                try {
                    const res = await axios.get(url, { headers });
                    if (!res || res.status >= 400) continue;
                    const d = res.data;
                    if (!d) continue;
                    if (Array.isArray(d)) { fetched = d; break; }
                    if (Array.isArray(d.data)) { fetched = d.data; break; }
                    if (Array.isArray(d.events)) { fetched = d.events; break; }
                    if (d && (d.startsAt || d.start || d.title || d.name)) { fetched = [d]; break; }
                } catch (err) {
                    // try next
                }
            }

            function parseStarts(e) {
                if (!e) return null;
                if (e.startsAt) {
                    const d = new Date(e.startsAt);
                    if (!Number.isNaN(d.getTime())) return d;
                }
                if (e.start) {
                    const d = new Date(e.start);
                    if (!Number.isNaN(d.getTime())) return d;
                }
                if (typeof e.date === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(e.date)) {
                    const [day, month, year] = e.date.split('.').map(Number);
                    const [hours = 0, minutes = 0] = (typeof e.time === 'string' && e.time.includes(':')) ? e.time.split(':').map(Number) : [0,0];
                    const moscowOffsetMs = 3 * 60 * 60 * 1000;
                    return new Date(Date.UTC(year, month - 1, day, hours, minutes) - moscowOffsetMs);
                }
                return null;
            }

            function getMoscowWeekStart(date) {
                const moscowOffsetMs = 3 * 60 * 60 * 1000;
                const ms = date.getTime() + moscowOffsetMs;
                const m = new Date(ms);
                const year = m.getUTCFullYear();
                const month = m.getUTCMonth();
                const day = m.getUTCDate();
                const weekday = m.getUTCDay() || 7; // Monday=1
                const mondayLocal = new Date(Date.UTC(year, month, day - (weekday - 1)));
                return new Date(mondayLocal.getTime() - moscowOffsetMs);
            }

            const allParsed = [];
            if (fetched && fetched.length) {
                for (const e of fetched) {
                    const starts = parseStarts(e);
                    allParsed.push({ raw: e, name: e.title || e.name || 'Ивент', description: e.description || '', date: e.date || (starts ? starts.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : ''), time: e.time || (starts ? starts.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }) : ''), starts });
                }
            }

            // also try 'next' to ensure we have upcoming
            try {
                const res = await axios.get(`${BASE_URL}/calendar/${GROUP_ID}/next`, { headers });
                const e = res.data;
                if (e) {
                    const starts = parseStarts(e);
                    allParsed.push({ raw: e, name: e.title || e.name || 'Ивент', description: e.description || '', date: e.date || (starts ? starts.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : ''), time: e.time || (starts ? starts.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }) : ''), starts });
                }
            } catch (err) {
                // ignore
            }

            const now = new Date();
            const parsedWithStarts = allParsed.filter(p => p.starts && !Number.isNaN(p.starts.getTime()));

            const groups = new Map();
            for (const p of parsedWithStarts) {
                const wk = getMoscowWeekStart(p.starts).toISOString();
                if (!groups.has(wk)) groups.set(wk, []);
                groups.get(wk).push(p);
            }

            const currentWeekStart = getMoscowWeekStart(now).toISOString();
            const nextWeekStart = new Date(new Date(currentWeekStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

            let chosen = [];
            if ((groups.get(currentWeekStart) || []).length > 1) {
                chosen = groups.get(currentWeekStart) || [];
                console.log('Using current week events');
            } else {
                chosen = groups.get(nextWeekStart) || [];
                console.log('Using next week events');
            }

            chosen.sort((a, b) => a.starts - b.starts);

            const seen = new Set();
            for (const p of chosen) {
                const key = `${p.name}||${p.date}||${p.time}`;
                if (seen.has(key)) continue;
                seen.add(key);
                events.push({ name: p.name, description: p.description, date: p.date, time: p.time });
            }

            const upcomingAll = allParsed.filter(p => p.starts && p.starts >= now).sort((a,b) => a.starts - b.starts);
            const nextEventObj = upcomingAll.length ? upcomingAll[0] : null;
            __nextEventTemp = nextEventObj ? { name: nextEventObj.name, description: nextEventObj.description, date: nextEventObj.date, time: nextEventObj.time } : null;

            if (events.length) console.log(`Prepared ${events.length} event(s) for display`);
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
            nextEvent: (typeof __nextEventTemp !== 'undefined' && __nextEventTemp) ? __nextEventTemp : (events[0] || null),
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
