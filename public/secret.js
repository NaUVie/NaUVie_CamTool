// NaUVie Secret All Game Hub Script (Full Featured Premium Edition)

const DEFAULT_GAMES = [
  { id: '98664161516921', name: 'Catch a Monster' },
  { id: '107778070777162', name: 'Steal An Egg' },
  { id: '74102906764176', name: 'Greedy Growers' }
];

let activePlaceId = '98664161516921';
let activeGameName = 'Catch a Monster';
let allServers = [];
let filteredServers = [];
let visibleServersCount = 12;
let openedServers = new Set(JSON.parse(localStorage.getItem('nauvie_opened_servers') || '[]'));
let hopsToday = parseInt(localStorage.getItem('nauvie_hops_today') || '0');

// Controls & Filters State
let playerFilter = 'ALL'; 
let sortOrder = 'PLAYERS_ASC';
let viewMode = localStorage.getItem('nauvie_view_mode') || 'GRID';

// Auto-Refresh & Auto-Hop State
let autoRefreshTimer = 30;
let isAutoRefreshChecked = false;
let autoHopTimer = 60;
let isAutoHopChecked = false;

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupTheme();
  setupThemeColorCustomizer();
  setupViewMode();
  setupHopsLimit();
  loadSavedGames();
  setupEventListeners();

  // Khôi phục Tự động Refresh / Hop
  const isAutoHopActiveSaved = localStorage.getItem('nauvie_is_auto_hop_active') === 'true';
  const isAutoRefreshActiveSaved = localStorage.getItem('nauvie_auto_refresh_active') === 'true';
  const savedTimerValue = localStorage.getItem('nauvie_auto_hop_timer_value') || '60';

  const timerSlider = document.getElementById('server-hop-timer-slider');
  const timerValSpan = document.getElementById('auto-hop-timer-val');
  if (timerSlider) {
    timerSlider.value = savedTimerValue;
    if (timerValSpan) {
      const v = parseInt(savedTimerValue);
      timerValSpan.textContent = v === 120 ? '2m' : (v >= 60 ? `${Math.floor(v / 60)}m${v % 60 > 0 ? ` ${v % 60}s` : ''}` : `${v}s`);
    }
  }

  if (isAutoHopActiveSaved) {
    isAutoHopChecked = true;
    const autoHopCheck = document.getElementById('server-hop-auto-random');
    if (autoHopCheck) autoHopCheck.checked = true;
    autoHopTimer = parseInt(savedTimerValue);
    const countdownSpan = document.getElementById('auto-hop-countdown-span');
    if (countdownSpan) countdownSpan.textContent = ` (${autoHopTimer}s)`;
  }

  if (isAutoRefreshActiveSaved) {
    isAutoRefreshChecked = true;
    const autoRefreshCheck = document.getElementById('server-hop-auto-refresh');
    if (autoRefreshCheck) autoRefreshCheck.checked = true;
  }

  // Ticking Loop
  setInterval(() => {
    tickAutoRefresh();
    tickAutoHop();
  }, 1000);
});

