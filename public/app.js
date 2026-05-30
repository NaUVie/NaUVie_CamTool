// Core Giao Diện & State cho NaUVie Hub Premium Server Hop
let allServers = [];
let filteredServers = [];
let visibleServersCount = 12;
const PLACE_ID = '98664161516921';

// Lọc & Sắp xếp mặc định
let playerFilter = 'ALL'; 
let sortOrder = 'ASC';   

// Bộ nhớ Hops hôm nay (LocalStorage)
let hopsToday = parseInt(localStorage.getItem('nauvie_hops_today') || '0');
let lastHopReset = localStorage.getItem('nauvie_hops_last_reset') || '';
let openedServers = new Set(JSON.parse(localStorage.getItem('nauvie_opened_servers') || '[]'));

// Auto-Refresh state
let autoRefreshInterval = null;
let autoRefreshTimer = 30; 
let isAutoRefreshChecked = false;

// Auto-Hop State
let autoHopInterval = null;
let autoHopTimer = 60; 
let isAutoHopChecked = false;

// Bảng xếp hạng Mock
let leaderboardData = {
  daily: [
    { username: 'NaUVie', tier: 'pro', count: 189, rank: 1, char: 'N' },
    { username: 'thevintagecards', tier: 'pro', count: 106, rank: 2, char: 'T' },
    { username: 'christhecanuck', tier: 'free', count: 50, rank: 3, char: 'C' },
    { username: 'hoangduc6702', tier: 'free', count: 50, rank: 4, char: 'H' },
    { username: 'kangsayur00001', tier: 'free', count: 48, rank: 5, char: 'K' }
  ],
  monthly: [
    { username: 'NaUVie', tier: 'pro', count: 1250, rank: 1, char: 'N' },
    { username: 'youngpbands.', tier: 'plus', count: 601, rank: 2, char: 'Y' },
    { username: 'eruthros_24', tier: 'free', count: 200, rank: 3, char: 'E' },
    { username: 'phael6706', tier: 'free', count: 198, rank: 4, char: 'P' },
    { username: 'iqnzxl', tier: 'free', count: 189, rank: 5, char: 'I' }
  ],
  overall: [
    { username: 'NaUVie', tier: 'pro', count: 4850, rank: 1, char: 'N' },
    { username: 'youngpbands.', tier: 'plus', count: 1420, rank: 2, char: 'Y' },
    { username: 'thevintagecards', tier: 'pro', count: 1210, rank: 3, char: 'T' },
    { username: 'eruthros_24', tier: 'free', count: 980, rank: 4, char: 'E' },
    { username: 'binhbuiyh', tier: 'free', count: 852, rank: 5, char: 'B' }
  ]
};
let activeTab = 'daily';
let viewMode = localStorage.getItem('nauvie_view_mode') || 'GRID';

