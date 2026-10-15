// Otomatis gunakan URL relatif saat di Vercel/Production
var API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
  ? `http://${window.location.hostname}:5000/api`
  : '/api';

// Global Data States
let allConfessions = [];
let filteredConfessions = [];
let activeMoodFilter = 'Semua';
let activeSortOption = 'terbaru';

// PASE/PAGINASI FEEDS
const POSTS_PER_PAGE = 6; // Jumlah curhatan per muatan (misal 6 kartu)
let visiblePostsCount = POSTS_PER_PAGE;

// SINGLE PERSISTENT AUDIO MANAGER (Mencegah Double Music)
let globalAudio = new Audio();
let currentTrackIndex = -1;
let previewSearchIndex = -1;
let isSelectedPreviewPlaying = false;
let isPlaying = false;

// Search & Form States
let selectedSongData = null;
let searchTimeout = null;
window.searchResultsData = [];

// Story Canvas Animation State
let storyAnimationFrame = null;
let storyAngle = 0;
let currentStoryData = null;

// Report & Admin State
let targetReportId = null;
let adminAllConfessions = [];
let adminAllFeedback = [];
let activeAdminTab = 'confessions';

document.addEventListener('DOMContentLoaded', () => {
  updateDynamicHeaderGreeting();
  fetchConfessions();
  initPersistentAudioEvents();
  initScrollTopListener();
});

