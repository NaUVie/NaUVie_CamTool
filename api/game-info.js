// Vercel Serverless Function - Resolve Roblox Place Name by Place ID

const GAMES = {
  '98664161516921': 'Catch a Monster',
  '107778070777162': 'Steal An Egg',
  '74102906764176': 'Greedy Growers'
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const placeId = req.query.placeId || req.query.place_id;
  if (!placeId) {
    return res.status(400).json({ success: false, error: 'Thiếu Place ID' });
  }

  if (GAMES[placeId]) {
    return res.status(200).json({
      success: true,
      placeId,
      name: GAMES[placeId]
    });
  }

  try {
    const url = `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0 && data[0].name) {
        return res.status(200).json({
          success: true,
          placeId,
          name: data[0].name
        });
      }
    }

    const universeUrl = `https://apis.roblox.com/universes/v1/places/${placeId}`;
    const univRes = await fetch(universeUrl, { signal: AbortSignal.timeout(6000) });
    if (univRes.ok) {
      const univData = await univRes.json();
      if (univData.name) {
        return res.status(200).json({
          success: true,
          placeId,
          name: univData.name
        });
      }
    }

    return res.status(200).json({
      success: true,
      placeId,
      name: `Roblox Game (${placeId})`
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      placeId,
      name: `Roblox Game (${placeId})`
    });
  }
};