// Khởi chạy
document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
  setupThemeColorCustomizer();
  setupHopsLimit();
  setupViewMode();
  setupEventListeners();
  loadServers();
  startBossTimer();
  updateUTCClock();
  setupLeaderboard();
  
  // Khởi tạo trạng thái Auto Hop/Refresh lưu từ trước khi reload
  const isAutoHopActiveSaved = localStorage.getItem('nauvie_is_auto_hop_active') === 'true';
  const isAutoRefreshActiveSaved = localStorage.getItem('nauvie_auto_refresh_active') === 'true';
  const savedTimerValue = localStorage.getItem('nauvie_auto_hop_timer_value') || '60';
  
  // Thiết lập giá trị select từ trước
  const timerSelect = document.getElementById('server-hop-timer-select');
  if (timerSelect) {
    timerSelect.value = savedTimerValue;
  }
  
  if (isAutoHopActiveSaved) {
    isAutoHopChecked = true;
    const autoHopCheck = document.getElementById('server-hop-auto-random');
    if (autoHopCheck) autoHopCheck.checked = true;
    
    // Khôi phục đồng hồ đếm ngược
    autoHopTimer = parseInt(savedTimerValue);
    
    const countdownSpan = document.getElementById('auto-hop-countdown-span');
    if (countdownSpan) countdownSpan.textContent = ` (${autoHopTimer}s)`;
  }
  
  if (isAutoRefreshActiveSaved) {
    isAutoRefreshChecked = true;
    const autoRefreshCheck = document.getElementById('server-hop-auto-refresh');
    if (autoRefreshCheck) autoRefreshCheck.checked = true;
  }

  // Khởi chạy Roblox ngay lập tức nếu có tác vụ Auto Hop đang chờ (Bypass user gesture của Chrome cực kỳ vi diệu)
  const pendingAutoHopJobId = localStorage.getItem('nauvie_pending_auto_hop');
  if (pendingAutoHopJobId) {
    localStorage.removeItem('nauvie_pending_auto_hop');
    const link = `roblox://experiences/start?placeId=${PLACE_ID}&gameInstanceId=${pendingAutoHopJobId}`;
    
    setTimeout(() => {
      window.location.href = link;
      recordHop(pendingAutoHopJobId);
      showToast('success', 'NaUVie Auto Hop! Đang kết nối phòng mới tự động...');
    }, 400);
  }
  
  // Ticking loops qua Inline Web Worker (Chạy ngầm không cần load file ngoài, 100% thành công)
  try {
    const workerCode = `
      let interval = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (interval) clearInterval(interval);
          interval = setInterval(() => {
            self.postMessage('tick');
          }, 1000);
        } else if (e.data === 'stop') {
          if (interval) clearInterval(interval);
          interval = null;
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const timerWorker = new Worker(workerUrl);
    
    timerWorker.onmessage = () => {
      tickAutoRefresh();
      tickAutoHop();
      updateUTCClock();
    };
    timerWorker.postMessage('start');
    console.log("[KEEP-ALIVE] Inline Web Worker started successfully!");
  } catch (err) {
    console.warn("[KEEP-ALIVE] Inline Web Worker failed, falling back to setInterval:", err);
    setInterval(() => {
      tickAutoRefresh();
      tickAutoHop();
      updateUTCClock();
    }, 1000);
  }
});

// Cài đặt chế độ hiển thị Card / List
function setupViewMode() {
  const grid = document.getElementById('servers-grid');
  const viewModeToggle = document.getElementById('view-mode-toggle');
  
  if (viewMode === 'LIST' && grid) {
    grid.classList.add('view-list-active');
  }
  
  if (viewModeToggle) {
    const viewButtons = viewModeToggle.querySelectorAll('.segment-btn');
    viewButtons.forEach(btn => {
      if (btn.dataset.value === viewMode) {
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-checked', 'false');
      }
      
      btn.addEventListener('click', () => {
        viewButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        
        viewMode = btn.dataset.value;
        localStorage.setItem('nauvie_view_mode', viewMode);
        
        const currentGrid = document.getElementById('servers-grid');
        if (currentGrid) {
          if (viewMode === 'LIST') {
            currentGrid.classList.add('view-list-active');
          } else {
            currentGrid.classList.remove('view-list-active');
          }
        }
      });
    });
  }
}

// Thiết lập giao diện Sáng / Tối
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

// Giới hạn Hop hôm nay
function setupHopsLimit() {
  const today = new Date().toDateString();
  if (lastHopReset !== today) {
    hopsToday = 0;
    lastHopReset = today;
    localStorage.setItem('nauvie_hops_today', '0');
    localStorage.setItem('nauvie_hops_last_reset', today);
  }
  const hopsTodayVal = document.getElementById('hops-today-value');
  if (hopsTodayVal) hopsTodayVal.textContent = hopsToday;
  
  const planFooterHops = document.getElementById('plan-footer-hops');
  if (planFooterHops) planFooterHops.textContent = `Tài khoản của bạn đã được nâng cấp lên ELITE thành công bởi NaUVie! Đã thực hiện ${hopsToday} hops hôm nay.`;
}

// Lưu lịch sử hop
function recordHop(jobId) {
  openedServers.add(jobId);
  localStorage.setItem('nauvie_opened_servers', JSON.stringify([...openedServers]));
  
  hopsToday++;
  localStorage.setItem('nauvie_hops_today', hopsToday);
  setupHopsLimit();
  
  // Cập nhật điểm của NaUVie trên BXH
  updateLeaderboardUserScore();
}

function updateLeaderboardUserScore() {
  const profileUsername = document.getElementById('profile-username');
  const username = profileUsername ? profileUsername.textContent : 'NaUVie';
  
  // Cập nhật trong daily
  let dailyUser = leaderboardData.daily.find(u => u.username === username);
  if (dailyUser) {
    dailyUser.count = 189 + hopsToday; // Giữ điểm nền siêu khủng của NaUVie
  }
  
  // Sắp xếp lại
  leaderboardData.daily.sort((a, b) => b.count - a.count);
  leaderboardData.daily.forEach((u, index) => u.rank = index + 1);
  
  setupLeaderboard();
}

// Lấy danh sách server từ API proxy
async function loadServers() {
  const grid = document.getElementById('servers-grid');
  const loader = document.getElementById('loading-overlay');
  
  grid.innerHTML = '';
  loader.classList.remove('hidden');
  
  const statusDot = document.querySelector('.green-glow-dot');
  const statusBadge = document.querySelector('.indicator-badge');
  const statusText = statusBadge ? statusBadge.querySelector('span:last-child') : null;
  
  try {
    const response = await fetch('/api/servers');
    if (!response.ok) {
      throw new Error('Không thể lấy dữ liệu từ Roblox proxy engine.');
    }
    
    const resData = await response.json();
    if (resData.success && resData.servers) {
      allServers = resData.servers;
      processAndRenderServers();
      
      if (resData.stale) {
        if (statusBadge) {
          statusBadge.style.background = 'rgba(255, 159, 10, 0.08)';
          statusBadge.style.borderColor = 'rgba(255, 159, 10, 0.3)';
          statusBadge.style.color = 'var(--nauvie-amber)';
        }
        if (statusDot) {
          statusDot.style.background = 'var(--nauvie-amber)';
          statusDot.style.boxShadow = '0 0 10px var(--nauvie-amber)';
        }
        if (statusText) {
          statusText.textContent = 'ROBLOX RATE LIMIT (429)';
        }
        
        showToast('error', `NaUVie Hub: Bị giới hạn tốc độ Roblox (429). Đang hiển thị dữ liệu lưu tạm.`);
      } else {
        if (statusBadge) {
          statusBadge.style.background = 'rgba(0, 255, 135, 0.08)';
          statusBadge.style.borderColor = 'rgba(0, 255, 135, 0.2)';
          statusBadge.style.color = 'var(--nauvie-green)';
        }
        if (statusDot) {
          statusDot.style.background = 'var(--nauvie-green)';
          statusDot.style.boxShadow = 'var(--neon-green-glow)';
        }
        if (statusText) {
          statusText.textContent = 'PROXY ONLINE';
        }
        
        showToast('success', `NaUVie Hub: Tải thành công ${allServers.length} server đang hoạt động!`);
      }
    } else {
      throw new Error(resData.error || 'Dữ liệu không đúng cấu trúc API.');
    }
  } catch (error) {
    console.error(error);
    showToast('error', `Lỗi kết nối API: ${error.message}`);
    
    const isRateLimit = error.message.includes('giới hạn') || error.message.includes('Rate Limit') || error.message.includes('429');
    
    if (isRateLimit) {
      grid.innerHTML = `
        <div class="no-servers-placeholder" style="border-color: var(--nauvie-amber);">
          <p class="empty-title" style="color: var(--nauvie-amber);">// ROBLOX ĐANG GIỚI HẠN TỐC ĐỘ (429)</p>
          <p class="empty-subtitle">${error.message}</p>
          <p class="empty-subtitle" style="font-size: 11px; margin-top: 8px; color: var(--text-normal);">Mẹo: Hãy đợi khoảng 15-30 giây rồi bấm nút <strong>REFRESH</strong> để quét lại phòng nhé.</p>
        </div>
      `;
    } else {
      grid.innerHTML = `
        <div class="no-servers-placeholder" style="border-color: var(--nauvie-red);">
          <p class="empty-title" style="color: var(--nauvie-red);">// LỖI KẾT NỐI HỆ THỐNG PROXY</p>
          <p class="empty-subtitle">${error.message}. Hãy kiểm tra xem server Node.js đang chạy tốt ở cổng 3000 không.</p>
        </div>
      `;
    }
  } finally {
    loader.classList.add('hidden');
  }
}

// Xử lý bộ lọc và sắp xếp
function processAndRenderServers() {
  filteredServers = allServers.filter(server => {
    const players = server.playing;
    if (playerFilter === 'EMPTY') return players <= 1;
    if (playerFilter === 'OPEN') return players >= 2 && players <= 4;
    return players <= 4; // 'ALL' - only empty/medium servers are loaded now
  });
  
  const sortSelect = document.getElementById('server-sort-select');
  const activeSort = sortSelect ? sortSelect.value : 'PLAYERS_ASC';
  
  if (activeSort === 'PLAYERS_ASC') {
    filteredServers.sort((a, b) => a.playing - b.playing);
  } else if (activeSort === 'PLAYERS_DESC') {
    filteredServers.sort((a, b) => b.playing - a.playing);
  } else if (activeSort === 'PING_ASC') {
    filteredServers.sort((a, b) => a.ping - b.ping);
  } else if (activeSort === 'FPS_DESC') {
    filteredServers.sort((a, b) => (b.fps || 60) - (a.fps || 60));
  }
  
  visibleServersCount = 12;
  
  // Cập nhật Strip thông số
  document.getElementById('stat-total-servers').textContent = allServers.length;
  
  const lowPopCount = allServers.filter(s => s.playing <= 3).length;
  document.getElementById('stat-lowpop-servers').textContent = lowPopCount;
  
  const now = new Date();
  document.getElementById('stat-last-updated').textContent = `${now.toLocaleTimeString()}`;
  
  renderGrid();
}

// Tạo giao diện các card server
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
    grid.innerHTML = `
      <div class="no-servers-placeholder">
        <p class="empty-title">// KHÔNG TÌM THẤY SERVER PHÙ HỢP</p>
        <p class="empty-subtitle">Hãy thử chọn phân loại người chơi khác hoặc bấm nạp lại danh sách.</p>
      </div>
    `;
    showMoreBtn.classList.add('hidden');
    return;
  }
  
  const slice = filteredServers.slice(0, visibleServersCount);
  
  slice.forEach(server => {
    const isOpened = openedServers.has(server.id);
    const playerPercent = Math.min(100, Math.round((server.playing / server.maxPlayers) * 100));
    
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
    if (server.ping > 150) pingClass = 'poor';
    else if (server.ping > 80) pingClass = 'fair';
    
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
          <span class="cam-hop-card__count-cap">${server.maxPlayers}</span>
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
          <span class="cam-hop-card__meta-v">${server.ping}ms</span>
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
  
  if (filteredServers.length > visibleServersCount) {
    showMoreBtn.classList.remove('hidden');
    const remaining = filteredServers.length - visibleServersCount;
    document.getElementById('remaining-count-hint').textContent = `(Còn ${remaining} phòng)`;
  } else {
    showMoreBtn.classList.add('hidden');
  }
}

// Join server qua Roblox Protocol URI
function joinRobloxServer(jobId, isAutoTriggered = false) {
  const link = `roblox://experiences/start?placeId=${PLACE_ID}&gameInstanceId=${jobId}`;
  
  if (isAutoTriggered) {
    // Tự động nhảy phòng chạy ngầm: Tải lại trang để bypass chặn "user gesture" của Chrome
    localStorage.setItem('nauvie_pending_auto_hop', jobId);
    localStorage.setItem('nauvie_is_auto_hop_active', 'true');
    localStorage.setItem('nauvie_auto_refresh_active', isAutoRefreshChecked ? 'true' : 'false');
    
    showToast('info', 'Đang tự động chuyển trang để kết nối game...');
    setTimeout(() => {
      window.location.reload();
    }, 150);
    return;
  }
  
  // Click thủ công: Mở trực tiếp bình thường
  showToast('info', 'Đang kết nối Roblox Launcher...');
  window.location.href = link;
  
  recordHop(jobId);
  processAndRenderServers();
}