// --- SISTEM TOAST NOTIFIKASI MODERN (PENGGANTI ALERT) ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  
  let bgColors = 'bg-slate-900/95 border-purple-500/50 text-slate-100 shadow-purple-950/40';
  let icon = '<i class="fa-solid fa-circle-info text-purple-400"></i>';

  if (type === 'success') {
    bgColors = 'bg-slate-900/95 border-emerald-500/50 text-emerald-200 shadow-emerald-950/40';
    icon = '<i class="fa-solid fa-circle-check text-emerald-400"></i>';
  } else if (type === 'error') {
    bgColors = 'bg-slate-900/95 border-rose-500/50 text-rose-200 shadow-rose-950/40';
    icon = '<i class="fa-solid fa-circle-exclamation text-rose-400"></i>';
  } else if (type === 'warning') {
    bgColors = 'bg-slate-900/95 border-amber-500/50 text-amber-200 shadow-amber-950/40';
    icon = '<i class="fa-solid fa-triangle-exclamation text-amber-400"></i>';
  }

  toast.className = `pointer-events-auto flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl text-xs font-semibold transition-all duration-300 transform translate-x-10 opacity-0 ${bgColors}`;
  toast.innerHTML = `
    <span class="text-sm flex-shrink-0">${icon}</span>
    <span class="flex-grow">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-x-10', 'opacity-0');
    toast.classList.add('translate-x-0', 'opacity-100');
  });

  setTimeout(() => {
    toast.classList.remove('translate-x-0', 'opacity-100');
    toast.classList.add('translate-x-10', 'opacity-0');
    setTimeout(() => { toast.remove(); }, 300);
  }, 3500);
}

// --- FITUR HEADER DINAMIS & SCROLL TO TOP ---
function updateDynamicHeaderGreeting() {
  const greetingEl = document.getElementById('dynamicGreeting');
  if (!greetingEl) return;

  const hours = new Date().getHours();
  let text = "Selamat Datang, Pendengar Anonim";

  if (hours >= 4 && hours < 11) text = "Selamat Pagi, Pendengar Anonim 🌅";
  else if (hours >= 11 && hours < 15) text = "Selamat Siang, Pendengar Anonim ☀️";
  else if (hours >= 15 && hours < 18) text = "Selamat Sore, Pendengar Anonim 🌇";
  else text = "Selamat Malam, Pendengar Anonim 🌙";

  greetingEl.innerText = text;
}

function initScrollTopListener() {
  window.addEventListener('scroll', () => {
    const btn = document.getElementById('scrollTopBtn');
    if (!btn) return;
    if (window.scrollY > 250) {
      btn.classList.remove('opacity-0', 'pointer-events-none', 'scale-90');
      btn.classList.add('opacity-100', 'pointer-events-auto', 'scale-100');
    } else {
      btn.classList.add('opacity-0', 'pointer-events-none', 'scale-90');
      btn.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
    }
  });
}

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

// --- HELPER IKON & WARNA MOOD BADGE ---
function getMoodBadge(mood) {
  const m = mood || 'Pesan Tak Terucap';
  if (m.includes('Patah')) return { label: '🌧️ Patah Hati', color: 'bg-rose-950/80 border-rose-500/40 text-rose-300' };
  if (m.includes('Pemulihan')) return { label: '🌿 Pemulihan', color: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300' };
  if (m.includes('Apresiasi')) return { label: '✨ Apresiasi', color: 'bg-amber-950/80 border-amber-500/40 text-amber-300' };
  if (m.includes('Malam')) return { label: '🌙 Tengah Malam', color: 'bg-purple-950/80 border-purple-500/40 text-purple-300' };
  return { label: '🔮 Pesan Tak Terucap', color: 'bg-indigo-950/80 border-indigo-500/40 text-indigo-300' };
}

// --- FETCH & FILTER CONFESSIONS ---
async function fetchConfessions() {
  try {
    const res = await fetch(`${API_BASE_URL}/confessions`);
    const result = await res.json();

    if (result.success) {
      allConfessions = result.data || [];
      updateMoodCounts();
      applyFilters();
    }
  } catch (err) {
    document.getElementById('confessionFeed').innerHTML = `
      <div class="col-span-full text-center py-16 text-rose-400 font-medium text-xs sm:text-sm">
        Gagal menghubungkan ke server backend.
      </div>
    `;
  }
}

function updateMoodCounts() {
  const total = allConfessions.length;
  const headerTotalEl = document.getElementById('headerTotalConfessions');
  if (headerTotalEl) headerTotalEl.innerText = total;

  const counts = { Semua: total, Pesan: 0, Patah: 0, Malam: 0, Apresiasi: 0, Pemulihan: 0 };
  
  allConfessions.forEach(c => {
    const mood = c.mood || 'Pesan Tak Terucap';
    if (mood.includes('Pesan')) counts.Pesan++;
    if (mood.includes('Patah')) counts.Patah++;
    if (mood.includes('Malam')) counts.Malam++;
    if (mood.includes('Apresiasi')) counts.Apresiasi++;
    if (mood.includes('Pemulihan')) counts.Pemulihan++;
  });

  Object.keys(counts).forEach(key => {
    const el = document.getElementById(`count-${key}`);
    if (el) el.innerText = counts[key];
  });
}

function filterMood(mood) {
  activeMoodFilter = mood;
  visiblePostsCount = POSTS_PER_PAGE; // Reset batas ke 6
  
  document.querySelectorAll('.mood-btn').forEach(btn => {
    if (btn.innerText.includes(mood)) {
      btn.classList.add('bg-gradient-to-r', 'from-purple-600', 'to-indigo-600', 'text-white');
      btn.classList.remove('bg-slate-900/90', 'text-slate-300');
    } else {
      btn.classList.remove('bg-gradient-to-r', 'from-purple-600', 'to-indigo-600', 'text-white');
      btn.classList.add('bg-slate-900/90', 'text-slate-300');
    }
  });
  applyFilters();
}

function handleSearch() {
  visiblePostsCount = POSTS_PER_PAGE; // Reset batas saat mencari
  applyFilters();
}

function clearSearchInput() {
  const searchInput = document.getElementById('searchInput');
  const btnClear = document.getElementById('btnClearSearch');
  if (searchInput) {
    searchInput.value = '';
    if (btnClear) btnClear.classList.add('hidden');
    applyFilters();
  }
}

function handleSortChange(sortType) {
  activeSortOption = sortType;
  applyFilters();
}

function shuffleConfessions() {
  filteredConfessions.sort(() => Math.random() - 0.5);
  renderFeed();
}

function applyFilters() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  
  filteredConfessions = allConfessions.filter(c => {
    const matchMood = activeMoodFilter === 'Semua' || (c.mood && c.mood.toLowerCase().includes(activeMoodFilter.toLowerCase()));
    const matchSearch = !query || 
      c.text.toLowerCase().includes(query) || 
      c.songTitle.toLowerCase().includes(query) || 
      (c.artist && c.artist.toLowerCase().includes(query));
    return matchMood && matchSearch;
  });

  if (activeSortOption === 'terbaru') {
    filteredConfessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } else if (activeSortOption === 'terlama') {
    filteredConfessions.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  } else if (activeSortOption === 'populer') {
    filteredConfessions.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  }

  renderFeed();
}

function renderFeed() {
  const feed = document.getElementById('confessionFeed');
  if (!feed) return;

  if (filteredConfessions.length === 0) {
    feed.innerHTML = `<div class="col-span-full text-center py-16 text-slate-500 font-medium text-xs sm:text-sm">Tidak ada curhatan ditemukan.</div>`;
    return;
  }

  // Potong data hanya sebanyak visiblePostsCount
  const visibleItems = filteredConfessions.slice(0, visiblePostsCount);

  // Render kartu curhatan
  let html = visibleItems.map((c, index) => renderCard(c, index)).join('');

  // Jika jumlah data lebih banyak dari yang ditampilkan, tambahkan tombol "Muat Lebih Banyak"
  if (visiblePostsCount < filteredConfessions.length) {
    const remaining = filteredConfessions.length - visiblePostsCount;
    html += `
      <div class="col-span-full text-center pt-6 pb-2">
        <button onclick="loadMoreConfessions()" class="bg-slate-900 hover:bg-slate-800 border border-purple-500/30 hover:border-purple-500/60 text-purple-300 font-bold px-6 py-3 rounded-2xl text-xs transition-all duration-300 shadow-lg shadow-purple-950/30 active:scale-95 inline-flex items-center gap-2">
          <i class="fa-solid fa-arrows-rotate text-purple-400"></i>
          <span>Muat Lebih Banyak (${remaining} curhatan lagi)</span>
        </button>
      </div>
    `;
  }

  feed.innerHTML = html;
  updateAllAudioUI();
}

// Fungsi aksi saat tombol "Muat Lebih Banyak" diklik
function loadMoreConfessions() {
  visiblePostsCount += POSTS_PER_PAGE; // Tambah 6 curhatan lagi
  renderFeed();
}

function renderCard(c, index) {
  const timeAgo = new Date(c.timestamp).toLocaleDateString('id-ID', {
    hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short'
  });

  const badge = getMoodBadge(c.mood);
  const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(c.songTitle + ' ' + (c.artist || ''))}`;
  
  const reportedList = JSON.parse(localStorage.getItem('reported_confessions') || '[]');
  const isAlreadyReported = reportedList.includes(c.id);

  // LOGIKA CEK DUKUNGAN LIKE PERSISTEN PADA LOCALSTORAGE
  const likedList = JSON.parse(localStorage.getItem('liked_confessions') || '[]');
  const isLiked = likedList.includes(c.id);

  return `
    <div id="confessionCard-${index}" class="glass-card rounded-3xl p-4 sm:p-5 relative border border-slate-800 flex flex-col justify-between group transition-all duration-300">
      <div>
        <div class="flex items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${badge.color}">
              ${badge.label}
            </span>
            <span id="cardStatusTag-${index}" class="hidden inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse">
              <i class="fa-solid fa-compact-disc fa-spin text-purple-400"></i> Diputar
            </span>
          </div>
          <span class="text-[10px] text-slate-500 font-medium">${timeAgo}</span>
        </div>

        <p class="text-slate-100 text-xs sm:text-sm leading-relaxed italic mb-4 font-medium whitespace-pre-line">
          "${escapeHtml(c.text)}"
        </p>
      </div>

      <div>
        <div onclick="playTrackFromFeed(${index})" class="bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-2.5 flex items-center justify-between cursor-pointer transition mb-3">
          <div class="flex items-center gap-3 overflow-hidden">
            <img src="${c.coverUrl || 'https://via.placeholder.com/100'}" class="w-10 h-10 rounded-xl object-cover flex-shrink-0">
            <div class="truncate">
              <h4 class="text-xs font-bold text-white truncate">${escapeHtml(c.songTitle)}</h4>
              <p class="text-[10px] text-slate-400 truncate">${escapeHtml(c.artist || 'Unknown Artist')}</p>
            </div>
          </div>
          
          <div class="flex items-center gap-2">
            <a href="${spotifyUrl}" target="_blank" onclick="event.stopPropagation()" class="text-slate-500 hover:text-emerald-400 text-xs p-1" title="Buka di Spotify">
              <i class="fa-brands fa-spotify"></i>
            </a>
            <button id="cardPlayBtn-${index}" class="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs shadow-md transition-all duration-300">
              <i class="fa-solid fa-play"></i>
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs text-slate-400">
          <button onclick="handleLike('${c.id}')" class="flex items-center gap-1.5 hover:text-rose-400 transition font-medium">
            <i class="fa-${isLiked ? 'solid text-rose-500' : 'regular'} fa-heart" id="likeIcon-${c.id}"></i>
            <span id="likeCount-${c.id}">${c.likes || 0}</span>
          </button>

          <button onclick="openStoryModal(${index})" class="flex items-center gap-1.5 hover:text-purple-400 transition font-medium">
            <i class="fa-solid fa-share-nodes"></i> Story 9:16
          </button>

          <button onclick="openReportModal('${c.id}')" class="${isAlreadyReported ? 'text-amber-500 cursor-not-allowed' : 'hover:text-amber-400 text-slate-500'} transition" title="${isAlreadyReported ? 'Sudah dilaporkan' : 'Laporkan'}">
            <i class="fa-${isAlreadyReported ? 'solid' : 'regular'} fa-flag"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

// --- UPDATE UI PEMUTAR ELEMEN-ELEMEN AUDIO ---
function updateAllAudioUI() {
  filteredConfessions.forEach((_, idx) => {
    const cardEl = document.getElementById(`confessionCard-${idx}`);
    const playBtnEl = document.getElementById(`cardPlayBtn-${idx}`);
    const statusTagEl = document.getElementById(`cardStatusTag-${idx}`);

    if (!cardEl || !playBtnEl) return;

    const isCurrentFeed = (currentTrackIndex === idx);
    const isThisPlaying = isCurrentFeed && isPlaying;

    if (isCurrentFeed) {
      cardEl.classList.add('ring-2', 'ring-purple-500', 'border-purple-500/80', 'scale-[1.01]', 'shadow-2xl', 'shadow-purple-500/20');
      cardEl.classList.remove('border-slate-800');
    } else {
      cardEl.classList.remove('ring-2', 'ring-purple-500', 'border-purple-500/80', 'scale-[1.01]', 'shadow-2xl', 'shadow-purple-500/20');
      cardEl.classList.add('border-slate-800');
    }

    if (isThisPlaying) {
      playBtnEl.innerHTML = `<i class="fa-solid fa-pause"></i>`;
      playBtnEl.className = 'w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shadow-lg shadow-rose-600/40 transition-all duration-300';
      if (statusTagEl) statusTagEl.classList.remove('hidden');
    } else {
      playBtnEl.innerHTML = `<i class="fa-solid fa-play"></i>`;
      playBtnEl.className = 'w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs shadow-md transition-all duration-300';
      if (statusTagEl) statusTagEl.classList.add('hidden');
    }
  });

  if (window.searchResultsData && window.searchResultsData.length > 0) {
    window.searchResultsData.forEach((_, idx) => {
      const btn = document.getElementById(`searchPlayBtn-${idx}`);
      if (!btn) return;
      if (previewSearchIndex === idx && isPlaying) {
        btn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
        btn.className = 'w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] shadow-md transition';
      } else {
        btn.innerHTML = `<i class="fa-solid fa-play"></i>`;
        btn.className = 'w-7 h-7 rounded-full bg-purple-950/80 border border-purple-500/40 hover:bg-purple-600 text-purple-300 hover:text-white flex items-center justify-center text-[10px] transition';
      }
    });
  }

  const selBtn = document.getElementById('btnPlaySelectedPreview');
  if (selBtn) {
    if (isSelectedPreviewPlaying && isPlaying) {
      selBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
      selBtn.className = 'w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shadow-md transition';
    } else {
      selBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
      selBtn.className = 'w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs shadow-md transition';
    }
  }

  const mainPlayBtn = document.getElementById('playerPlayBtn');
  if (mainPlayBtn) {
    if (isPlaying) {
      mainPlayBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
    } else {
      mainPlayBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
    }
  }
}

// --- PEMUTARAN VIA FEED ---
function playTrackFromFeed(index) {
  if (index < 0 || index >= filteredConfessions.length) return;

  const track = filteredConfessions[index];
  if (!track.audioUrl) return showToast("Pratinjau lagu tidak tersedia.", "warning");

  if (currentTrackIndex === index) {
    toggleMainAudioPlay();
    return;
  }

  globalAudio.pause();
  globalAudio.currentTime = 0;

  currentTrackIndex = index;
  previewSearchIndex = -1;
  isSelectedPreviewPlaying = false;

  globalAudio.src = track.audioUrl;
  globalAudio.crossOrigin = 'anonymous';
  globalAudio.play().then(() => {
    isPlaying = true;
    updateAllAudioUI();
  }).catch(() => {});

  document.getElementById('playerCover').src = track.coverUrl || 'https://via.placeholder.com/100';
  document.getElementById('playerTitle').innerText = track.songTitle;
  document.getElementById('playerArtist').innerText = track.artist || 'Unknown Artist';
  document.getElementById('playerSnippet').innerText = `"${track.text.substring(0, 30)}..."`;
  document.getElementById('playerSpotifyBtn').href = `https://open.spotify.com/search/${encodeURIComponent(track.songTitle + ' ' + (track.artist || ''))}`;
  
  document.getElementById('persistentPlayer').classList.remove('hidden');
  updateAllAudioUI();
}

