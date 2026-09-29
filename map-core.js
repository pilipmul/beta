// ==========================================
// CONFIG & SUPABASE CLIENT
// ==========================================
const SUPABASE_URL = "https://sfblelnbczlvykqemhtm.supabase.co";
const SUPABASE_KEY = "sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0"; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const FLOOR_MAPS = {
  basement: "basement.jpg",
  dasar: "dasar.jpg",
  satu: "satu.jpg",
  dua: "dua.jpg",
  rooftop: "rooftop.jpg"
};

const FLOOR_LABELS = {
  basement: "Basement",
  dasar: "Dasar",
  satu: "Lt 1",
  dua: "Lt 2",
  rooftop: "Rooftop"
};

const FLOOR_SHORT_CODES = {
  basement: "B",
  dasar: "G",
  satu: "1",
  dua: "2",
  rooftop: "R"
};

// ==========================================
// STATE GLOBAL APP & MAP
// ==========================================
let currentFloor = 'basement';
let activeCategory = 'tenant'; // 'tenant' | 'hse'
let activeFilter = 'all';
let isPlacingMode = false;
let appMode = 'view';

// Transformasi Kamera & Map
let scale = 1;
let panX = 0;
let panY = 0;
let rotation = 0;
let isDraggingMap = false;
let startMouseX = 0;
let startMouseY = 0;
let animFrameReq = null;
let initialPinchDistance = null;
let initialScale = 1;

const ALLOWED_EDITORS = ["Dede Hidayat", "Sutriono", "Herliana Oktavianti"];

// ==========================================
// HELPER PERMISSION, HAMBURGER & DROPDOWN TOUCH
// ==========================================
function isSuperAdmin() {
  try {
    const session = localStorage.getItem("user");
    if (!session) return false;
    const userData = JSON.parse(session);
    if (!userData) return false;
    const namaUser = userData.nama || userData.username;
    return ALLOWED_EDITORS.includes(namaUser);
  } catch {
    return false;
  }
}

function toggleDropdownMenu(containerId, e) {
  if (e) e.stopPropagation();
  const target = document.getElementById(containerId);
  
  document.querySelectorAll('.dropdown-container').forEach(el => {
    if (el.id !== containerId) el.classList.remove('is-open');
  });

  if (target) {
    target.classList.toggle('is-open');
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown-container').forEach(el => {
    el.classList.remove('is-open');
  });
}

function toggleHamburgerMenu(e) {
  if (e) e.stopPropagation();
  closeAllDropdowns();
  const dropdown = document.getElementById('customDropdownMenu');
  if (dropdown) dropdown.classList.toggle('hidden');
}

function renderHamburgerMenuContent() {
  const container = document.getElementById('custom-hamburger-content');
  if (!container) return;

  let html = '';
  const allowEdit = isSuperAdmin();

  if (allowEdit) {
    if (appMode === 'view') {
      html += `
        <button onclick="setAppMode('edit'); toggleHamburgerMenu();" class="w-full text-left px-3 py-2 text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] flex items-center gap-2.5 transition cursor-pointer">
          <i class="fa-solid fa-pen-to-square text-amber-500"></i>
          <span>Masuk Edit Mode</span>
        </button>
      `;
    } else {
      html += `
        <button onclick="setAppMode('view'); toggleHamburgerMenu();" class="w-full text-left px-3 py-2 text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] flex items-center gap-2.5 transition cursor-pointer">
          <i class="fa-solid fa-eye text-blue-500"></i>
          <span>Kembali View Mode</span>
        </button>
      `;
    }
  } else {
    html += `
      <div class="px-3 py-2 text-[#5f6368] dark:text-[#9aa0a6] text-center font-medium">Read Only</div>
    `;
  }

  html += `
    <button onclick="exportToPDF(); toggleHamburgerMenu();" class="w-full text-left px-3 py-2 text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] flex items-center gap-2.5 transition cursor-pointer border-t border-[#f1f3f4] dark:border-[#3c4043]">
      <i class="fa-solid fa-file-pdf text-red-500"></i>
      <span>Export Layout (PDF)</span>
    </button>
  `;

  container.innerHTML = html;
}