// --- AUTHENTICATION LOGIC ---
function checkAuth() {
  const token = sessionStorage.getItem('nauvie_secret_token');
  const modal = document.getElementById('auth-modal');
  if (token) {
    if (modal) modal.style.display = 'none';
    loadServers();
  } else {
    if (modal) modal.style.display = 'flex';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('admin-username');
  const passwordInput = document.getElementById('admin-password');
  const errorMsg = document.getElementById('auth-error-msg');
  const submitBtn = document.getElementById('auth-submit-btn');

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  errorMsg.style.display = 'none';
  submitBtn.disabled = true;
  submitBtn.innerText = 'ĐANG XÁC THỰC...';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      sessionStorage.setItem('nauvie_secret_token', data.token);
      document.getElementById('auth-modal').style.display = 'none';
      showToast('success', 'Đăng nhập Admin thành công!');
      loadServers();
    } else {
      errorMsg.innerText = data.error || 'Tài khoản hoặc mật khẩu không chính xác!';
      errorMsg.style.display = 'block';
    }
  } catch (err) {
    errorMsg.innerText = 'Không thể kết nối tới server xác thực!';
    errorMsg.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>XÁC THỰC ĐĂNG NHẬP</span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>`;
  }
}

function handleLogout() {
  sessionStorage.removeItem('nauvie_secret_token');
  location.reload();
}

// --- SAVED GAMES CACHE LOGIC ---
function getSavedGames() {
  try {
    const saved = localStorage.getItem('all_games_cache_list');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading saved games cache:', err);
  }
  return [...DEFAULT_GAMES];
}

function saveGamesList(list) {
  try {
    localStorage.setItem('all_games_cache_list', JSON.stringify(list));
  } catch (err) {
    console.error('Error saving games cache:', err);
  }
}

function loadSavedGames() {
  const games = getSavedGames();
  const container = document.getElementById('saved-games-container');
  if (!container) return;

  container.innerHTML = '';
  games.forEach(game => {
    const chip = document.createElement('div');
    chip.className = `game-chip ${game.id === activePlaceId ? 'active' : ''}`;
    chip.title = 'Nhấp chuột trái để xem server | Nhấp chuột phải để ĐỔI TÊN';
    chip.innerHTML = `
      <span>${escapeHtml(game.name)}</span>
      <span style="font-family: monospace; font-size: 10px; opacity: 0.7;">(${game.id})</span>
      <button type="button" class="chip-delete-btn" title="Xóa khỏi danh sách" onclick="event.stopPropagation(); deleteGame('${game.id}')">&times;</button>
    `;
    chip.onclick = () => selectGame(game.id, game.name);
    chip.oncontextmenu = (e) => {
      e.preventDefault();
      editGameName(game.id, game.name);
    };
    container.appendChild(chip);
  });
}

function editGameName(placeId, currentName) {
  const newName = prompt(`Nhập tên mới cho game (Place ID: ${placeId}):`, currentName);
  if (newName === null) return; // User canceled
  const trimmed = newName.trim();
  if (!trimmed) {
    showToast('error', 'Tên game không được để trống!');
    return;
  }

  let list = getSavedGames();
  const gameObj = list.find(g => g.id === placeId);
  if (gameObj) {
    gameObj.name = trimmed;
    saveGamesList(list);

    if (activePlaceId === placeId) {
      activeGameName = trimmed;
      const displaySpan = document.getElementById('active-game-name-display');
      if (displaySpan) displaySpan.innerText = trimmed;
    }

    loadSavedGames();
    showToast('success', `Đã đổi tên game thành "${trimmed}"!`);
  }
}

function selectGame(placeId, name) {
  activePlaceId = placeId;
  activeGameName = name;

  const displaySpan = document.getElementById('active-game-name-display');
  const badgeSpan = document.getElementById('active-game-id-badge');
  if (displaySpan) displaySpan.innerText = name;
  if (badgeSpan) badgeSpan.innerText = `(${placeId})`;

  loadSavedGames();
  loadServers();
}

async function handleAddGame(e) {
  e.preventDefault();
  const input = document.getElementById('input-place-id');
  const btn = document.getElementById('btn-submit-game');
  const placeId = input.value.trim();

  if (!placeId || !/^\d+$/.test(placeId)) {
    showToast('error', 'Vui lòng nhập đúng Place ID bằng số.');
    return;
  }

  const currentList = getSavedGames();
  const existing = currentList.find(g => g.id === placeId);
  if (existing) {
    selectGame(existing.id, existing.name);
    input.value = '';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span>ĐANG TRUY TÌM TÊN GAME...</span>`;

  try {
    const res = await fetch(`/api/game-info?placeId=${placeId}`);
    const data = await res.json();
    const resolvedName = (data && data.name) ? data.name : `Roblox Game (${placeId})`;

    currentList.push({ id: placeId, name: resolvedName });
    saveGamesList(currentList);
    input.value = '';
    selectGame(placeId, resolvedName);
    showToast('success', `Đã tìm thấy game "${resolvedName}" và lưu cache!`);
  } catch (err) {
    currentList.push({ id: placeId, name: `Roblox Game (${placeId})` });
    saveGamesList(currentList);
    input.value = '';
    selectGame(placeId, `Roblox Game (${placeId})`);
    showToast('info', `Đã thêm Place ID ${placeId} vào danh sách!`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg><span>TRUY TÌM & THÊM GAME</span>`;
  }
}

function deleteGame(placeId) {
  let list = getSavedGames();
  list = list.filter(g => g.id !== placeId);
  if (list.length === 0) {
    list = [...DEFAULT_GAMES];
  }
  saveGamesList(list);

  if (activePlaceId === placeId) {
    selectGame(list[0].id, list[0].name);
  } else {
    loadSavedGames();
  }
  showToast('info', 'Đã xóa game khỏi cache!');
}

// --- FETCH & RENDER SERVERS ---
async function loadServers() {
  const grid = document.getElementById('servers-grid');
  const loader = document.getElementById('loading-overlay');
  
  if (grid) grid.innerHTML = '';
  if (loader) loader.classList.remove('hidden');

  try {
    const res = await fetch(`/api/servers?placeId=${activePlaceId}`);
    const data = await res.json();

    if (data.success && data.servers) {
      allServers = data.servers;
      processAndRenderServers();
      showToast('success', `Đã nạp ${allServers.length} server cho game "${activeGameName}"!`);
    } else {
      if (grid) grid.innerHTML = `<div class="no-servers-placeholder"><p class="empty-title">// LỖI KẾT NỐI</p><p class="empty-subtitle">${escapeHtml(data.error || 'Không thể tải server')}</p></div>`;
    }
  } catch (err) {
    if (grid) grid.innerHTML = `<div class="no-servers-placeholder"><p class="empty-title">// LỖI MẠNG</p><p class="empty-subtitle">${escapeHtml(err.message)}</p></div>`;
  } finally {
    if (loader) loader.classList.add('hidden');
  }
}

