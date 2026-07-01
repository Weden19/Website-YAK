const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GROUP_ID = 'grp_629eb128-47c7-40c5-848b-c0b8cb8e8a7a';
const BASE_URL = 'https://api.vrchat.cloud/api/1';
const DATA_FILE = path.join(__dirname, '../../data/vrchat.json');

const USERNAME = process.env.VRCHAT_USERNAME;
const PASSWORD = process.env.VRCHAT_PASSWORD;
const TOTP_SECRET = process.env.VRCHAT_TOTP_SECRET;

// Простой CookieJar
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

    // Шаг 1 — логин
    console.log('Logging in...');
    const authRes = await axios.get(`${BASE_URL}/auth/user`, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'YakovlevAcademySiteSync/1.0.0 YakovlevAcademy/1.0.0 (discord.gg/yakovlev-academy)',
      },
    });
    jar.add(authRes.headers['set-cookie']);

    // Шаг 2 — 2FA если нужна
    const requiresTwoFactor = authRes.data?.requiresTwoFactorAuth;
    if (requiresTwoFactor) {
      if (requiresTwoFactor.includes('totp')) {
        console.log('2FA required (TOTP), verifying...');
        const { authenticator } = require('otplib');
        const token = authenticator.generate(TOTP_SECRET.replace(/\s/g, ''));
        const tfaRes = await axios.post(`${BASE_URL}/auth/twofactorauth/totp/verify`,
          { code: token },
          {
            headers: {
              'Cookie': jar.toString(),
              'User-Agent': 'YakovlevAcademySiteSync/1.0.0 YakovlevAcademy/1.0.0 (discord.gg/yakovlev-academy)',
              'Content-Type': 'application/json',
            },
          }
        );
        jar.add(tfaRes.headers['set-cookie']);
        console.log('2FA passed');
      } else if (requiresTwoFactor.includes('emailOtp')) {
        throw new Error('Email OTP 2FA не поддерживается. Переключи на TOTP-приложение в настройках VRChat.');
      }
    }

    const headers = {
      'Cookie': jar.toString(),
      'User-Agent': 'YakovlevAcademySiteSync/1.0.0 YakovlevAcademy/1.0.0 (discord.gg/yakovlev-academy)',
    };

    // Данные группы
    console.log('Fetching group data...');
    const groupRes = await axios.get(`${BASE_URL}/groups/${GROUP_ID}`, { headers });
    const group = groupRes.data;
    const members = group.memberCount || 0;
    console.log(`Members: ${members}`);

    // Ближайший ивент
    let nextEvent = null;
    try {
      const eventsRes = await axios.get(`${BASE_URL}/groups/${GROUP_ID}/instances`, { headers });
      const instances = eventsRes.data || [];
      if (instances.length > 0) {
        const e = instances[0];
        nextEvent = {
          name: e.name || 'Ивент',
          description: e.description || '',
          date: e.queueEnabled ? new Date(e.queueEnabled).toLocaleDateString('ru-RU') : '',
          time: e.queueEnabled ? new Date(e.queueEnabled).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '',
          world: e.world?.name || '–',
        };
      }
    } catch (e) {
      console.warn('Could not fetch events:', e.message);
    }

    // Галерея — сначала получаем galleryId
    let gallery = [];
    try {
      const galleries = group.galleries || [];
      if (galleries.length > 0) {
        const galleryId = galleries[0].id;
        const galleryRes = await axios.get(
          `${BASE_URL}/groups/${GROUP_ID}/galleries/${galleryId}/images`,
          { headers, params: { n: 20 } }
        );
        gallery = (galleryRes.data || [])
          .filter(i => i.fileUrl)
          .map(i => i.fileUrl);
        console.log(`Gallery: ${gallery.length} images`);
      }
    } catch (e) {
      console.warn('Could not fetch gallery:', e.message);
    }

    const data = { members, nextEvent, gallery, updated: new Date().toISOString() };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('Data saved to vrchat.json');

  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
    process.exit(1);
  }
}

main();