// ==========================================
// INIT APP CORE & GLOBAL EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  if (typeof renderHeader === 'function') {
    renderHeader({ activeMenu: "denah", subtitle: "Denah Interaktif" });
  }

  renderHamburgerMenuContent();
  initMapControls();

  const img = document.getElementById('denah-img');
  if (img) {
    if (img.complete && img.naturalWidth > 0) {
      onImageLoaded();
    } else {
      img.addEventListener('load', onImageLoaded);
    }
  }
});

// GLOBAL CLICK LISTENER UNTUK MENUTUP DROPDOWN, POPUP & SEARCH RESULT
document.addEventListener('click', (e) => {
  const btn = e.target.closest('#hamburgerBtn');
  const dropdown = document.getElementById('customDropdownMenu');
  const floatingCard = document.getElementById('floating-detail-card');

  if (!e.target.closest('.dropdown-container') && !e.target.closest('.legend-container')) {
    closeAllDropdowns();
    const legendContainer = document.getElementById('legend-info-container');
    if (legendContainer) legendContainer.classList.remove('is-open');
  }

  if (btn) {
    e.stopPropagation();
    toggleHamburgerMenu(e);
    return;
  }

  if (dropdown && !dropdown.classList.contains('hidden') && !dropdown.contains(e.target)) {
    dropdown.classList.add('hidden');
  }

  // TUTUP FLOATING DETAIL CARD JIKA KLIK DI LUAR CARD DAN BUKAN PADA MARKER
  if (
    floatingCard && 
    !floatingCard.classList.contains('opacity-0') && 
    !floatingCard.contains(e.target) && 
    !e.target.closest('.circle-marker') && 
    !e.target.closest('.hse-marker')
  ) {
    closeFloatingCard();
  }

  // TUTUP LIVE SEARCH RESULT DROPDOWN JIKA KLIK DI LUAR SEARCH BAR
  if (!e.target.closest('#globalSearchInput') && !e.target.closest('#searchResultDropdown')) {
    closeSearchDropdown();
  }
});

// DUKUNGAN MENUTUP POPUP VIA TOMBOL ESCAPE (ESC)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'Esc') {
    closeFloatingCard();
    closeAllDropdowns();
    closeSearchDropdown();
    if (typeof cancelPlacement === 'function') cancelPlacement();
  }
});

window.addEventListener('resize', () => { resetZoomToFit(); });

// ==========================================
// LANTAI & CATEGORY CONTROLLER
// ==========================================
function switchFloor(floorKey) {
  currentFloor = floorKey;
  cancelPlacement();
  closeFloatingCard();
  closeAllDropdowns();
  closeSearchDropdown();

  document.querySelectorAll('.current-floor-label').forEach(el => {
    el.innerText = FLOOR_SHORT_CODES[floorKey] || 'B';
  });

  const mobileActiveText = document.getElementById('mobile-floor-text-active');
  if (mobileActiveText) {
    mobileActiveText.innerText = FLOOR_SHORT_CODES[floorKey] || 'B';
  }

  ['basement', 'dasar', 'satu', 'dua', 'rooftop'].forEach(f => {
    document.querySelectorAll(`.tab-floor-${f}`).forEach(tab => {
      if (f === floorKey) {
        tab.className = `tab-floor-${f} w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition cursor-pointer bg-blue-600 text-white font-bold shadow-sm`;
      } else {
        tab.className = `tab-floor-${f} w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition cursor-pointer hover:bg-slate-100 dark:hover:bg-[#2d2d2d] text-[#202124] dark:text-[#e8eaed] font-bold`;
      }
    });
  });

  const denahImg = document.getElementById('denah-img');
  if (denahImg) {
    denahImg.onload = onImageLoaded;
    denahImg.src = FLOOR_MAPS[floorKey] || FLOOR_MAPS['basement'];
  }

  refreshActiveModule();
}