function processAndRenderServers() {
  filteredServers = allServers.filter(server => {
    const players = server.playing;
    if (playerFilter === 'EMPTY') return players <= 1;
    if (playerFilter === 'OPEN') return players >= 2 && players <= 4;
    return players <= 4;
  });

  const sortSelect = document.getElementById('server-sort-select');
  const activeSort = sortSelect ? sortSelect.value : 'PLAYERS_ASC';

  if (activeSort === 'PLAYERS_ASC') {
    filteredServers.sort((a, b) => a.playing - b.playing);
  } else if (activeSort === 'PLAYERS_DESC') {
    filteredServers.sort((a, b) => b.playing - a.playing);
  } else if (activeSort === 'PING_ASC') {
    filteredServers.sort((a, b) => (a.ping || 50) - (b.ping || 50));
  } else if (activeSort === 'FPS_DESC') {
    filteredServers.sort((a, b) => (b.fps || 60) - (a.fps || 60));
  }

  visibleServersCount = 12;

  // Stats
  const statTotal = document.getElementById('stat-total-servers');
  if (statTotal) statTotal.textContent = allServers.length;
  const statLow = document.getElementById('stat-lowpop-servers');
  if (statLow) statLow.textContent = allServers.filter(s => s.playing <= 3).length;
  const statLast = document.getElementById('stat-last-updated');
  if (statLast) statLast.textContent = new Date().toLocaleTimeString();

  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById('servers-grid');
  const showMoreBtn = document.getElementById('show-more-btn');

  if (grid) {
    if (viewMode === 'LIST') {
      grid.classList.add('view-list-active');
    } else {
      grid.classList.remove('view-list-active');
    }
    grid.innerHTML = '';
  }

  if (filteredServers.length === 0) {
    if (grid) {
      grid.innerHTML = `
        <div class="no-servers-placeholder">
          <p class="empty-title">// KHÔNG TÌM THẤY SERVER PHÙ HỢP</p>
          <p class="empty-subtitle">Hãy thử chọn phân loại người chơi khác hoặc bấm nạp lại danh sách.</p>
        </div>
      `;
    }
    if (showMoreBtn) showMoreBtn.classList.add('hidden');
    return;
  }

  const slice = filteredServers.slice(0, visibleServersCount);

  slice.forEach(server => {
    const isOpened = openedServers.has(server.id);
    const playerPercent = Math.min(100, Math.round((server.playing / (server.maxPlayers || 12)) * 100));

    let tag = 'Mới quét';
    let typeClass = 'empty';
    if (server.playing >= 11) {
      tag = 'Đầy phòng';
      typeClass = 'full';
    } else if (server.playing >= 5) {
      tag = 'Tấp nập';
      typeClass = 'busy';
    } else if (server.playing >= 2) {
      tag = 'Hoạt động';
      typeClass = 'open';
    }

    let pingClass = 'good';
    if ((server.ping || 50) > 150) pingClass = 'poor';
    else if ((server.ping || 50) > 80) pingClass = 'fair';

    const fps = Math.round(server.fps || 60);
    const shortId = server.id.substring(0, 8);

    const card = document.createElement('article');
    card.className = `cam-hop-card cam-hop-card--${typeClass} ${isOpened ? 'cam-hop-card--opened' : ''}`;

    card.innerHTML = `
      <div class="cam-hop-card__head">
        <span class="cam-hop-card__led cam-hop-card__led--${typeClass}"></span>
        <span class="cam-hop-card__id">
          <span>${shortId}</span>
          <button class="cam-hop-card__copy-btn" title="Copy Console Join Script" onclick="copyConsoleCommand('${server.id}', event)">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
          </button>
        </span>
        <span class="cam-hop-card__tag cam-hop-card__tag--${typeClass}">${tag}</span>
      </div>
      <div class="cam-hop-card__count-row">
        <span class="cam-hop-card__count">
          <span class="cam-hop-card__count-now">${server.playing}</span>
          <span class="cam-hop-card__count-sep">/</span>
          <span class="cam-hop-card__count-cap">${server.maxPlayers || 12}</span>
        </span>
        <span class="cam-hop-card__count-label">PLAYERS</span>
      </div>
      <div class="cam-hop-card__bar">
        <div class="cam-hop-card__fill cam-hop-card__fill--${typeClass}" style="width: ${playerPercent}%"></div>
      </div>
      <div class="cam-hop-card__meta">
        <span class="cam-hop-card__meta-cell">
          <span class="cam-hop-card__meta-k">FPS</span>
          <span class="cam-hop-card__meta-v">${fps}</span>
        </span>
        <span class="cam-hop-card__meta-sep">·</span>
        <span class="cam-hop-card__meta-cell cam-hop-card__meta-cell--${pingClass}">
          <span class="cam-hop-card__meta-k">PING</span>
          <span class="cam-hop-card__meta-v">${server.ping || 45}ms</span>
        </span>
      </div>
      <button type="button" class="cam-hop-card__join ${isOpened ? 'cam-hop-card__join--opened' : ''}" 
        ${isOpened ? 'disabled' : ''} onclick="joinRobloxServer('${server.id}')">
        ${isOpened ? `
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
          <span>OPENED</span>
        ` : `
          <span>HOP IN</span>
          <span class="cam-hop-card__join-arrow">→</span>
        `}
      </button>
    `;

    grid.appendChild(card);
  });

  if (showMoreBtn) {
    if (filteredServers.length > visibleServersCount) {
      showMoreBtn.classList.remove('hidden');
      const remaining = filteredServers.length - visibleServersCount;
      document.getElementById('remaining-count-hint').textContent = `(Còn ${remaining} phòng)`;
    } else {
      showMoreBtn.classList.add('hidden');
    }
  }
}