function initPersistentAudioEvents() {
  globalAudio.addEventListener('timeupdate', () => {
    if (!globalAudio.duration) return;
    const progress = (globalAudio.currentTime / globalAudio.duration) * 100;
    document.getElementById('playerSeek').value = progress;
    document.getElementById('playerCurrentTime').innerText = formatTime(globalAudio.currentTime);
    document.getElementById('playerTotalTime').innerText = formatTime(globalAudio.duration);
  });

  document.getElementById('playerSeek').addEventListener('input', (e) => {
    if (globalAudio.duration) {
      globalAudio.currentTime = (e.target.value / 100) * globalAudio.duration;
    }
  });

  globalAudio.addEventListener('play', () => {
    isPlaying = true;
    updateAllAudioUI();
  });

  globalAudio.addEventListener('pause', () => {
    isPlaying = false;
    updateAllAudioUI();
  });

  globalAudio.addEventListener('ended', () => { 
    isPlaying = false; 
    if (currentTrackIndex !== -1) nextSong();
    updateAllAudioUI();
  });
}

function toggleMainAudioPlay() {
  if (isPlaying) globalAudio.pause();
  else if (globalAudio.src) globalAudio.play();
}

function prevSong() { if (currentTrackIndex > 0) playTrackFromFeed(currentTrackIndex - 1); }
function nextSong() { if (currentTrackIndex < filteredConfessions.length - 1) playTrackFromFeed(currentTrackIndex + 1); }

