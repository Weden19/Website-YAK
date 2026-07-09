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

    // Ближайший запланированный ивент группы.
    // /groups/{id}/instances показывает только то, что открыто ПРЯМО СЕЙЧАС (активные инстансы),
    // поэтому раньше nextEvent всегда оставался null, если в момент запуска никто не сидел в мире.
    // Правильный источник запланированных ивентов — отдельный Calendar API.
    let nextEvent = null;
    try {
      const eventRes = await axios.get(`${BASE_URL}/calendar/${GROUP_ID}/next`, { headers });
      const e = eventRes.data;
      if (e) {
        const starts = e.startsAt ? new Date(e.startsAt) : null;
        nextEvent = {
          name: e.title || 'Ивент',
          description: e.description || '',
          date: starts ? starts.toLocaleDateString('ru-RU') : '',
          time: starts ? starts.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '',
        };
        console.log(`Next event: ${nextEvent.name} (${nextEvent.date} ${nextEvent.time})`);
      }
    } catch (e) {
      if (e.response?.status === 404) {
        console.log('No upcoming calendar event scheduled');
      } else {
        console.warn('Could not fetch next event:', e.response?.data || e.message);
      }
    }

    // Галерея группы.
    // Путь /groups/{id}/galleries/{galleryId}/images принимает только POST (добавление картинки модератором) —
    // GET туда давал 405. Верный путь для чтения списка — БЕЗ /images на конце.
    // Поле с URL картинки в ответе называется imageUrl, а не fileUrl.
    let gallery = [];
    try {
      const galleries = group.galleries || [];
      if (galleries.length > 0) {
        const galleryId = galleries[0].id;
        console.log(`Using gallery "${galleries[0].name}" (${galleryId})`);
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

    const data = { members, nextEvent, gallery, updated: new Date().toISOString() };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('Data saved to vrchat.json');

  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
    process.exit(1);
  }
}