function setActiveCategory(cat) {
  activeCategory = cat;
  cancelPlacement();
  closeFloatingCard();
  closeAllDropdowns();
  closeSearchDropdown();

  const tLayer = document.getElementById('marker-tenant-layer');
  const hLayer = document.getElementById('marker-hse-layer');

  // Samakan class ukuran tombol agar konsisten w-7 h-7 sm:w-8 sm:h-8
  const btnClass = "category-dropdown-btn bg-white dark:bg-[#1e1e1e] border border-[#dadce0] dark:border-[#3c4043] w-7 h-7 sm:w-8 sm:h-8 rounded-lg shadow-xs cursor-pointer transition active:scale-95 flex items-center justify-center text-[#202124] dark:text-[#e8eaed]";

  if (cat === 'tenant') {
    document.querySelectorAll('.category-dropdown-btn').forEach(btn => {
      btn.className = btnClass;
    });
    document.querySelectorAll('.current-category-label').forEach(el => {
      // Tambahkan 'leading-none' untuk menetralkan line-height FontAwesome
      el.innerHTML = `<i class="fa-solid fa-store text-[11px] sm:text-xs leading-none"></i>`;
    });
    
    document.querySelectorAll('.btn-cat-tenant').forEach(btn => {
      btn.className = "btn-cat-tenant w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer text-blue-600 bg-blue-50 dark:bg-blue-900/30";
    });
    document.querySelectorAll('.btn-cat-hse').forEach(btn => {
      btn.className = "btn-cat-hse w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]";
    });

    if (tLayer) tLayer.style.display = 'block';
    if (hLayer) hLayer.style.display = 'none';
  } else {
    document.querySelectorAll('.category-dropdown-btn').forEach(btn => {
      btn.className = btnClass;
    });
    document.querySelectorAll('.current-category-label').forEach(el => {
      // Tambahkan 'leading-none' untuk menetralkan line-height FontAwesome
      el.innerHTML = `<i class="fa-solid fa-shield-halved text-[11px] sm:text-xs leading-none"></i>`;
    });

    document.querySelectorAll('.btn-cat-hse').forEach(btn => {
      btn.className = "btn-cat-hse w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30";
    });
    document.querySelectorAll('.btn-cat-tenant').forEach(btn => {
      btn.className = "btn-cat-tenant w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043]";
    });

    if (tLayer) tLayer.style.display = 'none';
    if (hLayer) hLayer.style.display = 'block';
  }

  refreshActiveModule();
}

function refreshActiveModule() {
  if (activeCategory === 'tenant') {
    if (typeof renderTenantList === 'function') renderTenantList();
    if (typeof renderTenantMarkers === 'function') renderTenantMarkers();
  } else if (activeCategory === 'hse') {
    if (typeof renderHSEList === 'function') renderHSEList();
    if (typeof renderHSEMarkers === 'function') renderHSEMarkers();
  }
}

function setAppMode(mode) {
  if (mode === 'edit' && !isSuperAdmin()) {
    alert("Akses Terbatas: Anda tidak memiliki izin untuk masuk ke Edit Mode.");
    return;
  }

  appMode = mode;
  const sidebarEdit = document.getElementById('sidebar-edit-container');

  if (sidebarEdit) {
    if (mode === 'edit') {
      sidebarEdit.classList.remove('hidden');
    } else {
      cancelPlacement();
      sidebarEdit.classList.add('hidden');
    }
  }

  renderHamburgerMenuContent();
  refreshActiveModule();
}

