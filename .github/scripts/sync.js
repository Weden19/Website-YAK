const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { generate } = require('otplib');

const GROUP_ID = 'grp_629eb128-47c7-40c5-848b-c0b8cb8e8a7a';
const BASE_URL = 'https://api.vrchat.cloud/api/1';
const DATA_FILE = path.join(__dirname, '../../data/vrchat.json');
const USER_AGENT = 'YakovlevAcademy-SiteSync/1.0 (github-actions; contact: vvsyak admin)';

const USERNAME = process.env.VRCHAT_USERNAME;
const PASSWORD = process.env.VRCHAT_PASSWORD;
const TOTP_SECRET = process.env.VRCHAT_TOTP_SECRET;

class CookieJar {
  constructor() {
    this.jar = new Map();
  }
  update(setCookieHeaders) {
    if (!setCookieHeaders) return;
    for (const raw of setCookieHeaders) {
      const pair = raw.split(';')[0];
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      this.jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }
  header() {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function login() {
  const jar = new CookieJar();
  const credentials = Buffer.from(`${encodeURIComponent(USERNAME)}:${encodeURIComponent(PASSWORD)}`).toString('base64');

  console.log('Logging in to VRChat...');
  const authRes = await axios.get(`${BASE_URL}/auth/user`, {
    headers: {
      'Authorization': `Basic ${credentials}`,
      'User-Agent': USER_AGENT,
    },
    validateStatus: () => true,
  });
  jar.update(authRes.headers['set-cookie']);

  if (authRes.status !== 200) {
    throw new Error(`Login failed: ${authRes.status} ${JSON.stringify(authRes.data)}`);
  }

  const requiresTwoFactorAuth = authRes.data?.requiresTwoFactorAuth;

  if (requiresTwoFactorAuth && requiresTwoFactorAuth.length > 0) {
    if (requiresTwoFactorAuth.includes('totp')) {
      if (!TOTP_SECRET) {
        throw new Error('Аккаунт требует TOTP 2FA, но VRCHAT_TOTP_SECRET не задан в секретах.');
      }
      console.log('Аккаунт требует TOTP-код, отправляю...');
      const code = await generate({ secret: TOTP_SECRET });
      const verifyRes = await axios.post(
        `${BASE_URL}/auth/twofactorauth/totp/verify`,
        { code },
        { headers: { 'Cookie': jar.header(), 'User-Agent': USER_AGENT }, validateStatus: () => true }
      );
      jar.update(verifyRes.headers['set-cookie']);
      if (verifyRes.status !== 200 || verifyRes.data?.verified !== true) {
        throw new Error(`Verify 2FA (totp) failed: ${verifyRes.status} ${JSON.stringify(verifyRes.data)}`);
      }
    } else if (requiresTwoFactorAuth.includes('emailOtp')) {
      throw new Error('Аккаунт требует emailOtp 2FA — это нельзя пройти автоматически. Переключи 2FA на TOTP (Authenticator app).');
    } else {
      throw new Error(`Неизвестный тип 2FA: ${requiresTwoFactorAuth.join(', ')}`);
    }
    console.log('2FA пройдена');
  }

  console.log('Logged in successfully');
  return jar.header();
}

async function main() {
  try {
    const cookies = await login();

    const headers = {
      'Cookie': cookies,
      'User-Agent': USER_AGENT,
    };

    // Данные группы
    console.log('Fetching group data...');
    const groupRes = await axios.get(`${BASE_URL}/groups/${GROUP_ID}`, { headers });
    const group = groupRes.data;
    const members = group.memberCount || 0;
    console.log(`Members: ${members}`);

    // Ближайший ивент - используем правильный эндпоинт для событий группы
    let nextEvent = null;
    try {
      // Получаем события группы через events эндпоинт
      const eventsRes = await axios.get(`${BASE_URL}/groups/${GROUP_ID}/events`, { 
        headers,
        params: {
          n: 5,
          order: 'ascending',
          after: new Date().toISOString()
        }
      });
      const events = eventsRes.data || [];
      
      if (events.length > 0) {
        const e = events[0];
        const eventDate = new Date(e.startTime || e.date);
        nextEvent = {
          name: e.name || 'Ивент',
          description: e.description || '',
          date: eventDate.toLocaleDateString('ru-RU'),
          time: eventDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          world: e.location?.split('~')[0] || '–',
        };
      }
      console.log(`Events found: ${events.length}`);
    } catch (e) {
      console.warn('Could not fetch events:', e.response?.status, e.response?.data || e.message);
    }

    // Галерея группы
    let gallery = [];
    try {
      // Проверяем структуру group.galleries
      const galleries = group.galleries || [];
      console.log(`Galleries structure:`, JSON.stringify(galleries.slice(0, 2)));
      
      if (galleries.length > 0) {
        const galleryId = galleries[0].id || galleries[0].galleryId;
        console.log(`Using gallery ID: ${galleryId}`);
        
        if (galleryId) {
          const imagesRes = await axios.get(
            `${BASE_URL}/groups/${GROUP_ID}/galleries/${galleryId}/images`,
            { 
              headers, 
              params: { n: 20 }
            }
          );
          const items = imagesRes.data || [];
          console.log(`Gallery images response:`, items.length, 'items');
          
          gallery = items
            .filter(i => i.imageUrl)
            .slice(0, 20)
            .map(i => i.imageUrl);
        }
      } else {
        console.warn('У группы нет ни одной галереи (group.galleries пуст)');
      }
      console.log(`Gallery: ${gallery.length} images`);
    } catch (e) {
      console.warn('Could not fetch gallery:', e.response?.status, e.response?.data || e.message);
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