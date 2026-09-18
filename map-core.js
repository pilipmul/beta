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
// INIT APP CORE
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

document.addEventListener('click', (e) => {
  const btn = e.target.closest('#hamburgerBtn');
  const dropdown = document.getElementById('customDropdownMenu');
  const floatingCard = document.getElementById('floating-detail-card');

  if (!e.target.closest('.dropdown-container')) {
    closeAllDropdowns();
  }

  if (btn) {
    e.stopPropagation();
    toggleHamburgerMenu(e);
    return;
  }
  if (dropdown && !dropdown.classList.contains('hidden') && !dropdown.contains(e.target)) {
    dropdown.classList.add('hidden');
  }
  if (floatingCard && !e.target.closest('.circle-marker') && !e.target.closest('.hse-marker') && !floatingCard.contains(e.target)) {
    closeFloatingCard();
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

  document.querySelectorAll('.current-floor-label').forEach(el => {
    el.innerText = FLOOR_LABELS[floorKey] || 'Basement';
  });

  ['basement', 'dasar', 'satu', 'dua', 'rooftop'].forEach(f => {
    document.querySelectorAll(`.tab-floor-${f}`).forEach(tab => {
      if (f === floorKey) {
        tab.className = `tab-floor-${f} w-full text-left px-3 py-2 font-semibold text-[#1a73e8] dark:text-[#8ab4f8] bg-blue-50 dark:bg-blue-900/30 transition cursor-pointer flex items-center justify-between`;
      } else {
        tab.className = `tab-floor-${f} w-full text-left px-3 py-2 font-medium text-[#202124] dark:text-[#e8eaed] transition hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] cursor-pointer flex items-center justify-between`;
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

  const tLayer = document.getElementById('marker-tenant-layer');
  const hLayer = document.getElementById('marker-hse-layer');

  if (cat === 'tenant') {
    document.querySelectorAll('.category-dropdown-btn').forEach(btn => {
      btn.className = "category-dropdown-btn bg-blue-600 text-white border border-blue-600 px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer transition";
    });
    document.querySelectorAll('.current-category-label').forEach(el => {
      el.innerHTML = `<i class="fa-solid fa-store text-[10px]"></i> Tenant`;
    });
    
    document.querySelectorAll('.btn-cat-tenant').forEach(btn => {
      btn.className = "btn-cat-tenant w-full text-left px-3 py-2 font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 transition cursor-pointer flex items-center gap-2";
    });
    document.querySelectorAll('.btn-cat-hse').forEach(btn => {
      btn.className = "btn-cat-hse w-full text-left px-3 py-2 font-medium text-[#202124] dark:text-[#e8eaed] transition hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] cursor-pointer flex items-center gap-2";
    });

    if (tLayer) tLayer.style.display = 'block';
    if (hLayer) hLayer.style.display = 'none';
  } else {
    document.querySelectorAll('.category-dropdown-btn').forEach(btn => {
      btn.className = "category-dropdown-btn bg-emerald-600 text-white border border-emerald-600 px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer transition";
    });
    document.querySelectorAll('.current-category-label').forEach(el => {
      el.innerHTML = `<i class="fa-solid fa-shield-halved text-[10px]"></i> HSE`;
    });

    document.querySelectorAll('.btn-cat-hse').forEach(btn => {
      btn.className = "btn-cat-hse w-full text-left px-3 py-2 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 transition cursor-pointer flex items-center gap-2";
    });
    document.querySelectorAll('.btn-cat-tenant').forEach(btn => {
      btn.className = "btn-cat-tenant w-full text-left px-3 py-2 font-medium text-[#202124] dark:text-[#e8eaed] transition hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] cursor-pointer flex items-center gap-2";
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

  // GESTUR PINCH & TOUCH FIX UNTUK MOBILE
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
        
        zoomAtPoint(targetScale / scale, centerX, centerY);
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
    zoomAtPoint(targetScale / scale, e.clientX, e.clientY);
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

function zoomAtPoint(factor, clientX, clientY) {
  const viewport = document.getElementById('viewport');
  if (!viewport) return;

  const vRect = viewport.getBoundingClientRect();
  const mouseX = (clientX !== undefined) ? (clientX - vRect.left) : (vRect.width / 2);
  const mouseY = (clientY !== undefined) ? (clientY - vRect.top) : (vRect.height / 2);

  const oldScale = scale;
  let newScale = scale * factor;
  newScale = Math.max(0.05, Math.min(10, newScale));

  if (newScale === oldScale) return;

  const scaleRatio = newScale / oldScale;
  panX = mouseX - (mouseX - panX) * scaleRatio;
  panY = mouseY - (mouseY - panY) * scaleRatio;
  scale = newScale;

  clampBoundaries();
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

  const minX = vRect.width - scaledW - (vRect.width * 0.6);
  const maxX = vRect.width * 0.6;
  const minY = vRect.height - scaledH - (vRect.height * 0.6);
  const maxY = vRect.height * 0.6;

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

function handleSearchKeyDown(e) {
  const btnClear = document.getElementById('btnClearSearch');
  const searchVal = e.target.value.trim();
  if (btnClear) btnClear.classList.toggle('hidden', searchVal === '');

  if (e.key === 'Enter') {
    e.preventDefault();
    refreshActiveModule();
  }
}

function clearGlobalSearch() {
  const searchInput = document.getElementById('globalSearchInput');
  if (searchInput) searchInput.value = '';
  const btnClear = document.getElementById('btnClearSearch');
  if (btnClear) btnClear.classList.add('hidden');
  closeFloatingCard();
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
    const scaleFactor = 2; // Resolusi tinggi (Retina/HD)
    canvas.width = imgW * scaleFactor;
    canvas.height = imgH * scaleFactor;
    const ctx = canvas.getContext('2d');
    ctx.scale(scaleFactor, scaleFactor);

    // 1. Gambar Gambar Denah Dasar
    ctx.drawImage(denahImg, 0, 0, imgW, imgH);

    // 2. Export Berdasarkan Kategori Aktif (Tenant vs HSE)
    if (activeCategory === 'tenant') {
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
    } else if (activeCategory === 'hse') {
      if (typeof hseData !== 'undefined') {
        const floorHSE = hseData.filter(h => h.koordinat && h.koordinat.floor === currentFloor);
        floorHSE.forEach(h => {
          if (!h.koordinat || h.koordinat.x == null || h.koordinat.y == null) return;

          const xPx = (h.koordinat.x / 100) * imgW;
          const yPx = (h.koordinat.y / 100) * imgH;
          const radius = (h.ukuran || 32) / 2;

          // Ambil warna berdasarkan jenis HSE
          const jenis = String(h.jenis || '').toLowerCase();
          let fillColor = 'rgba(71, 85, 105, 0.8)'; // default slate

          if (jenis.includes('cctv')) fillColor = 'rgba(79, 70, 229, 0.855)';      // indigo
          else if (jenis.includes('apar')) fillColor = 'rgba(220, 38, 38, 0.85)';   // red
          else if (jenis.includes('hydrant')) fillColor = 'rgba(37, 99, 235, 0.85)'; // blue
          else if (jenis.includes('bak') || jenis.includes('kontrol')) fillColor = 'rgba(217, 119, 6, 0.85)'; // amber
          else if (jenis.includes('guard') || jenis.includes('tour') || jenis.includes('pin')) fillColor = 'rgba(5, 150, 105, 0.85)'; // emerald

          // Gambar Lingkaran Marker HSE
          ctx.beginPath();
          ctx.arc(xPx, yPx, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = fillColor;
          ctx.fill();

          // Border Putih
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();

          // Tuliskan Label Singkat/Nomor HSE di Titik
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${h.no}`, xPx, yPx);
        });
      }
    }

    // 3. Render ke PDF
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const { jsPDF } = window.jspdf;

    const orientation = imgW > imgH ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'px', format: [imgW, imgH] });

    pdf.addImage(imgData, 'JPEG', 0, 0, imgW, imgH);
    pdf.save(`Denah_${activeCategory.toUpperCase()}_${currentFloor.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);

  } catch (err) {
    console.error("Gagal export PDF:", err);
    alert('Gagal mengunduh PDF: ' + err.message);
  }
}