function closePersistentPlayer() {
  globalAudio.pause();
  isPlaying = false;
  currentTrackIndex = -1;
  previewSearchIndex = -1;
  isSelectedPreviewPlaying = false;
  document.getElementById('persistentPlayer').classList.add('hidden');
  updateAllAudioUI();
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// --- LOGIKA PERBAIKAN LIKE (1 USER = 1 LIKE PERSISTEN) ---
async function handleLike(id) {
  const countEl = document.getElementById(`likeCount-${id}`);
  const iconEl = document.getElementById(`likeIcon-${id}`);
  if (!countEl || !iconEl) return;

  let likedList = JSON.parse(localStorage.getItem('liked_confessions') || '[]');
  const isLiked = likedList.includes(id);
  const action = isLiked ? 'remove' : 'add';

  let currentLikes = parseInt(countEl.innerText) || 0;
  
  if (action === 'add') {
    likedList.push(id);
    countEl.innerText = currentLikes + 1;
    iconEl.classList.remove('fa-regular');
    iconEl.classList.add('fa-solid', 'text-rose-500');
    showToast("Curhatan disukai! ❤️", "success");
  } else {
    likedList = likedList.filter(item => item !== id);
    countEl.innerText = Math.max(0, currentLikes - 1);
    iconEl.classList.remove('fa-solid', 'text-rose-500');
    iconEl.classList.add('fa-regular');
  }

  // Simpan status pilihan ke localStorage
  localStorage.setItem('liked_confessions', JSON.stringify(likedList));

  // Update statistik data lokal
  const confessionObj = allConfessions.find(c => c.id === id);
  if (confessionObj) confessionObj.likes = parseInt(countEl.innerText);

  try {
    await fetch(`${API_BASE_URL}/confessions/${id}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
  } catch (err) {}
}

// --- LAPORKAN (REPORT) ---
function openReportModal(id) {
  const reportedList = JSON.parse(localStorage.getItem('reported_confessions') || '[]');
  if (reportedList.includes(id)) {
    return showToast("Anda sudah melaporkan curhatan ini sebelumnya.", "warning");
  }
  targetReportId = id;
  openModal('reportModal');
}

async function submitReport() {
  if (!targetReportId) return;

  const reportedList = JSON.parse(localStorage.getItem('reported_confessions') || '[]');
  if (reportedList.includes(targetReportId)) {
    showToast("Anda sudah melaporkan curhatan ini sebelumnya.", "warning");
    closeModal('reportModal');
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/confessions/${targetReportId}/report`, { method: 'POST' });
    const result = await res.json();
    if (result.success) {
      reportedList.push(targetReportId);
      localStorage.setItem('reported_confessions', JSON.stringify(reportedList));

      showToast("Terima kasih, laporan Anda telah berhasil terkirim.", "success");
      closeModal('reportModal');
      fetchConfessions();
    } else {
      showToast("Gagal mengirimkan laporan.", "error");
    }
  } catch (err) {
    showToast("Gagal terhubung ke server saat melaporkan.", "error");
  }
}

// --- KIRIM MASUKAN & KRITIK ---
async function submitFeedback() {
  const category = document.getElementById('feedbackCategory').value;
  const message = document.getElementById('feedbackMessage').value.trim();
  const contact = document.getElementById('feedbackContact').value.trim();
  const btn = document.getElementById('btnSubmitFeedback');

  if (!message) return showToast("Isi pesan masukan tidak boleh kosong!", "warning");

  btn.disabled = true;
  btn.innerText = "Mengirim...";

  try {
    const res = await fetch(`${API_BASE_URL}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, message, contact })
    });
    const result = await res.json();

    if (result.success) {
      showToast("Terima kasih! Masukan Anda telah terkirim.", "success");
      document.getElementById('feedbackMessage').value = '';
      document.getElementById('feedbackContact').value = '';
      closeModal('feedbackModal');
    } else {
      showToast("Gagal mengirimkan masukan.", "error");
    }
  } catch (err) {
    showToast("Gagal terhubung ke server.", "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Kirim Masukan";
  }
}

// --- ADMIN MANAGEMENT & DASHBOARD PAGE ---
function handleAdminButtonClick() {
  const token = localStorage.getItem('adminToken');
  if (token) {
    openAdminDashboard();
  } else {
    openModal('adminModal');
  }
}

async function loginAdmin() {
  const username = document.getElementById('adminUser').value.trim();
  const password = document.getElementById('adminPass').value.trim();
  const btn = document.getElementById('btnLoginAdmin');

  if (!username || !password) return showToast("Username dan Password wajib diisi!", "warning");

  btn.disabled = true;
  btn.innerText = "Memverifikasi...";

  try {
    const res = await fetch(`${API_BASE_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const result = await res.json();

    if (result.success && result.token) {
      localStorage.setItem('adminToken', result.token);
      showToast("Login Admin Berhasil!", "success");
      closeModal('adminModal');
      openAdminDashboard();
    } else {
      showToast(result.error || "Login gagal, kredensial tidak cocok.", "error");
    }
  } catch (err) {
    showToast("Gagal melakukan login admin.", "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Login ke Admin Dashboard";
  }
}

function logoutAdmin() {
  localStorage.removeItem('adminToken');
  closeModal('adminDashboardModal');
  showToast("Anda telah logout dari Admin Dashboard.", "info");
}

async function openAdminDashboard() {
  openModal('adminDashboardModal');
  await fetchAdminConfessions();
  await fetchAdminFeedback();
}

function switchAdminTab(tab) {
  activeAdminTab = tab;
  const btnConfessions = document.getElementById('adminTabConfessionsBtn');
  const btnFeedback = document.getElementById('adminTabFeedbackBtn');
  const viewConfessions = document.getElementById('adminTabConfessions');
  const viewFeedback = document.getElementById('adminTabFeedback');

  if (tab === 'confessions') {
    btnConfessions.className = 'px-3.5 py-2 rounded-xl bg-purple-600 text-white flex items-center gap-1.5 transition';
    btnFeedback.className = 'px-3.5 py-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white flex items-center gap-1.5 transition';
    viewConfessions.classList.remove('hidden');
    viewFeedback.classList.add('hidden');
  } else {
    btnFeedback.className = 'px-3.5 py-2 rounded-xl bg-cyan-600 text-white flex items-center gap-1.5 transition';
    btnConfessions.className = 'px-3.5 py-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white flex items-center gap-1.5 transition';
    viewFeedback.classList.remove('hidden');
    viewConfessions.classList.add('hidden');
  }
}

async function fetchAdminConfessions() {
  const token = localStorage.getItem('adminToken');
  const listEl = document.getElementById('adminConfessionsList');
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/confessions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();

    if (result.success) {
      adminAllConfessions = result.data || [];
      document.getElementById('adminTotalCount').innerText = adminAllConfessions.length;
      document.getElementById('adminHiddenCount').innerText = adminAllConfessions.filter(c => c.isHidden || c.reportCount > 0).length;
      renderAdminConfessions(adminAllConfessions);
    } else {
      listEl.innerHTML = `<div class="text-center py-12 text-rose-400 font-semibold text-xs">Sesi admin telah kadaluwarsa. Silakan login kembali.</div>`;
      localStorage.removeItem('adminToken');
    }
  } catch (err) {
    listEl.innerHTML = `<div class="text-center py-12 text-rose-400 text-xs">Gagal mengambil data admin dari server.</div>`;
  }
}

function filterAdminConfessions() {
  const query = document.getElementById('adminSearchInput').value.toLowerCase().trim();
  const filtered = adminAllConfessions.filter(c => 
    c.text.toLowerCase().includes(query) || 
    c.songTitle.toLowerCase().includes(query) || 
    (c.artist && c.artist.toLowerCase().includes(query))
  );
  renderAdminConfessions(filtered);
}

function renderAdminConfessions(items) {
  const listEl = document.getElementById('adminConfessionsList');
  if (!items || items.length === 0) {
    listEl.innerHTML = `<div class="text-center py-12 text-slate-500 text-xs">Tidak ada pesan untuk ditampilkan.</div>`;
    return;
  }

  listEl.innerHTML = items.map(c => {
    const badge = getMoodBadge(c.mood);
    return `
      <div class="bg-slate-900/90 border ${c.isHidden ? 'border-rose-500/40' : 'border-slate-800'} rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition">
        <div class="space-y-1.5 max-w-xl">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${c.isHidden ? 'bg-rose-950 text-rose-300 border border-rose-500/40' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'}">
              ${c.isHidden ? '🙈 Disembunyikan' : '👁️ Publik'}
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-300">
              ${badge.label}
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400">
              🚨 ${c.reportCount || 0} Laporan
            </span>
            <span class="text-[10px] text-slate-500">${new Date(c.timestamp).toLocaleString('id-ID')}</span>
          </div>
          <p class="text-slate-100 text-xs leading-relaxed font-medium">"${escapeHtml(c.text)}"</p>
          <p class="text-[11px] text-indigo-300 font-semibold">🎵 ${escapeHtml(c.songTitle)} - ${escapeHtml(c.artist || 'Unknown')}</p>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <button onclick="toggleHideConfession('${c.id}')" class="px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold ${c.isHidden ? 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-500/40' : 'bg-amber-950 text-amber-300 hover:bg-amber-900 border border-amber-500/40'} transition">
            ${c.isHidden ? '<i class="fa-solid fa-eye"></i> Tampilkan' : '<i class="fa-solid fa-eye-slash"></i> Sembunyikan'}
          </button>
          <button onclick="deleteConfessionAdmin('${c.id}')" class="px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition">
            <i class="fa-solid fa-trash"></i> Hapus
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function toggleHideConfession(id) {
  const token = localStorage.getItem('adminToken');
  if (!token) return showToast("Sesi admin tidak ditemukan.", "error");

  try {
    let res = await fetch(`${API_BASE_URL}/admin/confessions/${id}/toggle-hide`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok && res.status === 405) {
      res = await fetch(`${API_BASE_URL}/admin/confessions/${id}/toggle-hide`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    }

    const result = await res.json();
    if (res.ok && result.success) {
      showToast(result.message || "Status curhatan diperbarui.", "success");
      await fetchAdminConfessions();
      fetchConfessions();
    } else {
      showToast(result.error || "Gagal memperbarui status.", "error");
    }
  } catch (err) {
    showToast("Gagal terhubung ke server backend.", "error");
  }
}

async function deleteConfessionAdmin(id) {
  if (!confirm("Apakah Anda yakin ingin menghapus curhatan ini secara PERMANEN dari database?")) return;

  const token = localStorage.getItem('adminToken');
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/confessions/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.success) {
      showToast("Curhatan berhasil dihapus permanen.", "success");
      await fetchAdminConfessions();
      fetchConfessions();
    }
  } catch (err) {
    showToast("Gagal menghapus curhatan.", "error");
  }
}

async function fetchAdminFeedback() {
  const token = localStorage.getItem('adminToken');
  const listEl = document.getElementById('adminFeedbackList');
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/feedback`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();

    if (result.success) {
      adminAllFeedback = result.data || [];
      document.getElementById('adminFeedbackBadge').innerText = adminAllFeedback.length;
      renderAdminFeedback(adminAllFeedback);
    }
  } catch (err) {
    listEl.innerHTML = `<div class="text-center py-12 text-rose-400 text-xs">Gagal mengambil masukan user.</div>`;
  }
}

function renderAdminFeedback(items) {
  const listEl = document.getElementById('adminFeedbackList');
  if (!items || items.length === 0) {
    listEl.innerHTML = `<div class="text-center py-12 text-slate-500 text-xs">Belum ada masukan atau kritik dari user.</div>`;
    return;
  }

  listEl.innerHTML = items.map(f => `
    <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition">
      <div class="space-y-1.5 max-w-2xl">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
            ${escapeHtml(f.category || 'Saran')}
          </span>
          <span class="text-[10px] text-slate-400 font-semibold">
            👤 Kontak: ${escapeHtml(f.contact || 'Anonim')}
          </span>
          <span class="text-[10px] text-slate-500">${new Date(f.timestamp).toLocaleString('id-ID')}</span>
        </div>
        <p class="text-slate-100 text-xs leading-relaxed font-medium">
          "${escapeHtml(f.message)}"
        </p>
      </div>

      <button onclick="deleteFeedbackAdmin('${f._id}')" class="px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 transition flex items-center gap-1.5 self-start md:self-center">
        <i class="fa-solid fa-trash"></i> Hapus
      </button>
    </div>
  `).join('');
}

async function deleteFeedbackAdmin(id) {
  if (!confirm("Hapus masukan dari user ini?")) return;

  const token = localStorage.getItem('adminToken');
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE_URL}/admin/feedback/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.success) {
      showToast("Masukan berhasil dihapus.", "success");
      await fetchAdminFeedback();
    }
  } catch (err) {
    showToast("Gagal menghapus masukan.", "error");
  }
}

// --- PENCARIAN LAGU ITUNES PROXY & DENGARKAN PRATINJAU ---
function searchSongsDebounced() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const q = document.getElementById('songQuery').value.trim();
    if (q.length > 1) searchSongsDirect(q);
  }, 400);
}