// ==========================================
// MAP TRANSFORM ENGINE (PAN / PINCH-ZOOM / ROTATE)
// ==========================================
function initMapControls() {
  const viewport = document.getElementById('viewport');
  if (!viewport) return;

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    zoomAtPoint(zoomFactor, e.clientX, e.clientY);
  }, { passive: false });

  viewport.addEventListener('mousedown', (e) => {
    if (isPlacingMode || e.button !== 0) return;
    if (e.target.closest('.circle-marker') || e.target.closest('.hse-marker') || e.target.closest('#floating-detail-card')) return;

    isDraggingMap = true;
    startMouseX = e.clientX - panX;
    startMouseY = e.clientY - panY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDraggingMap) return;
    panX = e.clientX - startMouseX;
    panY = e.clientY - startMouseY;
    requestUpdateMapTransform();
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingMap) {
      isDraggingMap = false;
      clampBoundaries();
    }
  });

  // GESTUR PINCH & TOUCH
  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      isDraggingMap = false;
      initialPinchDistance = getTouchDistance(e.touches);
      initialScale = scale;
    } else if (e.touches.length === 1 && !isPlacingMode) {
      if (e.target.closest('.circle-marker') || e.target.closest('.hse-marker') || e.target.closest('#floating-detail-card')) return;
      isDraggingMap = true;
      startMouseX = e.touches[0].clientX - panX;
      startMouseY = e.touches[0].clientY - panY;
    }
  }, { passive: false });

  viewport.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const currentDist = getTouchDistance(e.touches);
      if (initialPinchDistance && initialPinchDistance > 0) {
        const factor = currentDist / initialPinchDistance;
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        let targetScale = initialScale * factor;
        targetScale = Math.max(0.05, Math.min(10, targetScale));
        
        zoomAtPoint(targetScale, centerX, centerY, true);
      }
    } else if (e.touches.length === 1 && isDraggingMap) {
      panX = e.touches[0].clientX - startMouseX;
      panY = e.touches[0].clientY - startMouseY;
      requestUpdateMapTransform();
    }
  }, { passive: false });

  viewport.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      initialPinchDistance = null;
    }
    if (e.touches.length === 0) {
      isDraggingMap = false;
      clampBoundaries();
    }
  });

  viewport.addEventListener('gesturestart', (e) => {
    e.preventDefault();
    initialScale = scale;
  });

  viewport.addEventListener('gesturechange', (e) => {
    e.preventDefault();
    let targetScale = initialScale * e.scale;
    targetScale = Math.max(0.05, Math.min(10, targetScale));
    
    zoomAtPoint(targetScale, e.clientX, e.clientY, true);
  });

  viewport.addEventListener('gestureend', (e) => {
    e.preventDefault();
    clampBoundaries();
  });

  viewport.addEventListener('click', (e) => {
    if (!isPlacingMode || appMode !== 'edit' || !isSuperAdmin()) return;

    const img = document.getElementById('denah-img');
    if (!img) return;
    const rect = img.getBoundingClientRect();

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) {
      alert("Silakan klik tepat di dalam area gambar denah.");
      return;
    }

    const xPercent = (clickX / rect.width) * 100;
    const yPercent = (clickY / rect.height) * 100;

    if (activeCategory === 'tenant' && typeof saveTenantCoordinate === 'function') {
      saveTenantCoordinate(selectedTenantNo, xPercent, yPercent);
    } else if (activeCategory === 'hse' && typeof saveHSECoordinate === 'function') {
      saveHSECoordinate(selectedHSENo, xPercent, yPercent);
    }

    cancelPlacement();
  });
}

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function zoomAtPoint(factor, clientX, clientY, isAbsoluteFactor = false) {
  const viewport = document.getElementById('viewport');
  if (!viewport) return;

  const vRect = viewport.getBoundingClientRect();
  const mouseX = (clientX !== undefined) ? (clientX - vRect.left) : (vRect.width / 2);
  const mouseY = (clientY !== undefined) ? (clientY - vRect.top) : (vRect.height / 2);

  const oldScale = scale;
  let newScale = isAbsoluteFactor ? factor : scale * factor;
  newScale = Math.max(0.05, Math.min(10, newScale));

  if (newScale === oldScale) return;

  const scaleRatio = newScale / oldScale;
  panX = mouseX - (mouseX - panX) * scaleRatio;
  panY = mouseY - (mouseY - panY) * scaleRatio;
  scale = newScale;

  if (!initialPinchDistance) {
    clampBoundaries();
  }
  
  requestUpdateMapTransform();
}

function clampBoundaries() {
  const viewport = document.getElementById('viewport');
  const img = document.getElementById('denah-img');
  if (!viewport || !img) return;

  const vRect = viewport.getBoundingClientRect();
  const naturalW = img.naturalWidth || 800;
  const naturalH = img.naturalHeight || 600;

  const isRotated = (rotation === 90 || rotation === 270);
  const effWidth = isRotated ? naturalH : naturalW;
  const effHeight = isRotated ? naturalW : naturalH;

  const scaledW = effWidth * scale;
  const scaledH = effHeight * scale;

  const minX = vRect.width - scaledW - (vRect.width * 0.8);
  const maxX = vRect.width * 0.8;
  const minY = vRect.height - scaledH - (vRect.height * 0.8);
  const maxY = vRect.height * 0.8;

  panX = Math.min(Math.max(panX, minX), maxX);
  panY = Math.min(Math.max(panY, minY), maxY);
}