function joinRobloxServer(jobId) {
  const link = `roblox://experiences/start?placeId=${activePlaceId}&gameInstanceId=${jobId}`;
  showToast('info', 'Đang kết nối Roblox Launcher...');
  window.location.href = link;

  openedServers.add(jobId);
  localStorage.setItem('nauvie_opened_servers', JSON.stringify([...openedServers]));
  hopsToday++;
  localStorage.setItem('nauvie_hops_today', hopsToday);
  setupHopsLimit();
  renderGrid();
}

function copyConsoleCommand(jobId, event) {
  event.stopPropagation();
  const command = `Roblox.GameLauncher.joinGameInstance(${activePlaceId}, "${jobId}")`;
  navigator.clipboard.writeText(command).then(() => {
    showToast('success', 'Đã copy đoạn mã console vào clipboard!');
  });
}

function performRandomQuickJoin() {
  let pool = allServers.filter(s => s.playing >= 2 && s.playing <= 4 && !openedServers.has(s.id));
  if (pool.length === 0) {
    pool = filteredServers.filter(s => !openedServers.has(s.id));
  }
  if (pool.length === 0 && allServers.length > 0) {
    openedServers.clear();
    localStorage.setItem('nauvie_opened_servers', '[]');
    pool = allServers;
  }

  if (pool.length > 0) {
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    showToast('success', `Hop Nhanh! Đang kết nối phòng ${chosen.id.substring(0,8)}...`);
    joinRobloxServer(chosen.id);
  } else {
    showToast('error', 'Không có server khả dụng để hop nhanh!');
  }
}

function tickAutoRefresh() {
  if (!isAutoRefreshChecked) return;
  autoRefreshTimer--;
  const span = document.getElementById('auto-refresh-timer');
  if (span) span.textContent = `${autoRefreshTimer}s`;

  if (autoRefreshTimer <= 0) {
    autoRefreshTimer = 30;
    showToast('info', 'Đang tự động nạp lại danh sách server...');
    loadServers();
  }
}

function tickAutoHop() {
  const countdownSpan = document.getElementById('auto-hop-countdown-span');
  if (!isAutoHopChecked) {
    if (countdownSpan) countdownSpan.textContent = '';
    return;
  }

  autoHopTimer--;
  if (countdownSpan) countdownSpan.textContent = ` (${autoHopTimer}s)`;

  if (autoHopTimer <= 0) {
    const slider = document.getElementById('server-hop-timer-slider');
    autoHopTimer = parseInt(slider ? slider.value : '60');
    if (countdownSpan) countdownSpan.textContent = ` (${autoHopTimer}s)`;
    performRandomQuickJoin();
  }
}

