async function test() {
  const placeId = '98664161516921';
  
  console.log('--- Fetching with sortOrder=Asc ---');
  try {
    const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=20&sortOrder=Asc`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const json = await res.json();
    console.log('Response status:', res.status);
    console.log('Response JSON:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();
