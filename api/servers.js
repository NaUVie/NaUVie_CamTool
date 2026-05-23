// Vercel Serverless Function – proxy Roblox servers
// Serverless = mỗi request là một lần chạy riêng, KHÔNG có background polling.
// Dùng native fetch (Node 18+ trên Vercel) thay vì node-fetch.

const PLACE_ID = '98664161516921'; // Catch a Monster place ID

module.exports = async function handler(req, res) {
  // Chỉ cho phép GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const url = `https://games.roblox.com/v1/games/${PLACE_ID}/servers/Public?limit=100&sortOrder=Asc`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(8000) // timeout 8 giây
    });

    if (!response.ok) {
      throw new Error(`Roblox API trả về status ${response.status}`);
    }

    const result = await response.json();

    // Set cache header – Vercel CDN sẽ cache response 12 giây
    // stale-while-revalidate: trả cache cũ trong khi đang fetch mới (mượt mà hơn)
    res.setHeader('Cache-Control', 's-maxage=12, stale-while-revalidate=30');

    return res.status(200).json({
      success: true,
      servers: result.data || [],
      cached: false,
      lastSyncTime: Date.now(),
      error: null
    });

  } catch (error) {
    console.error('[SERVERLESS] Lỗi khi gọi Roblox API:', error.message);

    // Vẫn trả 200 nhưng báo lỗi để frontend xử lý được
    return res.status(200).json({
      success: false,
      servers: [],
      stale: true,
      error: error.message
    });
  }
};