// --- SETUP LISTENERS ---
function setupEventListeners() {
  // Filters
  const playerChips = document.querySelectorAll('#filter-players .segment-btn');
  playerChips.forEach(chip => {
    chip.addEventListener('click', () => {
      playerChips.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-checked', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-checked', 'true');
      playerFilter = chip.dataset.value;
      processAndRenderServers();
    });
  });

  // Sort
  const sortSelect = document.getElementById('server-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => processAndRenderServers());
  }

  // Refresh
  const refreshBtn = document.getElementById('manual-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadServers());
  }

  // Quick Join
  const quickJoinBtn = document.getElementById('quick-join-btn');
  if (quickJoinBtn) {
    quickJoinBtn.addEventListener('click', () => performRandomQuickJoin());
  }

  // Show More
  const showMoreBtn = document.getElementById('show-more-btn');
  if (showMoreBtn) {
    showMoreBtn.addEventListener('click', () => {
      visibleServersCount += 12;
      renderGrid();
    });
  }

  // FAQ toggle
  const faqToggle = document.getElementById('faq-toggle');
  const faqContent = document.getElementById('faq-content');
  const faqChevron = document.querySelector('.faq-chevron');
  if (faqToggle && faqContent) {
    faqToggle.addEventListener('click', () => {
      const isHidden = faqContent.classList.toggle('hidden');
      if (faqChevron) faqChevron.classList.toggle('active', !isHidden);
    });
  }

  // Auto Refresh Checkbox
  const autoRefreshCheck = document.getElementById('server-hop-auto-refresh');
  if (autoRefreshCheck) {
    autoRefreshCheck.addEventListener('change', (e) => {
      isAutoRefreshChecked = e.target.checked;
      autoRefreshTimer = 30;
      localStorage.setItem('nauvie_auto_refresh_active', isAutoRefreshChecked ? 'true' : 'false');
      if (isAutoRefreshChecked) {
        showToast('info', 'Đã bật tự động quét danh sách sau 30s.');
      }
    });
  }

  // Auto Hop Checkbox & Slider
  const autoHopCheck = document.getElementById('server-hop-auto-random');
  const timerSlider = document.getElementById('server-hop-timer-slider');
  const timerValSpan = document.getElementById('auto-hop-timer-val');
  const countdownSpan = document.getElementById('auto-hop-countdown-span');

  const formatHopTime = (val) => {
    const v = parseInt(val);
    if (v === 120) return '2m';
    if (v >= 60) {
      const m = Math.floor(v / 60);
      const s = v % 60;
      return s > 0 ? `${m}m ${s}s` : `${m}m`;
    }
    return `${v}s`;
  };

  if (timerSlider && timerValSpan) {
    timerSlider.addEventListener('input', (e) => {
      timerValSpan.textContent = formatHopTime(e.target.value);
    });
    timerSlider.addEventListener('change', (e) => {
      localStorage.setItem('nauvie_auto_hop_timer_value', e.target.value);
      if (isAutoHopChecked) {
        autoHopTimer = parseInt(e.target.value);
        if (countdownSpan) countdownSpan.textContent = ` (${autoHopTimer}s)`;
      }
    });
  }

  if (autoHopCheck) {
    autoHopCheck.addEventListener('change', (e) => {
      isAutoHopChecked = e.target.checked;
      localStorage.setItem('nauvie_is_auto_hop_active', isAutoHopChecked ? 'true' : 'false');
      if (isAutoHopChecked) {
        autoHopTimer = parseInt(timerSlider ? timerSlider.value : '60');
        if (countdownSpan) countdownSpan.textContent = ` (${autoHopTimer}s)`;
        showToast('info', `Đã bật Tự động Hop mỗi ${autoHopTimer} giây.`);
      } else {
        if (countdownSpan) countdownSpan.textContent = '';
      }
    });
  }

  // Tabs
  const tabServers = document.getElementById('tab-btn-servers');
  const tabGuide = document.getElementById('tab-btn-guide');
  const paneServers = document.getElementById('tab-content-servers');
  const paneGuide = document.getElementById('tab-content-guide');

  if (tabServers && tabGuide && paneServers && paneGuide) {
    tabServers.addEventListener('click', () => {
      tabServers.classList.add('active');
      tabGuide.classList.remove('active');
      paneServers.style.display = 'block';
      paneGuide.style.display = 'none';
    });
    tabGuide.addEventListener('click', () => {
      tabGuide.classList.add('active');
      tabServers.classList.remove('active');
      paneServers.style.display = 'none';
      paneGuide.style.display = 'block';
    });
  }
}

// --- VIEW MODE & HOPS LIMIT ---
function setupViewMode() {
  const viewModeToggle = document.getElementById('view-mode-toggle');
  if (viewModeToggle) {
    const buttons = viewModeToggle.querySelectorAll('.segment-btn');
    buttons.forEach(btn => {
      if (btn.dataset.value === viewMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }

      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        viewMode = btn.dataset.value;
        localStorage.setItem('nauvie_view_mode', viewMode);
        renderGrid();
      });
    });
  }
}

function setupHopsLimit() {
  const hopsVal = document.getElementById('hops-today-value');
  if (hopsVal) hopsVal.textContent = hopsToday;
}

