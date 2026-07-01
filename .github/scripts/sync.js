const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { generate } = require('otplib');
const { execSync } = require('child_process');

const GROUP_ID = 'grp_629eb128-47c7-40c5-848b-c0b8cb8e8a7a';
const BASE_URL = 'https://api.vrchat.cloud/api/1';
const DATA_FILE = path.join(__dirname, '../../data/vrchat.json');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const USERNAME = process.env.VRCHAT_USERNAME;
const PASSWORD = process.env.VRCHAT_PASSWORD;
const TOTP_SECRET = process.env.VRCHAT_TOTP_SECRET;

class CookieJar {
  constructor() { this.jar = new Map(); }
  update(setCookieHeaders) {
    if (!setCookieHeaders) return;
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const raw of headers) {
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
    headers: { 'Authorization': `Basic ${credentials}`, 'User-Agent': USER_AGENT },
    validateStatus: () => true,
  });
  jar.update(authRes.headers['set-cookie']);

  if (authRes.status !== 200) throw new Error(`Login failed: ${authRes.status}`);

  const requiresTwoFactorAuth = authRes.data?.requiresTwoFactorAuth;
  if (requiresTwoFactorAuth && requiresTwoFactorAuth.length > 0) {
    if (requiresTwoFactorAuth.includes('totp')) {
      if (!TOTP_SECRET) throw new Error('Требуется TOTP, но секрет не задан.');
      console.log('Отправка TOTP кода...');
      const code = await generate({ secret: TOTP_SECRET });
      const verifyRes = await axios.post(
        `${BASE_URL}/auth/twofactorauth/totp/verify`,
        { code },
        { headers: { 'Cookie': jar.header(), 'User-Agent': USER_AGENT }, validateStatus: () => true }
      );
      jar.update(verifyRes.headers['set-cookie']);
      if (verifyRes.status !== 200 || verifyRes.data?.verified !== true) throw new Error('2FA Failed');
    } else {
      throw new Error(`Неподдерживаемый тип 2FA: ${requiresTwoFactorAuth.join(', ')}`);
    }
  }
  console.log('Logged in successfully');
  return jar.header();
}

function safeGitUpdate() {
  try {
    console.log('Syncing git...');
    execSync(`git checkout origin/main -- "${DATA_FILE}"`, { stdio: 'inherit' });
    execSync('git pull --rebase origin main', { stdio: 'inherit' });
  } catch (err) {
    console.error('Git sync failed, resetting...', err.message);
    execSync('git reset --hard origin/main', { stdio: 'inherit' });
  }
}

// Новый эндпоинт для запланированных ивентов
async function fetchNextEvent(cookies) {
  try {
    console.log('Fetching next event from calendar API...');
    const headers = { 'Cookie': cookies, 'User-Agent': USER_AGENT };
    
    // Используем правильный эндпоинт /calendar/{groupId}/next
    const res = await axios.get(`${BASE_URL}/calendar/${GROUP_ID}/next`, { headers });
    
    const event = res.data;
    if (!event) {
      console.log('No upcoming events found');
      return null;
    }

    const startDate = new Date(event.startTime || event.startDate);
    console.log(`Next event: ${event.name} on ${startDate.toLocaleDateString('ru-RU')}`);

    return {
      name: event.name || 'Ивент',
      description: event.description || '',
      date: startDate.toLocaleDateString('ru-RU'),
      time: startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      world: event.world?.name || event.location || '–',
    };
  } catch (e) {
    console.warn('Calendar API fetch failed:', e.response?.status, e.response?.data || e.message);
    return null;
  }
}

async function fetchGallery(cookies) {
  try {
    const headers = { 'Cookie': cookies, 'User-Agent': USER_AGENT };
    const groupRes = await axios.get(`${BASE_URL}/groups/${GROUP_ID}`, { headers });
    const galleries = groupRes.data.galleries || [];
    
    const targetGallery = galleries.find(g => g.name === 'Фотографии группы');
    
    if (!targetGallery) {
      console.warn('Галерея "Фотографии группы" не найдена!');
      return [];
    }
    
    console.log(`Using gallery: ${targetGallery.name}`);
    
    const galleryRes = await axios.get(
      `${BASE_URL}/groups/${GROUP_ID}/galleries/${targetGallery.id}`,
      { headers }
    );
    
    const items = galleryRes.data || [];
    return items.filter(i => i.imageUrl).slice(0, 20).map(i => i.imageUrl);
  } catch (e) {
    console.warn('Gallery fetch failed:', e.message);
    return [];
  }
}

async function main() {
  try {
    safeGitUpdate();
    const cookies = await login();

    // Участники
    const groupRes = await axios.get(`${BASE_URL}/groups/${GROUP_ID}`, {
      headers: { 'Cookie': cookies, 'User-Agent': USER_AGENT }
    });
    const members = groupRes.data.memberCount || 0;
    console.log(`Members: ${members}`);

    // Ивенты через правильный эндпоинт calendar
    let nextEvent = await fetchNextEvent(cookies);
    
    // Галерея
    const gallery = await fetchGallery(cookies);
    console.log(`Gallery: ${gallery.length} images`);

    const data = { members, nextEvent, gallery, updated: new Date().toISOString() };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('Data saved.');

  } catch (err) {
    console.error('Fatal Error:', err.message);
    process.exit(1);
  }
}

main();