async function searchSongsDirect(q) {
  const container = document.getElementById('songResults');
  container.innerHTML = `<div class="text-xs text-slate-400 p-2 text-center"><i class="fa-solid fa-spinner fa-spin"></i> Mencari lagu...</div>`;

  try {
    let songs = [];

    try {
      const res = await fetch(`${API_BASE_URL}/songs/search?q=${encodeURIComponent(q)}`);
      const result = await res.json();
      if (result.success && result.data) songs = result.data;
    } catch (e) {}

    if (songs.length === 0) {
      const directRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=8`);
      const directData = await directRes.json();
      songs = directData.results || [];
    }

    if (songs && songs.length > 0) {
      window.searchResultsData = songs;
      container.innerHTML = songs.map((song, index) => `
        <div onclick="selectSongByIndex(${index})" class="flex items-center justify-between p-2 hover:bg-slate-800/80 rounded-xl cursor-pointer transition group">
          <div class="flex items-center gap-3 overflow-hidden">
            <img src="${song.artworkUrl100 || 'https://via.placeholder.com/100'}" class="w-9 h-9 rounded-lg object-cover flex-shrink-0">
            <div class="overflow-hidden">
              <div class="text-xs font-bold text-white truncate">${escapeHtml(song.trackName)}</div>
              <div class="text-[10px] text-slate-400 truncate">${escapeHtml(song.artistName)}</div>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0" onclick="event.stopPropagation()">
            <button type="button" onclick="previewSearchSong(event, ${index})" id="searchPlayBtn-${index}" class="w-7 h-7 rounded-full bg-purple-950/80 border border-purple-500/40 hover:bg-purple-600 text-purple-300 hover:text-white flex items-center justify-center text-[10px] transition" title="Dengarkan Pratinjau">
              <i class="fa-solid fa-play"></i>
            </button>
            <button type="button" onclick="selectSongByIndex(${index})" class="text-[10px] bg-purple-600 hover:bg-purple-500 text-white font-semibold px-2.5 py-1 rounded-lg transition">
              Pilih
            </button>
          </div>
        </div>
      `).join('');
      updateAllAudioUI();
    } else {
      container.innerHTML = `<div class="text-xs text-slate-400 p-2 text-center">Lagu tidak ditemukan. Coba kata kunci lain.</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div class="text-xs text-rose-400 p-2 text-center">Gagal mencari lagu. Pastikan server backend berjalan.</div>`;
  }
}

function previewSearchSong(e, index) {
  if (e) e.stopPropagation();
  const song = window.searchResultsData[index];
  if (!song || !song.previewUrl) return showToast("Pratinjau lagu tidak tersedia.", "warning");

  if (previewSearchIndex === index && isPlaying) {
    globalAudio.pause();
    return;
  }

  currentTrackIndex = -1;
  isSelectedPreviewPlaying = false;
  previewSearchIndex = index;

  globalAudio.src = song.previewUrl;
  globalAudio.crossOrigin = 'anonymous';
  globalAudio.play().then(() => {
    isPlaying = true;
    updateAllAudioUI();
  }).catch(() => {});

  document.getElementById('playerCover').src = song.artworkUrl100 || '';
  document.getElementById('playerTitle').innerText = song.trackName;
  document.getElementById('playerArtist').innerText = song.artistName;
  document.getElementById('playerSnippet').innerText = `"Pratinjau pencarian lagu..."`;
  document.getElementById('persistentPlayer').classList.remove('hidden');

  updateAllAudioUI();
}

function selectSongByIndex(index) {
  const song = window.searchResultsData[index];
  if (!song) return;

  selectedSongData = {
    songTitle: song.trackName,
    artist: song.artistName,
    coverUrl: song.artworkUrl100.replace('100x100bb', '400x400bb'),
    audioUrl: song.previewUrl,
    trackId: song.trackId.toString()
  };

  document.getElementById('previewCover').src = selectedSongData.coverUrl;
  document.getElementById('previewTitle').innerText = selectedSongData.songTitle;
  document.getElementById('previewArtist').innerText = selectedSongData.artist;
  document.getElementById('selectedSongPreview').classList.remove('hidden');
  document.getElementById('songResults').innerHTML = '';

  if (previewSearchIndex !== -1) {
    globalAudio.pause();
    previewSearchIndex = -1;
  }
  updateAllAudioUI();
}

function toggleSelectedSongPreviewAudio() {
  if (!selectedSongData || !selectedSongData.audioUrl) return showToast("Pratinjau lagu tidak tersedia.", "warning");

  if (isSelectedPreviewPlaying && isPlaying) {
    globalAudio.pause();
    return;
  }

  currentTrackIndex = -1;
  previewSearchIndex = -1;
  isSelectedPreviewPlaying = true;

  globalAudio.src = selectedSongData.audioUrl;
  globalAudio.crossOrigin = 'anonymous';
  globalAudio.play().then(() => {
    isPlaying = true;
    updateAllAudioUI();
  }).catch(() => {});

  document.getElementById('playerCover').src = selectedSongData.coverUrl || '';
  document.getElementById('playerTitle').innerText = selectedSongData.songTitle;
  document.getElementById('playerArtist').innerText = selectedSongData.artist;
  document.getElementById('playerSnippet').innerText = `"Lagu yang dipilih untuk dikirim..."`;
  document.getElementById('persistentPlayer').classList.remove('hidden');

  updateAllAudioUI();
}

function clearSelectedSong() {
  if (isSelectedPreviewPlaying) {
    globalAudio.pause();
    isSelectedPreviewPlaying = false;
  }
  selectedSongData = null;
  document.getElementById('selectedSongPreview').classList.add('hidden');
  document.getElementById('songQuery').value = '';
  updateAllAudioUI();
}

// --- SUBMIT CONFESSION DENGAN PERLINDUNGAN COOLDOWN & TOAST ---
async function submitConfession() {
  const text = document.getElementById('curhatText').value.trim();
  const mood = document.getElementById('curhatMood').value;
  const btn = document.getElementById('btnSubmit');

  if (!text || !selectedSongData) return showToast("Lengkapi pesan curhat & pilih lagu!", "warning");
  if (text.length < 10) return showToast("Pesan curhat terlalu pendek (minimal 10 karakter)!", "warning");
  if (text.length > 500) return showToast("Pesan curhat terlalu panjang (maksimal 500 karakter)!", "warning");

  const COOLDOWN_MS = 2 * 60 * 1000;
  const lastPostTime = localStorage.getItem('last_confession_time');

  if (lastPostTime) {
    const timePassed = Date.now() - parseInt(lastPostTime);
    if (timePassed < COOLDOWN_MS) {
      const remainingSec = Math.ceil((COOLDOWN_MS - timePassed) / 1000);
      return showToast(`Harap tunggu ${remainingSec} detik lagi sebelum mengirim curhatan berikutnya.`, "warning");
    }
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Mengirim...`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/confessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mood, ...selectedSongData })
    });
    const result = await res.json();

    if (res.ok && result.success) {
      localStorage.setItem('last_confession_time', Date.now().toString());

      if (isSelectedPreviewPlaying) globalAudio.pause();
      document.getElementById('curhatText').value = '';
      clearSelectedSong();
      closeModal('writeModal');
      showToast("Curhatan berhasil dikirimkan secara anonim! ✨", "success");
      fetchConfessions();
    } else {
      showToast(result.error || result.message || "Gagal mengirimkan curhatan.", "error");
    }
  } catch (err) {
    showToast("Gagal terhubung ke server backend.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Kirim Secara Anonim`;
    }
  }
}

