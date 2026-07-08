const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GROUP_ID = 'grp_629eb128-47c7-40c5-848b-c0b8cb8e8a7a';
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

    let nextEvent = null;
    try {
      const eventsRes = await axios.get(`${BASE_URL}/groups/${GROUP_ID}/instances`, { headers });
      const instances = eventsRes.data || [];
      if (instances.length > 0) {
        const e = instances[0];
        nextEvent = {
          name: e.name || 'Ивент',
          description: e.description || '',
          date: e.queueEnabled ? new Date(e.queueEnabled).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '',
          time: e.queueEnabled ? new Date(e.queueEnabled).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }) : '',
          world: e.world?.name || '–',
        };
      }
    } catch (e) {
      console.warn('Could not fetch events:', e.message);
    }

    let gallery = [];
    try {
      // Сначала получаем список галерей группы
      const galleriesRes = await axios.get(`${BASE_URL}/groups/${GROUP_ID}/galleries`, { headers });
      const galleries = galleriesRes.data || [];
      console.log(`Found ${galleries.length} galleries`);
      if (galleries.length > 0) {
        const galleryId = galleries[0].id;
        console.log('Gallery ID:', galleryId);
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