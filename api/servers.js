// Vercel Serverless Function – proxy Roblox servers
// This file replaces the previous server.js when deployed on Vercel.

const express = require('express');
const fetch = require('node-fetch'); // already in dependencies

const app = express();
const PLACE_ID = '98664161516921'; // Catch a Monster place ID

// Central memory cache (same logic as original server.js)
let globalCache = {
  servers: [],
  lastUpdated: null,
  isFirstFetchDone: false,
  error: null
};

const SYNC_INTERVAL = 12 * 1000; // 12 seconds

// Fetch empty servers from Roblox API (ascending order)
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
    return { success: true, servers: result.data || [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function syncRobloxCache() {
  const result = await fetchRobloxServers();
  if (result.success) {
    globalCache.servers = result.servers;
    globalCache.lastUpdated = Date.now();
    globalCache.isFirstFetchDone = true;
    globalCache.error = null;
    console.log(`[BACKGROUND SYNC] Cache updated (${result.servers.length} servers).`);
  } else {
    console.warn(`[BACKGROUND SYNC] Update failed: ${result.error}`);
    globalCache.error = result.error;
  }
}

// Initial sync and periodic refresh
syncRobloxCache();
setInterval(syncRobloxCache, SYNC_INTERVAL);

// API endpoint – Vercel will invoke this function directly
app.get('/servers', (req, res) => {
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

module.exports = app;