// Copy câu lệnh JS console
function copyConsoleCommand(jobId, event) {
  event.stopPropagation();
  const command = `Roblox.GameLauncher.joinGameInstance(${PLACE_ID}, "${jobId}")`;
  
  navigator.clipboard.writeText(command)
    .then(() => {
      showToast('success', 'Đã copy đoạn mã console của NaUVie Hub!');
    })
    .catch(err => {
      showToast('error', 'Lỗi copy mã vào clipboard.');
    });
}

// Hộp thoại thông báo Toast cao cấp
function showToast(type, message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  
  // Tránh spam nhiều thông báo y hệt nhau chồng chất lên màn hình
  const activeToasts = Array.from(container.children);
  const isDuplicate = activeToasts.some(t => {
    const textSpan = t.querySelector('span:last-child');
    return textSpan && textSpan.textContent === message;
  });
  if (isDuplicate) return;
  
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
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// Cập nhật Highlight cho chip Sắp xếp dựa trên state sortOrder
function updateSortChipsHighlight() {
  const sortChips = document.querySelectorAll('#sort-players .segment-btn');
  sortChips.forEach(c => {
    if (c.dataset.value === sortOrder) {
      c.classList.add('active');
      c.setAttribute('aria-checked', 'true');
    } else {
      c.classList.remove('active');
      c.setAttribute('aria-checked', 'false');
    }
  });
}

// Bắt sự kiện người dùng tương tác
function setupEventListeners() {
  // Lọc số người chơi (segment buttons)
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
      
      // Render immediately from cache
      processAndRenderServers();
    });
  });
  
  // Nút Refresh tay
  document.getElementById('manual-refresh-btn').addEventListener('click', () => {
    loadServers();
  });

  // Chọn sắp xếp server
  const sortSelect = document.getElementById('server-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      processAndRenderServers();
    });
  }
  
  // Nút xem thêm phòng
  document.getElementById('show-more-btn').addEventListener('click', () => {
    visibleServersCount += 12;
    renderGrid();
  });
  
  // FAQ accordion toggle
  const faqToggle = document.getElementById('faq-toggle');
  const faqContent = document.getElementById('faq-content');
  const faqChevron = document.querySelector('.faq-chevron');
  
  faqToggle.addEventListener('click', () => {
    const isHidden = faqContent.classList.toggle('hidden');
    faqChevron.classList.toggle('active', !isHidden);
  });
  
  // Auto Refresh Listener
  const autoRefreshCheck = document.getElementById('server-hop-auto-refresh');
  autoRefreshCheck.addEventListener('change', (e) => {
    isAutoRefreshChecked = e.target.checked;
    autoRefreshTimer = 30;
    document.getElementById('auto-refresh-timer').textContent = `30s`;
    localStorage.setItem('nauvie_auto_refresh_active', isAutoRefreshChecked ? 'true' : 'false');
    
    const pollingStatus = document.getElementById('polling-status-desc');
    if (pollingStatus) {
      if (isAutoRefreshChecked) {
        pollingStatus.textContent = 'Auto Polling (30s)';
        pollingStatus.className = 'value-text text-green';
        showToast('info', 'Đã kích hoạt tự động quét danh sách sau mỗi 30 giây.');
      } else {
        pollingStatus.textContent = 'Quét thủ công';
        pollingStatus.className = 'value-text';
      }
    } else {
      if (isAutoRefreshChecked) {
        showToast('info', 'Đã kích hoạt tự động quét danh sách sau mỗi 30 giây.');
      }
    }
  });

  // Auto Hop Listener
  const autoHopCheck = document.getElementById('server-hop-auto-random');
  const timerSelect = document.getElementById('server-hop-timer-select');
  const countdownSpan = document.getElementById('auto-hop-countdown-span');

  autoHopCheck.addEventListener('change', (e) => {
    isAutoHopChecked = e.target.checked;
    localStorage.setItem('nauvie_is_auto_hop_active', isAutoHopChecked ? 'true' : 'false');
    localStorage.setItem('nauvie_auto_hop_timer_value', timerSelect.value);
    
    if (isAutoHopChecked) {
      const selectedSeconds = parseInt(timerSelect.value);
      autoHopTimer = selectedSeconds;
      countdownSpan.textContent = ` (${autoHopTimer}s)`;
      showToast('info', `Tự động nhảy phòng đã kích hoạt. Quá trình bắt đầu sau ${autoHopTimer} giây.`);
    } else {
      countdownSpan.textContent = '';
    }
  });

  timerSelect.addEventListener('change', () => {
    localStorage.setItem('nauvie_auto_hop_timer_value', timerSelect.value);
    if (isAutoHopChecked) {
      const selectedSeconds = parseInt(timerSelect.value);
      autoHopTimer = selectedSeconds;
      countdownSpan.textContent = ` (${autoHopTimer}s)`;
      showToast('info', `Đã đổi thời gian tự động nhảy sang ${autoHopTimer} giây.`);
    }
  });

  // Random Quick Hop
  document.getElementById('quick-join-btn').addEventListener('click', () => {
    performRandomQuickJoin();
  });

  // Chuyển đổi Tab (Danh sách server / Hướng dẫn cày cuốc)
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

