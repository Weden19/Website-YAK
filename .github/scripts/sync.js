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

    // Ближайший ивент - используем инстансы группы как замену событий
    let nextEvent = null;
    try {
      console.log('Fetching group instances...');
      const instancesRes = await axios.get(`${BASE_URL}/groups/${GROUP_ID}/instances`, { 
        headers,
        params: {
          n: 10
        }
      });
      console.log('Instances response status:', instancesRes.status);
      console.log('Instances count:', instancesRes.data?.length || 0);
      
      const instances = instancesRes.data || [];
      
      if (instances.length > 0) {
        // Фильтруем активные инстансы с датой
        const activeInstances = instances.filter(i => i.active && i.worldId);
        
        if (activeInstances.length > 0) {
          const inst = activeInstances[0];
          const createdDate = new Date(inst.createdAt || Date.now());
          
          nextEvent = {
            name: inst.name || 'Ивент',
            description: inst.description || '',
            date: createdDate.toLocaleDateString('ru-RU'),
            time: createdDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
            world: inst.world?.name || inst.worldName || '–',
          };
        }
      }
      console.log(`Next event:`, nextEvent ? nextEvent.name : 'none');
    } catch (e) {
      console.warn('Could not fetch instances:', e.response?.status, e.response?.data || e.message);
    }

    // Галерея группы - пробуем разные варианты
    let gallery = [];
    try {
      const galleries = group.galleries || [];
      console.log('Galleries from group data:', JSON.stringify(galleries, null, 2));
      
      if (galleries.length > 0) {
        const galleryId = galleries[0].id;
        console.log(`Using gallery ID: ${galleryId}`);
        
        // Пробуем POST вместо GET
        try {
          console.log('Trying POST method...');
          const imagesRes = await axios.post(
            `${BASE_URL}/groups/${GROUP_ID}/galleries/${galleryId}/images`,
            {},
            { 
              headers, 
              params: { n: 20 }
            }
          );
          const items = imagesRes.data || [];
          console.log('POST response:', JSON.stringify(items, null, 2));
          gallery = items
            .filter(i => i.imageUrl)
            .slice(0, 20)
            .map(i => i.imageUrl);
          console.log(`Gallery via POST: ${gallery.length} images`);
        } catch (postErr) {
          console.log('POST failed:', postErr.response?.status, postErr.response?.data || postErr.message);
          console.log('Trying alternative endpoint...');
          
          // Альтернативный вариант - получаем детали галереи
          try {
            const galleryRes = await axios.get(
              `${BASE_URL}/groups/${GROUP_ID}/galleries/${galleryId}`,
              { headers }
            );
            console.log('Gallery detail response:', JSON.stringify(galleryRes.data, null, 2));
            
            // Если в ответе есть images массив
            if (galleryRes.data.images && Array.isArray(galleryRes.data.images)) {
              gallery = galleryRes.data.images
                .filter(i => i.imageUrl)
                .slice(0, 20)
                .map(i => i.imageUrl);
              console.log(`Gallery via detail: ${gallery.length} images`);
            }
          } catch (detailErr) {
            console.warn('Gallery detail also failed:', detailErr.response?.status, detailErr.response?.data || detailErr.message);
          }
        }
      } else {
        console.warn('У группы нет ни одной галереи');
      }
      console.log(`Final gallery: ${gallery.length} images`);
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