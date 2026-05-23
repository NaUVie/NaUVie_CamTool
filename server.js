const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const PLACE_ID = '98664161516921'; // Catch a Monster place ID

// central memory cache only for Ascending (Neo & Vừa - 0 to 4 players)
let globalCache = {
  servers: [],
  lastUpdated: null,
  isFirstFetchDone: false,
  error: null
};

// 12 seconds sync interval
const SYNC_INTERVAL = 12 * 1000; 

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Fetch ascending empty servers directly from Roblox API (limit 100)
async function fetchRobloxServers() {
  try {
    const url = `https://games.roblox.com/v1/games/${PLACE_ID}/servers/Public?limit=100&sortOrder=Asc`;
    
    console.log(`[BACKGROUND SYNC] Querying Roblox API for empty servers...`);
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

// Centered background worker
async function syncRobloxCache() {
  const result = await fetchRobloxServers();
  if (result.success) {
    globalCache.servers = result.servers;
    globalCache.lastUpdated = Date.now();
    globalCache.isFirstFetchDone = true;
    globalCache.error = null;
    console.log(`[BACKGROUND SYNC] Cache updated successfully (${result.servers.length} empty servers).`);
  } else {
    console.warn(`[BACKGROUND SYNC] Update failed: ${result.error}`);
    globalCache.error = result.error;
  }
}

// Start polling
syncRobloxCache();
setInterval(syncRobloxCache, SYNC_INTERVAL);

// Serve central cache instantly (0ms response)
app.get('/api/servers', (req, res) => {
  if (!globalCache.isFirstFetchDone) {
    return res.json({
      success: false,
      error: 'Hệ thống đang nạp danh sách server lần đầu. Vui lòng đợi vài giây...',
      servers: []
    });
  }

  return res.json({
    success: true,
    servers: globalCache.servers,
    stale: globalCache.error !== null,
    cached: true,
    lastSyncTime: globalCache.lastUpdated,
    error: globalCache.error
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`ROBLOX SERVER HOP RUNNING (ULTRA LIGHTWEIGHT MODE)`);
  console.log(`Local Access: http://localhost:${PORT}`);
  console.log(`Place ID: ${PLACE_ID} (Catch a Monster)`);
  console.log(`Status: Bất tử 429 - Chỉ quét Neo & Vừa (0-4 người)`);
  console.log(`==================================================`);
});