// Logic Thuật toán Hợp Phòng Nhanh
function performRandomQuickJoin(isAutoTriggered = false) {
  // Tìm các server từ 2-4 người chưa nhảy qua
  let pool = allServers.filter(s => s.playing >= 2 && s.playing <= 4 && !openedServers.has(s.id));
  
  // Nới lỏng lên 2-6 người
  if (pool.length === 0) {
    pool = allServers.filter(s => s.playing >= 2 && s.playing <= 6 && !openedServers.has(s.id));
  }
  
  // Lấy server đầu tiên trong danh sách bộ lọc đã chọn
  if (pool.length === 0) {
    pool = filteredServers.filter(s => !openedServers.has(s.id));
  }
  
  // Reset lịch sử nếu đã mở hết
  if (pool.length === 0 && allServers.length > 0) {
    openedServers.clear();
    localStorage.setItem('nauvie_opened_servers', '[]');
    pool = allServers;
  }
  
  if (pool.length > 0) {
    const randomIndex = Math.floor(Math.random() * pool.length);
    const chosen = pool[randomIndex];
    
    showToast('success', `NaUVie Hop Nhanh! Đang kết nối phòng ${chosen.id.substring(0,8)} (${chosen.playing} người).`);
    joinRobloxServer(chosen.id, isAutoTriggered);
  } else {
    showToast('error', 'Không có server khả dụng để hop nhanh. Hãy quét lại danh sách.');
  }
}

// Loops ticking timers
function tickAutoRefresh() {
  if (!isAutoRefreshChecked) return;
  
  autoRefreshTimer--;
  document.getElementById('auto-refresh-timer').textContent = `${autoRefreshTimer}s`;
  
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
  if (countdownSpan) {
    countdownSpan.textContent = ` (${autoHopTimer}s)`;
  }
  
  if (autoHopTimer <= 0) {
    const timerSelect = document.getElementById('server-hop-timer-select');
    autoHopTimer = parseInt(timerSelect ? timerSelect.value : '60');
    if (countdownSpan) countdownSpan.textContent = ` (${autoHopTimer}s)`;
    performRandomQuickJoin(true);
  }
}

// Đếm ngược Boss spawn UTC (:00, :15, :30, :45)
// Catch a Monster boss rift
function startBossTimer() {
  setInterval(updateBossTimer, 1000);
  updateBossTimer();
}

function updateBossTimer() {
  const now = new Date();
  const utcMinutes = now.getUTCMinutes();
  const utcSeconds = now.getUTCSeconds();
  
  const nextTargetMinute = Math.ceil((utcMinutes + 0.1) / 15) * 15;
  let diffMinutes = nextTargetMinute - utcMinutes - 1;
  let diffSeconds = 60 - utcSeconds;
  
  if (diffSeconds === 60) {
    diffSeconds = 0;
    diffMinutes++;
  }
  
  const minStr = String(diffMinutes).padStart(2, '0');
  const secStr = String(diffSeconds).padStart(2, '0');
  
  const timerLabel = document.getElementById('boss-countdown');
  if (timerLabel) timerLabel.textContent = `${minStr}:${secStr}`;
  
  // Nháy đỏ báo động trước 2 phút
  const banner = document.getElementById('boss-alert-banner');
  if (banner) {
    if (diffMinutes < 2) {
      banner.classList.add('phase-active');
    } else {
      banner.classList.remove('phase-active');
    }
  }
  
  updateBossScheduleFeed(now);
}

// Cập nhật lịch báo trước Boss
function updateBossScheduleFeed(nowDate) {
  const feed = document.getElementById('boss-schedule-feed');
  if (!feed) return;
  feed.innerHTML = '';
  
  const currentUTCMin = nowDate.getUTCMinutes();
  const currentUTCHour = nowDate.getUTCHours();
  
  let baseCycle = Math.floor(currentUTCMin / 15) * 15;
  
  for (let i = 1; i <= 4; i++) {
    let cycleMin = baseCycle + (i * 15);
    let cycleHour = currentUTCHour;
    
    if (cycleMin >= 60) {
      cycleHour = (cycleHour + Math.floor(cycleMin / 60)) % 24;
      cycleMin = cycleMin % 60;
    }
    
    const timeStr = `${String(cycleHour).padStart(2, '0')}:${String(cycleMin).padStart(2, '0')}`;
    const isHourBoss = cycleMin === 0;
    
    const feedRow = document.createElement('div');
    feedRow.className = 'feed-row';
    feedRow.innerHTML = `
      <span class="t">${timeStr}</span>
      <span class="msg">
        ${isHourBoss ? 'Boss Giờ <span class="gold-text">★ Spawn đặc biệt</span>' : 'Quarter Boss Rift'}
      </span>
    `;
    feed.appendChild(feedRow);
  }
}

// Giờ UTC
function updateUTCClock() {
  const now = new Date();
  const utcText = document.getElementById('rail-utc-time');
  if (utcText) utcText.textContent = now.toUTCString().substring(17, 25) + ' UTC';
}

// Bảng xếp hạng Hoppers
function setupLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  if (!list) return;
  list.innerHTML = '';
  
  const dataset = leaderboardData[activeTab];
  
  dataset.slice(0, 5).forEach((user, index) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row';
    
    row.innerHTML = `
      <span class="leaderboard-rank rank-${user.rank}">${user.rank}</span>
      <div class="leaderboard-avatar">${user.char}</div>
      <div class="leaderboard-name">${user.username}</div>
      <span class="leaderboard-tier leaderboard-tier--${user.tier}">${user.tier}</span>
      <span class="leaderboard-count">${user.count} hops</span>
    `;
    list.appendChild(row);
  });
  
  // Tabs click
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      setupLeaderboard();
    };
  });
}

// ========================================================
// Background Keep-Alive Audio Hack (Bypass Browser Throttling)
// ========================================================
let silentAudioCtx = null;