function zoomIn() { zoomAtPoint(1.25); }
function zoomOut() { zoomAtPoint(0.8); }

function rotateMap() {
  rotation = (rotation + 90) % 360;
  resetZoomToFit();
}

function resetZoomToFit() {
  const viewport = document.getElementById('viewport');
  const container = document.getElementById('map-container');
  const img = document.getElementById('denah-img');

  if (!viewport || !img || !container) return;

  container.style.transformOrigin = "0 0";
  const vRect = viewport.getBoundingClientRect();

  let naturalW = img.naturalWidth || img.width;
  let naturalH = img.naturalHeight || img.height;

  if (!naturalW || !naturalH || vRect.width === 0 || vRect.height === 0) {
    setTimeout(resetZoomToFit, 50);
    return;
  }

  const isRotated = (rotation === 90 || rotation === 270);
  const effWidth = isRotated ? naturalH : naturalW;
  const effHeight = isRotated ? naturalW : naturalH;

  const scaleX = vRect.width / effWidth;
  const scaleY = vRect.height / effHeight;
  scale = Math.min(scaleX, scaleY) * 0.9;

  const renderedW = effWidth * scale;
  const renderedH = effHeight * scale;

  panX = (vRect.width - renderedW) / 2;
  panY = (vRect.height - renderedH) / 2;

  requestUpdateMapTransform();
}

function requestUpdateMapTransform() {
  if (animFrameReq) cancelAnimationFrame(animFrameReq);
  animFrameReq = requestAnimationFrame(updateMapTransform);
}

function updateMapTransform() {
  const container = document.getElementById('map-container');
  if (!container) return;

  const img = document.getElementById('denah-img');
  const w = (img && img.naturalWidth) ? img.naturalWidth : (img ? img.width : 800);
  const h = (img && img.naturalHeight) ? img.naturalHeight : (img ? img.height : 600);

  let offsetX = 0;
  let offsetY = 0;

  if (rotation === 90) {
    offsetX = h * scale;
  } else if (rotation === 180) {
    offsetX = w * scale;
    offsetY = h * scale;
  } else if (rotation === 270) {
    offsetY = w * scale;
  }

  const finalX = panX + offsetX;
  const finalY = panY + offsetY;

  container.style.transform = `translate3d(${finalX}px, ${finalY}px, 0px) rotate(${rotation}deg) scale(${scale})`;
}

function onImageLoaded() {
  requestAnimationFrame(() => {
    resetZoomToFit();
    refreshActiveModule();
  });
}

// ==========================================
// FLOATING CARD & COMMON UI
// ==========================================
function closeFloatingCard() {
  const floatingCard = document.getElementById('floating-detail-card');
  if (floatingCard) {
    floatingCard.classList.add('translate-x-[120%]', 'opacity-0', 'pointer-events-none');
    floatingCard.classList.remove('translate-x-0', 'opacity-100', 'pointer-events-auto');
  }
  
  // Reset status seleksi marker
  if (typeof selectedTenantNo !== 'undefined') selectedTenantNo = null;
  if (typeof selectedHSENo !== 'undefined') selectedHSENo = null;
  
  if (typeof renderTenantMarkers === 'function' && activeCategory === 'tenant') renderTenantMarkers();
  if (typeof renderHSEMarkers === 'function' && activeCategory === 'hse') renderHSEMarkers();
}

function cancelPlacement() {
  isPlacingMode = false;
  const actionBar = document.getElementById('active-action-bar');
  if (actionBar) {
    actionBar.classList.add('hidden');
    actionBar.classList.remove('flex');
  }
  const viewport = document.getElementById('viewport');
  if (viewport) viewport.classList.remove('placing-mode');
}

function setFilter(filterType) {
  activeFilter = filterType;
  ['all', 'plotted', 'unplotted'].forEach(f => {
    const btn = document.getElementById(`btn-filter-${f}`);
    if (btn) {
      btn.className = (f === filterType)
        ? "py-1 rounded-md bg-[#1a73e8] dark:bg-[#8ab4f8] text-white dark:text-[#121212] font-semibold text-center cursor-pointer shadow-xs"
        : "py-1 rounded-md bg-[#f1f3f4] dark:bg-[#2d2d2d] text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#e8eaed] text-center cursor-pointer";
    }
  });
  refreshActiveModule();
}

