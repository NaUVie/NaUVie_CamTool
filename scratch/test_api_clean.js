async function run() {
  console.log('Waiting 15 seconds to clear any rate limits...');
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  const placeId = '98664161516921';
  console.log('Fetching public servers with sortOrder=Asc...');
  try {
    const url = `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100&sortOrder=Asc`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const json = await res.json();
    console.log('Status:', res.status);
    if (json.data) {
      console.log(`Success! Fetched ${json.data.length} servers.`);
      const counts = json.data.map(s => s.playing);
      console.log('Player counts:', counts.slice(0, 30).join(', '));
      const minVal = Math.min(...counts);
      const maxVal = Math.max(...counts);
      console.log(`Min player count in this batch: ${minVal}`);
      console.log(`Max player count in this batch: ${maxVal}`);
    } else {
      console.log('Failed:', JSON.stringify(json));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