function startSilentAudioKeepAlive() {
  if (silentAudioCtx) return; // Already initialized
  
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    
    silentAudioCtx = new AudioContextClass();
    
    // Create continuous high-frequency oscillator (20,000 Hz)
    // 20,000 Hz is completely inaudible to human ears, making it 100% silent.
    const osc = silentAudioCtx.createOscillator();
    const gainNode = silentAudioCtx.createGain();
    
    osc.frequency.value = 20000; 
    gainNode.gain.value = 0.00001; // Ultra-low volume (completely silent & safe)
    
    osc.connect(gainNode);
    gainNode.connect(silentAudioCtx.destination);
    
    osc.start(0);
    
    // Explicitly resume the AudioContext to ensure it active immediately
    if (silentAudioCtx.state === 'suspended') {
      silentAudioCtx.resume().then(() => {
        console.log("[KEEP-ALIVE] AudioContext explicitly resumed on click. State:", silentAudioCtx.state);
      });
    } else {
      console.log("[KEEP-ALIVE] AudioContext started in active state:", silentAudioCtx.state);
    }
    
    // Keep AudioContext resumed if suspended by browser autoplay policies
    setInterval(() => {
      if (silentAudioCtx && silentAudioCtx.state === 'suspended') {
        silentAudioCtx.resume().then(() => {
          console.log("[KEEP-ALIVE] Resumed suspended AudioContext in background loop.");
        });
      }
    }, 1000);
    
    console.log("[KEEP-ALIVE] Inaudible continuous oscillator keep-alive active. Tab is 100% immune to background throttling!");
  } catch (err) {
    console.warn("[KEEP-ALIVE] Failed to initialize keep-alive audio:", err);
  }
}

// Hook onto the first user interaction to comply with browser autoplay policies
['click', 'touchstart', 'keydown', 'mousedown'].forEach(evt => {
  window.addEventListener(evt, startSilentAudioKeepAlive, { once: true, passive: true });
});

