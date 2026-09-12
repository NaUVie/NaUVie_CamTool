const express = require('express');
const path = require('path');
const fs = require('fs');

// Simple .env parser to ensure environment variables are loaded if .env exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...vals] = trimmed.split('=');
      if (key && vals.length > 0) {
        process.env[key.trim()] = vals.join('=').trim();
      }
    }
  });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const GAMES = {
  '98664161516921': 'Catch a Monster',
  '107778070777162': 'Steal An Egg',
  '74102906764176': 'Greedy Growers'
};

const DEFAULT_PLACE_ID = '98664161516921';

// Central memory cache per game
let globalCaches = {};
Object.keys(GAMES).forEach(pid => {
  globalCaches[pid] = {
    servers: [],
    lastUpdated: null,
    isFirstFetchDone: false,
    error: null
  };
});

// 12 seconds sync interval
const SYNC_INTERVAL = 12 * 1000; 

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Clean URL routes
app.get(['/SAE', '/sae'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sae.html'));
});
app.get(['/GG', '/gg'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gg.html'));
});
app.get(['/secret', '/secret.html', '/SECRET', '/Secret'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'secret.html'));
});

// Admin Auth API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const validUsername = process.env.ADMIN_USERNAME || 'Admin';
  const validPassword = process.env.ADMIN_PASSWORD || 'Trieu25032005@';

  if (username === validUsername && password === validPassword) {
    return res.json({
      success: true,
      token: 'nauvie_secret_admin_authenticated_' + Date.now(),
      message: 'Đăng nhập thành công!'
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Tài khoản hoặc mật khẩu không chính xác!'
  });
});

// Fetch Game Name / Details from Roblox API by Place ID
app.get('/api/game-info', async (req, res) => {
  const placeId = req.query.placeId || req.query.place_id;
  if (!placeId) {
    return res.status(400).json({ success: false, error: 'Thiếu Place ID' });
  }

  // Check static list first for ultra speed
  if (GAMES[placeId]) {
    return res.json({
      success: true,
      placeId,
      name: GAMES[placeId]
    });
  }

  try {
    // 1st attempt: Roblox multiget-place-details API
    const url = `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0 && data[0].name) {
        return res.json({
          success: true,
          placeId,
          name: data[0].name
        });
      }
    }

    // 2nd attempt: Roblox Universe Place API fallback
    const universeUrl = `https://apis.roblox.com/universes/v1/places/${placeId}`;
    const univRes = await fetch(universeUrl);
    if (univRes.ok) {
      const univData = await univRes.json();
      if (univData.name) {
        return res.json({
          success: true,
          placeId,
          name: univData.name
        });
      }
    }

    // Fallback if Roblox API does not return name
    return res.json({
      success: true,
      placeId,
      name: `Roblox Game (${placeId})`
    });
  } catch (error) {
    console.error(`[GAME-INFO ERROR] Failed for placeId ${placeId}:`, error.message);
    return res.json({
      success: true,
      placeId,
      name: `Roblox Game (${placeId})`
    });
  }
});

// Fetch ascending empty servers directly from Roblox API (limit 100)
async function fetchRobloxServers(placeId) {
  try {
    const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100&sortOrder=Asc`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Roblox API status ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      servers: result.data || []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Centered background worker for pre-configured games
async function syncRobloxCache() {
  for (const placeId of Object.keys(GAMES)) {
    const result = await fetchRobloxServers(placeId);
    if (result.success) {
      globalCaches[placeId].servers = result.servers;
      globalCaches[placeId].lastUpdated = Date.now();
      globalCaches[placeId].isFirstFetchDone = true;
      globalCaches[placeId].error = null;
    } else {
      console.warn(`[BACKGROUND SYNC] Update failed for ${GAMES[placeId]} (${placeId}): ${result.error}`);
      globalCaches[placeId].error = result.error;
    }
  }
  console.log(`[BACKGROUND SYNC] Multi-game cache updated at ${new Date().toLocaleTimeString()}`);
}

// Start polling
syncRobloxCache();
setInterval(syncRobloxCache, SYNC_INTERVAL);

// Serve central cache instantly (0ms response)
app.get('/api/servers', async (req, res) => {
  const placeId = req.query.placeId || req.query.place_id || DEFAULT_PLACE_ID;
  const cache = globalCaches[placeId];

  if (cache) {
    if (!cache.isFirstFetchDone) {
      return res.json({
        success: false,
        error: 'Hệ thống đang nạp danh sách server lần đầu. Vui lòng đợi vài giây...',
        servers: []
      });
    }

    return res.json({
      success: true,
      servers: cache.servers,
      stale: cache.error !== null,
      cached: true,
      lastSyncTime: cache.lastUpdated,
      error: cache.error
    });
  }

  // Fallback for dynamic place IDs not in pre-cached list
  const result = await fetchRobloxServers(placeId);
  return res.json({
    success: result.success,
    servers: result.servers || [],
    stale: false,
    cached: false,
    lastSyncTime: Date.now(),
    error: result.error || null
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`ROBLOX SERVER HOP RUNNING (MULTI-GAME MODE)`);
  console.log(`Local Access: http://localhost:${PORT}`);
  console.log(`Secret All-Game Page: http://localhost:${PORT}/secret`);
  console.log(`Supported Games:`);
  Object.entries(GAMES).forEach(([id, name]) => console.log(` - ${name}: ${id}`));
  console.log(`==================================================`);
});
