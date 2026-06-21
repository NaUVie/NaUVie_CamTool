// NaUVie Hub - Roblox Account Manager Controller

document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
});

// Setup dual light/dark theme synced with localStorage
function setupTheme() {
  const currentTheme = localStorage.getItem('nauvie_theme') || 'dark';
  const body = document.body;
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (!toggleBtn) return;
  
  const sunIco = toggleBtn.querySelector('.sun-icon');
  const moonIco = toggleBtn.querySelector('.moon-icon');
  
  if (currentTheme === 'light') {
    body.classList.add('light-theme');
    if (sunIco) sunIco.style.display = 'none';
    if (moonIco) moonIco.style.display = 'block';
  } else {
    body.classList.remove('light-theme');
    if (sunIco) sunIco.style.display = 'block';
    if (moonIco) moonIco.style.display = 'none';
  }
  
  toggleBtn.addEventListener('click', () => {
    const isLight = body.classList.toggle('light-theme');
    localStorage.setItem('nauvie_theme', isLight ? 'light' : 'dark');
    
    if (isLight) {
      if (sunIco) sunIco.style.display = 'none';
      if (moonIco) moonIco.style.display = 'block';
    } else {
      if (sunIco) sunIco.style.display = 'block';
      if (moonIco) moonIco.style.display = 'none';
    }
  });
}