// --- REKOMENDASI LAGU GROQ AI ---
async function getAiRecommendation() {
  const text = document.getElementById('curhatText').value.trim();
  const btn = document.getElementById('btnAiRecommend');
  if (!text) return showToast("Isi curhatan terlebih dahulu agar AI bisa menganalisis emosi!", "warning");

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Menganalisis...`;

  try {
    const res = await fetch(`${API_BASE_URL}/ai/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const result = await res.json();

    if (res.ok && result.success && result.data.song) {
      const query = `${result.data.song} ${result.data.artist || ''}`;
      document.getElementById('songQuery').value = query;
      showToast(`Rekomendasi AI: "${result.data.song}" oleh ${result.data.artist || 'Penyanyi'}`, "success");
      searchSongsDirect(query);
    } else {
      showToast(result.error || "Gagal mendapatkan rekomendasi.", "error");
    }
  } catch (err) {
    showToast("Gagal terhubung ke server backend.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-amber-300 animate-pulse"></i> Rekomendasikan Lagu AI`;
  }
}

// --- STORY GENERATOR ANIMATION (DENGAN NATIVE RESOLUTION SCALING) ---
function openStoryModal(index) {
  currentStoryData = filteredConfessions[index];
  openModal('storyModal');
  
  // Set resolusi standar awal canvas untuk pratinjau (720p)
  const canvas = document.getElementById('storyCanvas');
  if (canvas) {
    canvas.width = 720;
    canvas.height = 1280;
  }
  startStoryCanvasAnimation();
}

function startStoryCanvasAnimation() {
  if (storyAnimationFrame) cancelAnimationFrame(storyAnimationFrame);

  const canvas = document.getElementById('storyCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const data = currentStoryData;

  const coverImg = new Image();
  coverImg.crossOrigin = 'Anonymous';
  coverImg.src = data.coverUrl || 'https://via.placeholder.com/300';

  function draw() {
    storyAngle += 0.015;

    // Hitung faktor skala berdasarkan lebar canvas nyata (skala acuan: 540px)
    const scale = canvas.width / 540;

    ctx.save();
    ctx.scale(scale, scale);

    // Canvas Background (Grid acuan 540x960)
    const grad = ctx.createLinearGradient(0, 0, 0, 960);
    grad.addColorStop(0, '#080a12');
    grad.addColorStop(0.5, '#1e1a3a');
    grad.addColorStop(1, '#080a12');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 540, 960);

    // Header Branding
    ctx.fillStyle = '#ec4899';
    ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CURHATIFY.', 270, 70);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Curhat lewat lagu, tanpa perlu ngaku..', 270, 95);

    // Mood Badge
    ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
    ctx.beginPath();
    ctx.roundRect(200, 115, 140, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#c084fc';
    ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(data.mood || '🔮 Pesan Tak Terucap', 270, 134);

    // Piringan Hitam (Vinyl Animation)
    ctx.save();
    ctx.translate(270, 270);
    ctx.rotate(storyAngle);
    ctx.fillStyle = '#0f111a';
    ctx.beginPath();
    ctx.arc(0, 0, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.strokeStyle = '#1a202c';
    ctx.beginPath();
    ctx.arc(0, 0, 80, 0, Math.PI * 2);
    ctx.stroke();

    if (coverImg.complete) {
      ctx.beginPath();
      ctx.arc(0, 0, 45, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(coverImg, -45, -45, 90, 90);
    }
    ctx.restore();

    // Equalizer Bars
    ctx.fillStyle = '#a855f7';
    const barCount = 12;
    for (let i = 0; i < barCount; i++) {
      const h = Math.sin(storyAngle * 3 + i) * 12 + 16;
      ctx.fillRect(210 + i * 10, 390, 5, h);
    }

    // Card Teks Curhatan
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(40, 440, 460, 400, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 36px serif';
    ctx.fillText('“', 70, 490);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'italic 500 20px "Plus Jakarta Sans", sans-serif';
    wrapText(ctx, `"${data.text}"`, 270, 530, 420, 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(data.songTitle, 270, 770);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`🎵 ${data.artist || 'Unknown Artist'}`, 270, 795);

    ctx.fillStyle = '#475569';
    ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Dengarkan & ungkapkan di curhatify.app', 270, 880);

    ctx.restore();

    storyAnimationFrame = requestAnimationFrame(draw);
  }

  draw();
}

// --- UNDUH VIDEO STORY (DENGAN TINGKAT BITRATE DAN PEMERIKSAAN MP4 H.264) ---
async function exportStoryVideo() {
  const btn = document.getElementById('btnExportVideo');
  const canvas = document.getElementById('storyCanvas');
  const data = currentStoryData;

  if (!data || !data.audioUrl) return showToast("Pratinjau lagu tidak tersedia.", "warning");

  const resVal = document.getElementById('storyResolution')?.value || '720';
  const formatVal = document.getElementById('storyFormat')?.value || 'mp4';

  // 1. Tentukan Resolusi Internal Canvas & Bitrate Perekaman Video
  let targetWidth = 720;
  let targetHeight = 1280;
  let targetBitrate = 6000000; // 6 Mbps untuk 720p

  if (resVal === '1080') {
    targetWidth = 1080;
    targetHeight = 1920;
    targetBitrate = 12000000; // 12 Mbps Tajam untuk 1080p Full HD
  } else if (resVal === '540') {
    targetWidth = 540;
    targetHeight = 960;
    targetBitrate = 3000000; // 3 Mbps untuk 540p
  }

  // Set resolusi piksel nyata pada Canvas
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // 2. Tentukan Codec & MIME Type Sesuai Format Pilihan
  let mimeType = '';
  let fileExt = formatVal;

  if (formatVal === 'mp4') {
    const mp4Options = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4;codecs=h264',
      'video/mp4',
      'video/webm;codecs=h264'
    ];

    for (const type of mp4Options) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }

    if (!mimeType) {
      mimeType = 'video/webm';
      showToast("Browser tidak mendukung perekaman MP4 native. Menggunakan format WebM H.264.", "info");
    }
  } else {
    const webmOptions = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    for (const type of webmOptions) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }
  }

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Merekam (${resVal}p .${fileExt.toUpperCase()})...`;

  try {
    globalAudio.pause();

    const storyAudio = new Audio();
    storyAudio.crossOrigin = 'anonymous';
    storyAudio.src = data.audioUrl;

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaElementSource(storyAudio);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    source.connect(audioCtx.destination);

    // Tangkap Stream Canvas pada 30 FPS
    const canvasStream = canvas.captureStream(30);
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    // Opsi MediaRecorder dengan Bitrate Tinggi agar 1080p Tajam
    const recorderOptions = {
      videoBitsPerSecond: targetBitrate
    };
    if (mimeType) recorderOptions.mimeType = mimeType;

    const mediaRecorder = new MediaRecorder(combinedStream, recorderOptions);
    const chunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Curhatify-Story-${resVal}p-${Date.now()}.${fileExt}`;
      a.click();

      storyAudio.pause();
      audioCtx.close();

      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-video"></i> Unduh Video Story`;
      showToast(`Video Story (${resVal}p .${fileExt.toUpperCase()}) berhasil diunduh! ✨`, "success");
    };

    await storyAudio.play();
    mediaRecorder.start();

    setTimeout(() => {
      if (mediaRecorder.state === 'recording') mediaRecorder.stop();
    }, 15000);

  } catch (err) {
    console.error('Perekaman Story Error:', err);
    showToast("Gagal merekam video. Mengunduh format PNG...", "warning");
    exportStoryImage();
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-video"></i> Unduh Video Story`;
  }
}

function exportStoryImage() {
  const canvas = document.getElementById('storyCanvas');
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `Curhatify-Story-${Date.now()}.png`;
  a.click();
  showToast("Gambar Story berhasil diunduh!", "success");
}

function copyStoryText() {
  if (currentStoryData) {
    navigator.clipboard.writeText(`"${currentStoryData.text}" — ${currentStoryData.songTitle} - ${currentStoryData.artist}`);
    showToast("Teks curhatan berhasil disalin!", "success");
  }
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { 
  document.getElementById(id).classList.add('hidden'); 
  if (id === 'storyModal' && storyAnimationFrame) cancelAnimationFrame(storyAnimationFrame);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else { line = testLine; }
  }
  ctx.fillText(line, x, y);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}