const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GROUP_ID = 'grp_629eb128-47c7-40c5-848b-c0b8cb8e8a7a';
const BASE_URL = 'https://api.vrchat.cloud/api/1';
const DATA_FILE = path.join(__dirname, '../../data/vrchat.json');

const USERNAME = process.env.VRCHAT_USERNAME;
const PASSWORD = process.env.VRCHAT_PASSWORD;

async function main() {
  try {
    console.log('Logging in to VRChat...');
    const credentials = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

    const authRes = await axios.get(`${BASE_URL}/auth/user`, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'User-Agent': 'YakovlevAcademy-SiteSync/1.0 (github-actions)',
      },
    });

    const cookies = authRes.headers['set-cookie']?.join('; ') || '';
    console.log('Logged in successfully');

    const headers = {
      'Cookie': cookies,
      'User-Agent': 'YakovlevAcademy-SiteSync/1.0 (github-actions)',
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

    // Галерея группы
    let gallery = [];
    try {
      const galleryRes = await axios.get(`${BASE_URL}/groups/${GROUP_ID}/gallery`, { headers });
      const items = galleryRes.data || [];
      gallery = items
        .filter(i => i.imageUrl)
        .slice(0, 20)
        .map(i => i.imageUrl);
      console.log(`Gallery: ${gallery.length} images`);
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