// ==========================================
// SEARCH HANDLER & LIVE SEARCH DROPDOWN ENGINE
// ==========================================
function handleSearchInput(e) {
  const searchVal = e.target.value.trim();
  const btnClear = document.getElementById('btnClearSearch');
  if (btnClear) btnClear.classList.toggle('hidden', searchVal === '');

  refreshActiveModule();
  renderSearchDropdownResults(searchVal);
}

function handleSearchKeyDown(e) {
  if (e.key === 'Escape') {
    closeSearchDropdown();
  }
}

function clearGlobalSearch() {
  const searchInput = document.getElementById('globalSearchInput');
  if (searchInput) searchInput.value = '';
  const btnClear = document.getElementById('btnClearSearch');
  if (btnClear) btnClear.classList.add('hidden');
  
  closeSearchDropdown();
  refreshActiveModule();
}

function closeSearchDropdown() {
  const dropdown = document.getElementById('searchResultDropdown');
  if (dropdown) dropdown.classList.add('hidden');
}

function renderSearchDropdownResults(searchVal) {
  const dropdown = document.getElementById('searchResultDropdown');
  if (!dropdown) return;

  if (!searchVal) {
    dropdown.classList.add('hidden');
    return;
  }

  let html = '';
  const query = searchVal.toLowerCase();

  if (activeCategory === 'tenant') {
    if (typeof tenantsData === 'undefined' || !Array.isArray(tenantsData)) return;

    const matched = tenantsData.filter(t => 
      t.lokasi.toLowerCase().includes(query) || 
      (t.penyewa && t.penyewa.toLowerCase().includes(query)) || 
      String(t.no).includes(query)
    );

    if (matched.length === 0) {
      html = `<div class="p-3 text-center text-slate-400">Tenant / Penyewa tidak ditemukan</div>`;
    } else {
      html = matched.map(t => `
        <div onclick="selectTenantFromSearch(${t.no})" class="px-3 py-2 border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer flex items-center justify-between">
          <div>
            <div class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(t.lokasi)}</div>
            ${t.penyewa ? `<div class="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Penyewa: ${escapeHtml(t.penyewa)}</div>` : ''}
            <div class="text-[10px] text-slate-400 uppercase">Lantai: ${escapeHtml(t.lantai)} • #${t.no}</div>
          </div>
          <i class="fa-solid fa-chevron-right text-[10px] text-slate-400"></i>
        </div>
      `).join('');
    }
  } else if (activeCategory === 'hse') {
    if (typeof hseData === 'undefined' || !Array.isArray(hseData)) return;

    const matched = hseData.filter(h => 
      `${h.jenis} ${h.tipe} ${h.lokasi}`.toLowerCase().includes(query) || String(h.no).includes(query)
    );

    if (matched.length === 0) {
      html = `<div class="p-3 text-center text-slate-400">Data HSE tidak ditemukan</div>`;
    } else {
      html = matched.map(h => {
        const config = (typeof getHSEVisualConfig === 'function') 
          ? getHSEVisualConfig(h.jenis) 
          : { bgColor: 'bg-slate-500', icon: 'fa-shield-halved' };

        return `
          <div onclick="selectHSEFromSearch(${h.no})" class="px-3 py-2 border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-5 h-5 rounded ${config.bgColor} text-white flex items-center justify-center text-[10px] shrink-0">
                <i class="fa-solid ${config.icon}"></i>
              </div>
              <div>
                <div class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(h.jenis)} - ${escapeHtml(h.lokasi)}</div>
                <div class="text-[10px] text-slate-400 uppercase">Lantai: ${escapeHtml(h.lantai)} • #${h.no}</div>
              </div>
            </div>
            <i class="fa-solid fa-chevron-right text-[10px] text-slate-400"></i>
          </div>
        `;
      }).join('');
    }
  }

  dropdown.innerHTML = html;
  dropdown.classList.remove('hidden');
}

// Handler saat item sugesti Tenant diklik
function selectTenantFromSearch(no) {
  closeSearchDropdown();
  
  const tenant = tenantsData.find(t => t.no === no);
  if (!tenant) return;

  const searchInput = document.getElementById('globalSearchInput');
  const btnClear = document.getElementById('btnClearSearch');

  // 1. Ambil nilai query saat ini untuk mengecek apakah user mencari nama penyewa atau kode lokasi
  const currentQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
  
  // 2. Jika query cocok dengan nama penyewa, isi search box dengan nama penyewa. 
  // Jika tidak, prioritaskan lokasi/kode unik (seperti LB-a2-1)
  let selectedText = tenant.lokasi;
  if (tenant.penyewa && tenant.penyewa.toLowerCase().includes(currentQuery)) {
    selectedText = tenant.penyewa;
  }

  if (searchInput) {
    searchInput.value = selectedText;
  }
  if (btnClear) {
    btnClear.classList.remove('hidden');
  }

  // 3. Eksekusi seleksi lokasi (pindah lantai & buka popup detail)
  if (typeof selectTenant === 'function') {
    selectTenant(no);
  }

  // 4. Perbarui visual peta agar marker lain diredupkan
  refreshActiveModule();
}

// Handler saat item sugesti HSE diklik
function selectHSEFromSearch(no) {
  closeSearchDropdown();
  
  const hseItem = hseData.find(h => h.no === no);
  if (!hseItem) return;

  const searchInput = document.getElementById('globalSearchInput');
  const btnClear = document.getElementById('btnClearSearch');

  // Set search box persis dengan nama/lokasi item HSE yang dipilih
  const selectedText = hseItem.lokasi !== '-' ? hseItem.lokasi : `${hseItem.jenis} #${hseItem.no}`;

  if (searchInput) {
    searchInput.value = selectedText;
  }
  if (btnClear) {
    btnClear.classList.remove('hidden');
  }

  if (typeof selectHSE === 'function') {
    selectHSE(no);
  }

  refreshActiveModule();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function exportToPDF() {
  const denahImg = document.getElementById('denah-img');
  if (!denahImg) return;

  try {
    const imgW = denahImg.naturalWidth || denahImg.width || 800;
    const imgH = denahImg.naturalHeight || denahImg.height || 600;

    const canvas = document.createElement('canvas');
    const scaleFactor = 2;
    canvas.width = imgW * scaleFactor;
    canvas.height = imgH * scaleFactor;
    const ctx = canvas.getContext('2d');
    ctx.scale(scaleFactor, scaleFactor);

    ctx.drawImage(denahImg, 0, 0, imgW, imgH);

    if (typeof tenantsData !== 'undefined') {
      const floorTenants = tenantsData.filter(t => t.lantai === currentFloor);
      floorTenants.forEach(t => {
        if (!t.koordinat || t.koordinat.x == null) return;

        const xPx = (t.koordinat.x / 100) * imgW;
        const yPx = (t.koordinat.y / 100) * imgH;
        const radius = ((t.ukuran || 38) / 2);
        const status = String(t.status || '').toLowerCase();
        
        let fillColor = 'rgba(239, 68, 68, 0.4)';
        if (status.includes('sewa')) fillColor = 'rgba(59, 130, 246, 0.4)';
        else if (status.includes('kosong')) fillColor = 'rgba(249, 115, 22, 0.4)';
        else if (status.includes('terjual')) fillColor = 'rgba(34, 197, 94, 0.4)';
        else if (status.includes('fasum')) fillColor = 'rgba(6, 182, 212, 0.4)';

        ctx.beginPath();
        ctx.arc(xPx, yPx, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = fillColor;
        ctx.fill();
      });
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const { jsPDF } = window.jspdf;

    const orientation = imgW > imgH ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'px', format: [imgW, imgH] });

    pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH);
    pdf.save(`Denah_Layout_${currentFloor.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);

  } catch (err) {
    console.error("Gagal export PDF:", err);
    alert('Gagal mengunduh PDF: ' + err.message);
  }
}

// ==========================================
// LEGENDA INFORMASI LOGIC & COUNTER
// ==========================================
function toggleLegendMenu(e) {
  if (e) e.stopPropagation();
  const target = document.getElementById('legend-info-container');
  if (target) target.classList.toggle('is-open');
}

function updateLegendUI() {
  const badge = document.getElementById('legend-type-badge');
  const tenantContent = document.getElementById('legend-content-tenant');
  const hseContent = document.getElementById('legend-content-hse');

  if (!tenantContent || !hseContent) return;

  if (typeof activeCategory !== 'undefined' && activeCategory === 'hse') {
    if (badge) {
      badge.innerText = 'HSE';
      badge.className = 'text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
    }
    tenantContent.classList.add('hidden');
    hseContent.classList.remove('hidden');
    calculateHSECounts();
  } else {
    if (badge) {
      badge.innerText = 'Tenant';
      badge.className = 'text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';
    }
    tenantContent.classList.remove('hidden');
    hseContent.classList.add('hidden');
    calculateTenantCounts();
  }
}

function calculateTenantCounts() {
  if (typeof tenantsData === 'undefined' || !Array.isArray(tenantsData)) return;

  let sewa = 0, kosong = 0, terjual = 0, fasum = 0, hilang = 0;

  tenantsData.forEach(t => {
    const v = String(t.validasi || '').trim().toLowerCase();
    if (v === 'tutup') {
      hilang++;
      return;
    }

    const s = String(t.status || '').trim().toLowerCase();
    if (s.includes('sewa')) sewa++;
    else if (s.includes('kosong')) kosong++;
    else if (s.includes('terjual')) terjual++;
    else if (s.includes('fasum')) fasum++;
    else hilang++;
  });

  const elSewa = document.getElementById('count-tenant-sewa');
  const elKosong = document.getElementById('count-tenant-kosong');
  const elTerjual = document.getElementById('count-tenant-terjual');
  const elFasum = document.getElementById('count-tenant-fasum');
  const elHilang = document.getElementById('count-tenant-hilang');

  if (elSewa) elSewa.innerText = sewa;
  if (elKosong) elKosong.innerText = kosong;
  if (elTerjual) elTerjual.innerText = terjual;
  if (elFasum) elFasum.innerText = fasum;
  if (elHilang) elHilang.innerText = hilang;
}

function calculateHSECounts() {
  if (typeof hseData === 'undefined' || !Array.isArray(hseData)) return;

  let cctv = 0, apar = 0, hydrant = 0, bak = 0, guardtour = 0;

  hseData.forEach(h => {
    const key = String(h.jenis || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (key.includes('cctv')) cctv++;
    else if (key.includes('apar')) apar++;
    else if (key.includes('hydrant')) hydrant++;
    else if (key.includes('bak') || key.includes('kontrol')) bak++;
    else if (key.includes('guard') || key.includes('tour') || key.includes('pin')) guardtour++;
  });

  const elCctv = document.getElementById('count-hse-cctv');
  const elApar = document.getElementById('count-hse-apar');
  const elHydrant = document.getElementById('count-hse-hydrant');
  const elBak = document.getElementById('count-hse-bak');
  const elGuardtour = document.getElementById('count-hse-guardtour');

  if (elCctv) elCctv.innerText = cctv;
  if (elApar) elApar.innerText = apar;
  if (elHydrant) elHydrant.innerText = hydrant;
  if (elBak) elBak.innerText = bak;
  if (elGuardtour) elGuardtour.innerText = guardtour;
}

// SINKRONISASI OTOMATIS DATA LEGENDA SAAT SWITCH KAT
window.addEventListener('DOMContentLoaded', () => {
  if (typeof setActiveCategory === 'function') {
    const originalSetActiveCategory = setActiveCategory;
    window.setActiveCategory = function(cat) {
      originalSetActiveCategory(cat);
      updateLegendUI();
    };
  }

  if (typeof renderTenantList === 'function') {
    const originalRenderTenantList = renderTenantList;
    window.renderTenantList = function() {
      originalRenderTenantList();
      if (typeof activeCategory !== 'undefined' && activeCategory === 'tenant') calculateTenantCounts();
    };
  }

  if (typeof renderHSEList === 'function') {
    const originalRenderHSEList = renderHSEList;
    window.renderHSEList = function() {
      originalRenderHSEList();
      if (typeof activeCategory !== 'undefined' && activeCategory === 'hse') calculateHSECounts();
    };
  }

  updateLegendUI();
});