// ========================================================
// Theme Color Customizer Implementation
// ========================================================
function setupThemeColorCustomizer() {
  const savedColor = localStorage.getItem('nauvie_theme_color');
  const presetButtons = document.querySelectorAll('.preset-color-btn');
  const colorPicker = document.getElementById('custom-theme-color-picker');
  const colorPickerWrapper = document.querySelector('.custom-color-picker-wrapper');
  const colorHexText = document.getElementById('current-color-hex');
  const resetBtn = document.getElementById('reset-theme-color-btn');

  // Hàm áp dụng màu sắc vào các biến CSS
  function applyThemeColor(hex) {
    if (!hex) return;
    
    const root = document.documentElement;
    root.style.setProperty('--primary-blue', hex);
    
    // Tạo màu hover (sáng/tối hơn một chút) và border
    // Chuyển hex sang rgb để tạo các giá trị rgba
    const rgb = hexToRgb(hex);
    if (rgb) {
      // Lighten or darken slightly for hover state
      const isLight = document.body.classList.contains('light-theme');
      const hoverHex = lightenDarkenColor(hex, isLight ? -20 : 20); 
      root.style.setProperty('--primary-hover', hoverHex);
      
      // Don't override light theme border (which uses clean specular semi-transparent white highlight)
      if (!isLight) {
        root.style.setProperty('--cyber-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
        root.style.setProperty('--cyber-border-hover', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
        document.body.style.backgroundImage = `radial-gradient(circle at 50% 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.035) 0%, transparent 50%)`;
      } else {
        root.style.removeProperty('--cyber-border');
        root.style.removeProperty('--cyber-border-hover');
        document.body.style.backgroundImage = `
          radial-gradient(at 0% 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05) 0px, transparent 50%), 
          radial-gradient(at 50% 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.06) 0px, transparent 50%),
          radial-gradient(at 100% 0%, rgba(244, 63, 94, 0.02) 0px, transparent 40%)
        `;
      }
    }
    
    if (colorHexText) {
      colorHexText.textContent = hex.toUpperCase();
      colorHexText.style.color = hex;
    }
  }

  // Khởi động từ cache
  if (savedColor) {
    applyThemeColor(savedColor);
    if (colorPicker) colorPicker.value = savedColor;
    
    // Đánh dấu nút active tương ứng
    let matchedPreset = false;
    presetButtons.forEach(btn => {
      if (btn.dataset.color.toLowerCase() === savedColor.toLowerCase()) {
        btn.classList.add('active');
        matchedPreset = true;
      } else {
        btn.classList.remove('active');
      }
    });
    
    if (!matchedPreset && colorPickerWrapper) {
      colorPickerWrapper.classList.add('active');
    }
  }

  // Sự kiện khi nhấn các preset màu có sẵn
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      if (colorPickerWrapper) colorPickerWrapper.classList.remove('active');
      
      btn.classList.add('active');
      const color = btn.dataset.color;
      
      applyThemeColor(color);
      localStorage.setItem('nauvie_theme_color', color);
      if (colorPicker) colorPicker.value = color;
      
      showToast('success', `Đã đổi màu chủ đề thành ${btn.title}!`);
    });
  });

  // Sự kiện khi thay đổi bảng màu Picker
  if (colorPicker) {
    colorPicker.addEventListener('input', (e) => {
      const color = e.target.value;
      presetButtons.forEach(b => b.classList.remove('active'));
      if (colorPickerWrapper) colorPickerWrapper.classList.add('active');
      
      applyThemeColor(color);
      localStorage.setItem('nauvie_theme_color', color);
    });

    colorPicker.addEventListener('change', (e) => {
      showToast('success', `Đã lưu màu tự chọn: ${e.target.value.toUpperCase()}!`);
    });
  }

  // --- Xử lý ẢNH NỀN TÙY CHỌN (LƯU CỤC BỘ TRONG TRÌNH DUYỆT) ---
  const bgUploader = document.getElementById('custom-bg-uploader');
  const removeBgBtn = document.getElementById('remove-custom-bg-btn');

  // Hàm hiển thị hình nền tùy chọn lên body với lớp phủ mờ bảo toàn độ tương phản
  function applyCustomBackground(base64Url) {
    if (!base64Url) {
      document.body.style.removeProperty('background-image');
      if (removeBgBtn) removeBgBtn.style.display = 'none';
      
      // Khôi phục lại gradient vòng hào quang cyan mặc định nếu là dark theme
      const currentActiveColor = localStorage.getItem('nauvie_theme_color') || '#00f0ff';
      applyThemeColor(currentActiveColor);
      return;
    }

    const isLight = document.body.classList.contains('light-theme');
    // Áp dụng lớp phủ tối (hoặc sáng) tinh tế lên trên ảnh nền để giữ độ tương phản cao cho chữ và thẻ!
    const overlay = isLight 
      ? 'linear-gradient(rgba(243, 244, 246, 0.88), rgba(243, 244, 246, 0.88))'
      : 'linear-gradient(rgba(10, 12, 18, 0.88), rgba(10, 12, 18, 0.88))';
    
    document.body.style.backgroundImage = `${overlay}, url(${base64Url})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    
    if (removeBgBtn) removeBgBtn.style.display = 'block';
  }

  // Khởi động load ảnh nền từ cache
  const savedBg = localStorage.getItem('nauvie_custom_bg');
  if (savedBg) {
    applyCustomBackground(savedBg);
  }

  // Lắng nghe sự kiện Upload ảnh
  if (bgUploader) {
    bgUploader.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showToast('error', 'Vui lòng chọn một tệp hình ảnh hợp lệ!');
        return;
      }

      showToast('info', 'Đang tối ưu dung lượng ảnh nền...');

      const reader = new FileReader();
      reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
          // Khởi tạo Canvas để resize và nén chất lượng ảnh
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Đặt kích thước tối đa là Full HD (1920x1080) để tối ưu dung lượng localStorage
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

          // Nén ảnh sang JPEG chất lượng 0.75 (dung lượng sẽ chỉ khoảng 100KB-200KB cực nhẹ!)
          try {
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
            
            // Ghi đè lưu trữ vào localStorage
            localStorage.setItem('nauvie_custom_bg', compressedBase64);
            
            // Áp dụng ngay lập tức
            applyCustomBackground(compressedBase64);
            
            showToast('success', 'Đã lưu và áp dụng ảnh nền thành công!');
          } catch (err) {
            console.error(err);
            showToast('error', 'Ảnh quá lớn! Hãy thử chọn ảnh khác nhẹ hơn.');
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Lắng nghe nút Xóa ảnh nền
  if (removeBgBtn) {
    removeBgBtn.addEventListener('click', () => {
      localStorage.removeItem('nauvie_custom_bg');
      applyCustomBackground(null);
      if (bgUploader) bgUploader.value = ''; // Clear file input
      showToast('success', 'Đã xóa ảnh nền tùy chọn và khôi phục mặc định!');
    });
  }

  // --- Xử lý ĐỘ TRONG SUỐT GIAO DIỆN (GLASSMOPHISM) ---
  const opacitySlider = document.getElementById('glass-opacity-slider');
  const opacityValText = document.getElementById('glass-opacity-val');

  // Hàm áp dụng độ trong suốt của card & panel
  function applyGlassOpacity(percentage) {
    if (!percentage) percentage = 65; // Mặc định 65%
    const alpha = percentage / 100;
    const isLight = document.body.classList.contains('light-theme');
    const root = document.documentElement;

    if (isLight) {
      // Light theme: Nền trắng frost
      const panelAlpha = Math.max(0.1, alpha - 0.2); // Panel nhạt hơn
      root.style.setProperty('--bg-panel', `rgba(255, 255, 255, ${panelAlpha})`);
      root.style.setProperty('--bg-card', `rgba(255, 255, 255, ${alpha})`);
    } else {
      // Dark theme: Nền tối obsidian mờ
      const cardAlpha = Math.max(0.1, alpha - 0.05); // Card nhạt hơn một chút
      root.style.setProperty('--bg-panel', `rgba(10, 12, 18, ${alpha})`);
      root.style.setProperty('--bg-card', `rgba(20, 22, 33, ${cardAlpha})`);
    }

    if (opacityValText) {
      opacityValText.textContent = `${percentage}%`;
    }
    if (opacitySlider) {
      opacitySlider.value = percentage;
    }
  }

  // Khởi động load độ trong suốt từ cache
  const savedOpacity = localStorage.getItem('nauvie_glass_opacity');
  if (savedOpacity) {
    applyGlassOpacity(parseInt(savedOpacity, 10));
  } else {
    applyGlassOpacity(65);
  }

  // Lắng nghe sự kiện di chuyển slider
  if (opacitySlider) {
    opacitySlider.addEventListener('input', (e) => {
      const percentage = e.target.value;
      applyGlassOpacity(percentage);
      localStorage.setItem('nauvie_glass_opacity', percentage);
    });
  }

  // ========================================================
  // BỘ ĐIỀU KHIỂN & HIỆU ỨNG HOẠT HỌA NỀN (CANVAS ENGINE)
  // ========================================================
  const particlesCanvas = document.getElementById('particles-canvas');
  const effectSelect = document.getElementById('particles-effect-select');
  
  let animationFrameId = null;
  let particlesArray = [];
  let canvasCtx = null;

  if (particlesCanvas) {
    canvasCtx = particlesCanvas.getContext('2d');
  }

  // Khởi tạo kích thước canvas
  function resizeCanvas() {
    if (!particlesCanvas) return;
    particlesCanvas.width = window.innerWidth;
    particlesCanvas.height = window.innerHeight;
  }
  
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Class định nghĩa các loại Hạt/Hiệu ứng hoạt họa
  class Particle {
    constructor(effectType) {
      this.reset(effectType, true);
    }

    reset(effectType, isInit = false) {
      if (!particlesCanvas) return;
      this.effectType = effectType;
      
      const width = particlesCanvas.width;
      const height = particlesCanvas.height;

      // Đặt toạ độ xuất phát tùy thuộc hiệu ứng
      if (effectType === 'GLOW') {
        // Hạt sáng bay từ dưới lên
        this.x = Math.random() * width;
        this.y = isInit ? Math.random() * height : height + 10;
        this.size = Math.random() * 4 + 2;
        this.speedY = -(Math.random() * 0.8 + 0.3); // Bay lên trên
        this.speedX = Math.random() * 0.4 - 0.2;
        this.opacity = Math.random() * 0.45 + 0.2;
        this.swaySpeed = Math.random() * 0.02 + 0.01;
        this.swayAngle = Math.random() * Math.PI * 2;
        this.swayRadius = Math.random() * 0.8 + 0.2;
      } else if (effectType === 'SAKURA') {
        // Mưa anh đào rơi chéo từ trên xuống dưới trái
        this.x = Math.random() * (width + 100) - 50;
        this.y = isInit ? Math.random() * height : -20;
        this.size = Math.random() * 5 + 4;
        this.speedY = Math.random() * 0.8 + 0.5;
        this.speedX = -(Math.random() * 0.5 + 0.2); // Bay lệch trái
        this.opacity = Math.random() * 0.5 + 0.3;
        this.spin = Math.random() * 0.02 - 0.01;
        this.angle = Math.random() * Math.PI * 2;
        this.swaySpeed = Math.random() * 0.02 + 0.01;
        this.swayAngle = Math.random() * Math.PI * 2;
        this.swayRadius = Math.random() * 1.5 + 0.5;
      } else if (effectType === 'SNOW') {
        // Bông tuyết rơi thẳng nhẹ nhàng
        this.x = Math.random() * width;
        this.y = isInit ? Math.random() * height : -10;
        this.size = Math.random() * 3 + 1.5;
        this.speedY = Math.random() * 0.7 + 0.3;
        this.speedX = Math.random() * 0.2 - 0.1;
        this.opacity = Math.random() * 0.6 + 0.2;
        this.swaySpeed = Math.random() * 0.015 + 0.005;
        this.swayAngle = Math.random() * Math.PI * 2;
        this.swayRadius = Math.random() * 0.8 + 0.2;
      } else if (effectType === 'MATRIX') {
        // Ma trận ký tự rơi thẳng đứng
        this.x = Math.random() * width;
        // Chia hàng dọc 14px để thẳng hàng
        this.x = Math.floor(this.x / 14) * 14;
        this.y = isInit ? Math.random() * height : -20;
        this.size = Math.random() * 4 + 10; // Kích cỡ font chữ (10px-14px)
        this.speedY = Math.random() * 2 + 1.5; // Rơi rất nhanh
        this.speedX = 0;
        this.opacity = Math.random() * 0.75 + 0.25;
        
        // Ký tự ngẫu nhiên
        const chars = '01abcdefghijklmnopqrstuvwxyz日ハミヒーウシ';
        this.char = chars.charAt(Math.floor(Math.random() * chars.length));
        this.frameCounter = 0;
      } else if (effectType === 'STARS') {
        // Sao băng vạch chéo cực nhanh từ trên phải xuống dưới trái
        this.x = Math.random() * (width + 200) - 100;
        this.y = isInit ? Math.random() * height : -50;
        this.size = Math.random() * 40 + 30; // Độ dài vệt
        this.speedY = Math.random() * 3 + 4; // Rơi cực nhanh
        this.speedX = -(this.speedY * 1.2); // Chéo nghiêng góc
        this.opacity = Math.random() * 0.5 + 0.1;
        this.lineWidth = Math.random() * 1.5 + 0.5;
      }
    }

    update(effectType) {
      if (!particlesCanvas) return;
      this.effectType = effectType;

      if (effectType === 'GLOW') {
        this.y += this.speedY;
        this.swayAngle += this.swaySpeed;
        this.x += this.speedX + Math.sin(this.swayAngle) * this.swayRadius;
        
        // Reset khi bay hết màn hình trên
        if (this.y < -10) this.reset(effectType, false);
      } else if (effectType === 'SAKURA') {
        this.y += this.speedY;
        this.x += this.speedX;
        this.swayAngle += this.swaySpeed;
        this.x += Math.sin(this.swayAngle) * this.swayRadius;
        this.angle += this.spin;

        if (this.y > particlesCanvas.height + 10 || this.x < -60 || this.x > particlesCanvas.width + 60) {
          this.reset(effectType, false);
        }
      } else if (effectType === 'SNOW') {
        this.y += this.speedY;
        this.x += this.speedX;
        this.swayAngle += this.swaySpeed;
        this.x += Math.sin(this.swayAngle) * this.swayRadius;

        if (this.y > particlesCanvas.height + 10 || this.x < -10 || this.x > particlesCanvas.width + 10) {
          this.reset(effectType, false);
        }
      } else if (effectType === 'MATRIX') {
        this.y += this.speedY;
        this.frameCounter++;
        // Thay đổi ký tự ngẫu nhiên theo khung hình
        if (this.frameCounter % 15 === 0) {
          const chars = '01abcdefghijklmnopqrstuvwxyz日ハミヒーウシ';
          this.char = chars.charAt(Math.floor(Math.random() * chars.length));
        }

        if (this.y > particlesCanvas.height + 20) {
          this.reset(effectType, false);
        }
      } else if (effectType === 'STARS') {
        this.y += this.speedY;
        this.x += this.speedX;

        if (this.y > particlesCanvas.height + 50 || this.x < -100) {
          this.reset(effectType, false);
        }
      }
    }

    draw(activeColor) {
      if (!canvasCtx) return;
      canvasCtx.save();

      if (this.effectType === 'GLOW') {
        // Hạt sáng neon huyền ảo
        canvasCtx.translate(this.x, this.y);
        canvasCtx.globalAlpha = this.opacity;
        const gradient = canvasCtx.createRadialGradient(0, 0, 0, 0, 0, this.size);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, activeColor);
        gradient.addColorStop(1, 'transparent');
        canvasCtx.fillStyle = gradient;
        canvasCtx.beginPath();
        canvasCtx.arc(0, 0, this.size, 0, Math.PI * 2);
        canvasCtx.fill();
      } else if (this.effectType === 'SAKURA') {
        // Cánh hoa đào wibu
        canvasCtx.translate(this.x, this.y);
        canvasCtx.rotate(this.angle);
        canvasCtx.globalAlpha = this.opacity;
        canvasCtx.fillStyle = '#ff75a0';
        canvasCtx.beginPath();
        canvasCtx.ellipse(0, 0, this.size, this.size * 1.4, 0, 0, Math.PI * 2);
        canvasCtx.fill();
        
        canvasCtx.strokeStyle = '#ffa3c4';
        canvasCtx.lineWidth = 1;
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, this.size * 1.4);
        canvasCtx.lineTo(0, -this.size * 0.4);
        canvasCtx.stroke();
      } else if (this.effectType === 'SNOW') {
        // Bông tuyết trắng ngần
        canvasCtx.translate(this.x, this.y);
        canvasCtx.globalAlpha = this.opacity;
        const gradient = canvasCtx.createRadialGradient(0, 0, 0, 0, 0, this.size);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(1, 'transparent');
        canvasCtx.fillStyle = gradient;
        canvasCtx.beginPath();
        canvasCtx.arc(0, 0, this.size, 0, Math.PI * 2);
        canvasCtx.fill();
      } else if (this.effectType === 'MATRIX') {
        // Code rơi ma trận cyberpunk
        canvasCtx.translate(this.x, this.y);
        canvasCtx.globalAlpha = this.opacity;
        canvasCtx.font = `${this.size}px monospace`;
        canvasCtx.fillStyle = activeColor;
        
        canvasCtx.shadowColor = activeColor;
        canvasCtx.shadowBlur = 8;
        canvasCtx.fillText(this.char, 0, 0);
      } else if (this.effectType === 'STARS') {
        // Sao băng vút chéo vũ trụ
        canvasCtx.globalAlpha = this.opacity;
        canvasCtx.strokeStyle = activeColor;
        canvasCtx.lineWidth = this.lineWidth;
        
        canvasCtx.shadowColor = activeColor;
        canvasCtx.shadowBlur = 6;
        
        canvasCtx.beginPath();
        canvasCtx.moveTo(this.x, this.y);
        canvasCtx.lineTo(this.x - this.size, this.y - this.size * 0.8);
        canvasCtx.stroke();
      }

      canvasCtx.restore();
    }
  }

  // Khởi tạo mảng các hạt bay
  function initParticles(effectType) {
    particlesArray = [];
    if (effectType === 'NONE') return;
    
    let count = 45;
    if (effectType === 'SNOW') count = 75; // Snow density
    if (effectType === 'MATRIX') count = 50; // Matrix code lines
    const densityAdjuster = Math.min(count, Math.floor((window.innerWidth * window.innerHeight) / 25000));
    const finalCount = effectType === 'STARS' ? 6 : densityAdjuster;

    for (let i = 0; i < finalCount; i++) {
      particlesArray.push(new Particle(effectType));
    }
  }

  // --- Xử lý LỚP HIỂN THỊ HIỆU ỨNG (FRONT vs BACK) ---
  const layerSelect = document.getElementById('particles-layer-select');

  function applyParticlesLayer(layer) {
    if (!particlesCanvas) return;
    if (layer === 'FRONT') {
      particlesCanvas.style.zIndex = '999'; // Đè lên trên card
    } else {
      particlesCanvas.style.zIndex = '-1'; // Nằm dưới nền
    }
    if (layerSelect) {
      layerSelect.value = layer;
    }
  }

  // Khởi động load cấu hình từ cache
  const savedEffect = localStorage.getItem('nauvie_particles_effect') || 'GLOW';
  const savedLayer = localStorage.getItem('nauvie_particles_layer') || 'BACK'; // Mặc định dưới nền

  applyParticlesLayer(savedLayer);

  // Animation Loop chạy canvas liên tục
  function animateParticles() {
    if (!canvasCtx || !particlesCanvas) return;
    canvasCtx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);

    const selectedEffect = effectSelect ? effectSelect.value : 'GLOW';
    if (selectedEffect === 'NONE') {
      animationFrameId = requestAnimationFrame(animateParticles);
      return;
    }

    // Lấy màu hiện tại từ CSS variables để đổi màu neon thời gian thực
    const activeColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-blue').trim() || '#00f0ff';

    particlesArray.forEach(particle => {
      particle.update(selectedEffect);
      particle.draw(activeColor);
    });

    animationFrameId = requestAnimationFrame(animateParticles);
  }

  // Bật hoặc Tắt Particle Engine
  function toggleParticles(isEnabled) {
    if (isEnabled) {
      if (particlesCanvas) particlesCanvas.style.display = 'block';
      if (!animationFrameId) {
        animateParticles();
      }
    } else {
      if (particlesCanvas) {
        particlesCanvas.style.display = 'none';
        canvasCtx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }
  }

  // Đọc cấu hình từ cache
  if (effectSelect) {
    effectSelect.value = savedEffect;
    
    if (savedEffect !== 'NONE') {
      initParticles(savedEffect);
      toggleParticles(true);
    } else {
      toggleParticles(false);
    }

    // Lắng nghe sự kiện đổi hiệu ứng
    effectSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      localStorage.setItem('nauvie_particles_effect', selected);
      
      if (selected !== 'NONE') {
        initParticles(selected);
        toggleParticles(true);
        showToast('success', `Đã đổi sang: ${effectSelect.options[effectSelect.selectedIndex].text}!`);
      } else {
        toggleParticles(false);
        showToast('success', 'Đã tắt hiệu ứng hạt bay để tối ưu hiệu năng tối đa!');
      }
    });
  }

  if (layerSelect) {
    layerSelect.addEventListener('change', (e) => {
      const selectedLayer = e.target.value;
      applyParticlesLayer(selectedLayer);
      localStorage.setItem('nauvie_particles_layer', selectedLayer);
      showToast('success', selectedLayer === 'FRONT' ? 'Hiệu ứng đã được hiển thị ĐÈ LÊN TRÊN card!' : 'Hiệu ứng đã được hiển thị DƯỚI NỀN đằng sau card!');
    });
  }

  // Reset về mặc định
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem('nauvie_theme_color');
      localStorage.removeItem('nauvie_glass_opacity');
      localStorage.removeItem('nauvie_particles_effect');
      localStorage.removeItem('nauvie_particles_layer');
      
      // Xoá các property đã ghi đè trực tiếp
      const root = document.documentElement;
      root.style.removeProperty('--primary-blue');
      root.style.removeProperty('--primary-hover');
      root.style.removeProperty('--cyber-border');
      root.style.removeProperty('--cyber-border-hover');
      
      // Khôi phục lại ảnh nền từ cache nếu có (tránh bị xóa bởi removeProperty)
      const savedBg = localStorage.getItem('nauvie_custom_bg');
      applyCustomBackground(savedBg);

      // Khôi phục lại độ trong suốt mặc định
      applyGlassOpacity(65);

      // Khôi phục lại hiệu ứng hạt bay mặc định (GLOW)
      if (effectSelect) {
        effectSelect.value = 'GLOW';
        initParticles('GLOW');
        toggleParticles(true);
      }

      // Khôi phục lại lớp hiển thị mặc định (BACK)
      applyParticlesLayer('BACK');
      
      // Reset UI trạng thái nút
      presetButtons.forEach(b => b.classList.remove('active'));
      if (colorPickerWrapper) colorPickerWrapper.classList.remove('active');
      
      // Kích hoạt lại nút đầu tiên (Default Cyan)
      const defaultBtn = document.querySelector('.preset-color-btn[data-color="#00f0ff"]');
      if (defaultBtn) defaultBtn.classList.add('active');
      
      const isLight = document.body.classList.contains('light-theme');
      const defaultHex = isLight ? '#4f46e5' : '#00f0ff';
      if (colorHexText) {
        colorHexText.textContent = defaultHex.toUpperCase();
        colorHexText.style.color = 'var(--primary-blue)';
      }
      if (colorPicker) colorPicker.value = '#00f0ff';
      
      showToast('success', 'Đã khôi phục thiết lập giao diện mặc định của hệ thống!');
    });
  }

  // Đồng bộ lại màu sắc khi chuyển theme Sáng/Tối
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      setTimeout(() => {
        const currentActiveColor = localStorage.getItem('nauvie_theme_color');
        if (currentActiveColor) {
          applyThemeColor(currentActiveColor);
        } else {
          // Nếu dùng mặc định, reset text hiển thị màu
          const isLight = document.body.classList.contains('light-theme');
          const defaultHex = isLight ? '#4f46e5' : '#00f0ff';
          if (colorHexText) {
            colorHexText.textContent = defaultHex.toUpperCase();
            colorHexText.style.color = 'var(--primary-blue)';
          }
        }
        
        // Cập nhật lại lớp phủ mờ của ảnh nền tương ứng theo theme mới
        const savedBg = localStorage.getItem('nauvie_custom_bg');
        if (savedBg) {
          applyCustomBackground(savedBg);
        }

        // Cập nhật lại độ trong suốt của card & panel theo theme mới
        const currentOpacity = localStorage.getItem('nauvie_glass_opacity') || 65;
        applyGlassOpacity(parseInt(currentOpacity, 10));

        // Khôi phục lại trạng thái hạt bay hoạt họa
        const savedEff = localStorage.getItem('nauvie_particles_effect') || 'GLOW';
        if (savedEff !== 'NONE') {
          initParticles(savedEff);
          toggleParticles(true);
        } else {
          toggleParticles(false);
        }

        // Khôi phục lại cấu hình lớp hiển thị
        const currentLayer = localStorage.getItem('nauvie_particles_layer') || 'BACK';
        applyParticlesLayer(currentLayer);
      }, 50); // Chờ theme class được toggle xong
    });
  }
}

// Helpers chuyển Hex -> RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Helper làm sáng/tối màu hex cực mạnh
function lightenDarkenColor(col, amt) {
  let usePound = false;
  if (col[0] == "#") {
    col = col.slice(1);
    usePound = true;
  }
  let num = parseInt(col, 16);
  let r = (num >> 16) + amt;
  if (r > 255) r = 255;
  else if (r < 0) r = 0;
  let b = ((num >> 8) & 0x00FF) + amt;
  if (b > 255) b = 255;
  else if (b < 0) b = 0;
  let g = (num & 0x0000FF) + amt;
  if (g > 255) g = 255;
  else if (g < 0) g = 0;
  return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}

