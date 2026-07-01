const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { generate } = require('otplib');
const { execSync } = require('child_process');

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
        throw new Error('Аккаунт требует TOTP 2FA, но VRCHAT_TOTP_SECRET не задан.');
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
        throw new Error(`Verify 2FA (totp) failed: ${verifyRes.status}`);
      }
    } else if (requiresTwoFactorAuth.includes('emailOtp')) {
      throw new Error('Аккаунт требует emailOtp 2FA.');
    } else {
      throw new Error(`Неизвестный тип 2FA: ${requiresTwoFactorAuth.join(', ')}`);
    }
    console.log('2FA пройдена');
  }

  console.log('Logged in successfully');
  return jar.header();
}

function safeGitUpdate() {
  try {
    console.log('Syncing with remote repository...');
    execSync(`git checkout origin/main -- "${DATA_FILE}"`, { stdio: 'inherit' });
    execSync('git pull --rebase origin main', { stdio: 'inherit' });
  } catch (err) {
    console.error('Git sync failed, trying hard reset...', err.message);
    try {
      execSync('git reset --hard origin/main', { stdio: 'inherit' });
    } catch (resetErr) {
      throw new Error('Failed to sync git repository');
    }
  }
}

async function fetchGallery(cookies) {
  // Твоя существующая логика галереи — не трогаю
  try {
    const headers = { 'Cookie': cookies, 'User-Agent': USER_AGENT };
    const groupRes = await axios.get(`${BASE_URL}/groups/${GROUP_ID}`, { headers });
    const galleries = groupRes.data.galleries || [];
    
    if (galleries.length === 0) return [];
    
    const galleryId = galleries[0].id;
    const galleryRes = await axios.get(
      `${BASE_URL}/groups/${GROUP_ID}/galleries/${galleryId}`,
      { headers }
    );
    
    const items = galleryRes.data || [];
    return items
      .filter(i => i.imageUrl)
      .slice(0, 20)
      .map(i => i.imageUrl);
  } catch (e) {
    console.warn('Gallery fetch failed:', e.response?.status, e.response?.data || e.message);
    return [];
  }
}

async function main() {
  try {
    safeGitUpdate();

    const cookies = await login();
    const headers = {
      'Cookie': cookies,
      'User-Agent': USER_AGENT,
    };

    // Участники
    console.log('Fetching group data...');
    const groupRes = await axios.get(`${BASE_URL}/groups/${GROUP_ID}`, { headers });
    const group = groupRes.data;
    const members = group.memberCount || 0;
    console.log(`Members: ${members}`);

    // Ивенты через инстансы группы
    let nextEvent = null;
    try {
      console.log('Fetching group instances...');
      const instancesRes = await axios.get(`${BASE_URL}/groups/${GROUP_ID}/instances`, { 
        headers,
        params: { n: 10 }
      });
      
      const instances = instancesRes.data || [];
      console.log(`Instances count: ${instances.length}`);
      
      if (instances.length > 0) {
        const inst = instances[0];
        const createdDate = new Date(inst.createdAt || Date.now());
        
        nextEvent = {
          name: inst.name || 'Ивент',
          description: inst.description || '',
          date: createdDate.toLocaleDateString('ru-RU'),
          time: createdDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          world: inst.world?.name || inst.worldName || '–',
        };
        console.log(`Next event: ${nextEvent.name}`);
      }
    } catch (e) {
      console.warn('Could not fetch instances:', e.response?.status, e.response?.data || e.message);
    }

    // Галерея — твоя рабочая логика
    const gallery = await fetchGallery(cookies);
    console.log(`Gallery: ${gallery.length} images`);

    const data = { 
      members, 
      nextEvent, 
      gallery,
      updated: new Date().toISOString() 
    };
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('Data saved to vrchat.json');

  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
    process.exit(1);
  }
}

main();