// --- THEME & THEME COLOR CUSTOMIZER (Full 100% feature match with index.html) ---
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
      showToast('success', 'Đã chuyển sang Chế độ Sáng!');
    } else {
      if (sunIco) sunIco.style.display = 'block';
      if (moonIco) moonIco.style.display = 'none';
      showToast('success', 'Đã chuyển sang Chế độ Tối!');
    }
  });
}

function setupThemeColorCustomizer() {
  const savedColor = localStorage.getItem('nauvie_theme_color');
  const presetButtons = document.querySelectorAll('.preset-color-btn');
  const colorPicker = document.getElementById('custom-theme-color-picker');
  const colorPickerWrapper = document.querySelector('.custom-color-picker-wrapper');
  const colorHexText = document.getElementById('current-color-hex');
  const resetBtn = document.getElementById('reset-theme-color-btn');

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  function applyThemeColor(hex) {
    if (!hex) return;
    const root = document.documentElement;
    root.style.setProperty('--primary-blue', hex);

    const rgb = hexToRgb(hex);
    if (rgb) {
      const isLight = document.body.classList.contains('light-theme');
      if (!isLight) {
        root.style.setProperty('--cyber-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
        root.style.setProperty('--cyber-border-hover', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
        document.body.style.backgroundImage = `radial-gradient(circle at 50% 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.035) 0%, transparent 50%)`;
      }
    }
    if (colorHexText) {
      colorHexText.textContent = hex.toUpperCase();
      colorHexText.style.color = hex;
    }
  }

  if (savedColor) {
    applyThemeColor(savedColor);
    if (colorPicker) colorPicker.value = savedColor;
    presetButtons.forEach(btn => {
      if (btn.dataset.color.toLowerCase() === savedColor.toLowerCase()) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const color = btn.dataset.color;
      applyThemeColor(color);
      localStorage.setItem('nauvie_theme_color', color);
      if (colorPicker) colorPicker.value = color;
      showToast('success', `Đã đổi màu chủ đề thành ${btn.title}!`);
    });
  });

  if (colorPicker) {
    colorPicker.addEventListener('input', (e) => {
      const color = e.target.value;
      presetButtons.forEach(b => b.classList.remove('active'));
      applyThemeColor(color);
      localStorage.setItem('nauvie_theme_color', color);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem('nauvie_theme_color');
      applyThemeColor('#00f0ff');
      if (colorPicker) colorPicker.value = '#00f0ff';
      presetButtons.forEach(b => {
        b.classList.toggle('active', b.dataset.color === '#00f0ff');
      });
      showToast('success', 'Đã khôi phục màu mặc định!');
    });
  }

  // Background Uploader
  const bgUploader = document.getElementById('custom-bg-uploader');
  const removeBgBtn = document.getElementById('remove-custom-bg-btn');

  function applyCustomBackground(base64Url) {
    if (!base64Url) {
      document.body.style.removeProperty('background-image');
      if (removeBgBtn) removeBgBtn.style.display = 'none';
      const currentActiveColor = localStorage.getItem('nauvie_theme_color') || '#00f0ff';
      applyThemeColor(currentActiveColor);
      return;
    }
    const isLight = document.body.classList.contains('light-theme');
    const overlay = isLight 
      ? 'linear-gradient(rgba(243, 244, 246, 0.88), rgba(243, 244, 246, 0.88))'
      : 'linear-gradient(rgba(10, 12, 18, 0.88), rgba(10, 12, 18, 0.88))';

    document.body.style.backgroundImage = `${overlay}, url(${base64Url})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    if (removeBgBtn) removeBgBtn.style.display = 'block';
  }

  const savedBg = localStorage.getItem('nauvie_custom_bg');
  if (savedBg) applyCustomBackground(savedBg);

  if (bgUploader) {
    bgUploader.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          let width = img.width;
          let height = img.height;
          const maxDim = 1920;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          try {
            const compressed = canvas.toDataURL('image/jpeg', 0.75);
            localStorage.setItem('nauvie_custom_bg', compressed);
            applyCustomBackground(compressed);
            showToast('success', 'Đã lưu và áp dụng ảnh nền!');
          } catch (err) {
            showToast('error', 'Ảnh quá lớn! Vui lòng chọn ảnh nhẹ hơn.');
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (removeBgBtn) {
    removeBgBtn.addEventListener('click', () => {
      localStorage.removeItem('nauvie_custom_bg');
      applyCustomBackground(null);
      if (bgUploader) bgUploader.value = '';
      showToast('success', 'Đã xóa ảnh nền tùy chọn!');
    });
  }

  // Glass Opacity Slider
  const opacitySlider = document.getElementById('glass-opacity-slider');
  const opacityValText = document.getElementById('glass-opacity-val');

  function applyGlassOpacity(percentage) {
    if (!percentage) percentage = 65;
    const alpha = percentage / 100;
    const isLight = document.body.classList.contains('light-theme');
    const root = document.documentElement;

    if (isLight) {
      root.style.setProperty('--bg-panel', `rgba(255, 255, 255, ${Math.max(0.1, alpha - 0.2)})`);
      root.style.setProperty('--bg-card', `rgba(255, 255, 255, ${alpha})`);
    } else {
      root.style.setProperty('--bg-panel', `rgba(10, 12, 18, ${alpha})`);
      root.style.setProperty('--bg-card', `rgba(20, 22, 33, ${Math.max(0.1, alpha - 0.05)})`);
    }

    if (opacityValText) opacityValText.textContent = `${percentage}%`;
    if (opacitySlider) opacitySlider.value = percentage;
  }

  const savedOpacity = localStorage.getItem('nauvie_glass_opacity');
  applyGlassOpacity(savedOpacity ? parseInt(savedOpacity, 10) : 65);

  if (opacitySlider) {
    opacitySlider.addEventListener('input', (e) => {
      const p = e.target.value;
      applyGlassOpacity(p);
      localStorage.setItem('nauvie_glass_opacity', p);
    });
  }

  // Particle Canvas Engine
  setupParticlesEngine();
}

function setupParticlesEngine() {
  const canvas = document.getElementById('particles-canvas');
  const effectSelect = document.getElementById('particles-effect-select');
  const layerSelect = document.getElementById('particles-layer-select');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let animationFrameId = null;
  let particlesArray = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  class Particle {
    constructor(effectType) {
      this.reset(effectType, true);
    }
    reset(effectType, isInit = false) {
      this.effectType = effectType;
      const w = canvas.width;
      const h = canvas.height;

      if (effectType === 'GLOW') {
        this.x = Math.random() * w;
        this.y = isInit ? Math.random() * h : h + 10;
        this.size = Math.random() * 4 + 2;
        this.speedY = -(Math.random() * 0.8 + 0.3);
        this.speedX = Math.random() * 0.4 - 0.2;
        this.opacity = Math.random() * 0.45 + 0.2;
        this.swaySpeed = Math.random() * 0.02 + 0.01;
        this.swayAngle = Math.random() * Math.PI * 2;
        this.swayRadius = Math.random() * 0.8 + 0.2;
      } else if (effectType === 'SAKURA') {
        this.x = Math.random() * (w + 100) - 50;
        this.y = isInit ? Math.random() * h : -20;
        this.size = Math.random() * 5 + 4;
        this.speedY = Math.random() * 0.8 + 0.5;
        this.speedX = -(Math.random() * 0.5 + 0.2);
        this.opacity = Math.random() * 0.5 + 0.3;
        this.spin = Math.random() * 0.02 - 0.01;
        this.angle = Math.random() * Math.PI * 2;
        this.swaySpeed = Math.random() * 0.02 + 0.01;
        this.swayAngle = Math.random() * Math.PI * 2;
        this.swayRadius = Math.random() * 1.5 + 0.5;
      } else if (effectType === 'SNOW') {
        this.x = Math.random() * w;
        this.y = isInit ? Math.random() * h : -10;
        this.size = Math.random() * 3 + 1.5;
        this.speedY = Math.random() * 0.7 + 0.3;
        this.speedX = Math.random() * 0.2 - 0.1;
        this.opacity = Math.random() * 0.6 + 0.2;
        this.swaySpeed = Math.random() * 0.015 + 0.005;
        this.swayAngle = Math.random() * Math.PI * 2;
        this.swayRadius = Math.random() * 0.8 + 0.2;
      } else if (effectType === 'MATRIX') {
        this.x = Math.floor((Math.random() * w) / 14) * 14;
        this.y = isInit ? Math.random() * h : -20;
        this.size = Math.random() * 4 + 10;
        this.speedY = Math.random() * 2 + 1.5;
        this.speedX = 0;
        this.opacity = Math.random() * 0.75 + 0.25;
        const chars = '01abcdefghijklmnopqrstuvwxyz日ハミヒーウシ';
        this.char = chars.charAt(Math.floor(Math.random() * chars.length));
        this.frameCounter = 0;
      } else if (effectType === 'STARS') {
        this.x = Math.random() * (w + 200) - 100;
        this.y = isInit ? Math.random() * h : -50;
        this.size = Math.random() * 40 + 30;
        this.speedY = Math.random() * 3 + 4;
        this.speedX = -(this.speedY * 1.2);
        this.opacity = Math.random() * 0.5 + 0.1;
        this.lineWidth = Math.random() * 1.5 + 0.5;
      }
    }
    update(effectType) {
      if (effectType === 'GLOW') {
        this.y += this.speedY;
        this.swayAngle += this.swaySpeed;
        this.x += this.speedX + Math.sin(this.swayAngle) * this.swayRadius;
        if (this.y < -10) this.reset(effectType, false);
      } else if (effectType === 'SAKURA') {
        this.y += this.speedY;
        this.x += this.speedX + Math.sin(this.swayAngle) * this.swayRadius;
        this.swayAngle += this.swaySpeed;
        this.angle += this.spin;
        if (this.y > canvas.height + 10 || this.x < -60 || this.x > canvas.width + 60) this.reset(effectType, false);
      } else if (effectType === 'SNOW') {
        this.y += this.speedY;
        this.x += this.speedX + Math.sin(this.swayAngle) * this.swayRadius;
        this.swayAngle += this.swaySpeed;
        if (this.y > canvas.height + 10 || this.x < -10 || this.x > canvas.width + 10) this.reset(effectType, false);
      } else if (effectType === 'MATRIX') {
        this.y += this.speedY;
        this.frameCounter++;
        if (this.frameCounter % 15 === 0) {
          const chars = '01abcdefghijklmnopqrstuvwxyz日ハミヒーウシ';
          this.char = chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (this.y > canvas.height + 20) this.reset(effectType, false);
      } else if (effectType === 'STARS') {
        this.y += this.speedY;
        this.x += this.speedX;
        if (this.y > canvas.height + 50 || this.x < -100) this.reset(effectType, false);
      }
    }
    draw(activeColor) {
      ctx.save();
      if (this.effectType === 'GLOW') {
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = this.opacity;
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, activeColor);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.effectType === 'SAKURA') {
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = '#ff75a0';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * 1.4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.effectType === 'SNOW') {
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = this.opacity;
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.effectType === 'MATRIX') {
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = this.opacity;
        ctx.font = `${this.size}px monospace`;
        ctx.fillStyle = activeColor;
        ctx.shadowColor = activeColor;
        ctx.shadowBlur = 8;
        ctx.fillText(this.char, 0, 0);
      } else if (this.effectType === 'STARS') {
        ctx.globalAlpha = this.opacity;
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = this.lineWidth;
        ctx.shadowColor = activeColor;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.size, this.y - this.size * 0.8);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function initParticles(effectType) {
    particlesArray = [];
    if (effectType === 'NONE') return;
    let count = effectType === 'SNOW' ? 75 : (effectType === 'STARS' ? 6 : 45);
    for (let i = 0; i < count; i++) {
      particlesArray.push(new Particle(effectType));
    }
  }

  function applyParticlesLayer(layer) {
    canvas.style.zIndex = layer === 'FRONT' ? '999' : '-1';
    if (layerSelect) layerSelect.value = layer;
  }

  const savedEffect = localStorage.getItem('nauvie_particles_effect') || 'GLOW';
  const savedLayer = localStorage.getItem('nauvie_particles_layer') || 'BACK';
  applyParticlesLayer(savedLayer);

  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const selected = effectSelect ? effectSelect.value : 'GLOW';
    if (selected !== 'NONE') {
      const activeColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-blue').trim() || '#00f0ff';
      particlesArray.forEach(p => {
        p.update(selected);
        p.draw(activeColor);
      });
    }
    animationFrameId = requestAnimationFrame(animateParticles);
  }

  if (effectSelect) {
    effectSelect.value = savedEffect;
    initParticles(savedEffect);
    animateParticles();

    effectSelect.addEventListener('change', (e) => {
      const effect = e.target.value;
      localStorage.setItem('nauvie_particles_effect', effect);
      initParticles(effect);
      showToast('success', `Đã đổi hiệu ứng nền!`);
    });
  }

  if (layerSelect) {
    layerSelect.addEventListener('change', (e) => {
      const layer = e.target.value;
      localStorage.setItem('nauvie_particles_layer', layer);
      applyParticlesLayer(layer);
      showToast('success', `Đã đổi lớp hiển thị hiệu ứng!`);
    });
  }
}

// --- UTILS & TOASTS ---
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, match => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[match];
  });
}

function showToast(type, message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const activeToasts = Array.from(container.children);
  if (activeToasts.some(t => t.innerText.includes(message))) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  let typeColor = 'var(--primary-blue)';
  let typeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>`;

  if (type === 'success') {
    typeColor = 'var(--success-green)';
    typeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m9 12 2 2 4-4"></path></svg>`;
  } else if (type === 'error') {
    typeColor = 'var(--danger-red)';
    typeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line></svg>`;
  }

  toast.innerHTML = `
    <span style="color: ${typeColor}; display: flex; flex-shrink: 0;">${typeIcon}</span>
    <span style="flex-grow: 1; line-height: 1.4;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
