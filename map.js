const SUPABASE_URL = "https://sfblelnbczlvykqemhtm.supabase.co";
const SUPABASE_KEY = "sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0"; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const FLOOR_MAPS = {
  basement: "https://raw.githubusercontent.com/pilipmul/beta/main/basement.jpg",
  dasar: "https://raw.githubusercontent.com/pilipmul/beta/main/dasar.jpg",
  satu: "https://raw.githubusercontent.com/pilipmul/beta/main/satu.jpg",
  dua: "https://raw.githubusercontent.com/pilipmul/beta/main/dua.jpg",
  rooftop: "https://raw.githubusercontent.com/pilipmul/beta/main/rooftop.jpg"
};

let tenantsData = [];
let currentFloor = 'basement';
let activeFilter = 'all';
let selectedTenantNo = null;
let isPlacingMode = false;
let appMode = 'view';

// MAP STATE & TRANSFORMATIONS
let scale = 1;
let panX = 0;
let panY = 0;
let isDraggingMap = false;
let startMouseX = 0;
let startMouseY = 0;
let animFrameReq = null;
let initialPinchDistance = null;
let initialScale = 1;

function isSuperAdmin() {
  try {
    const session = localStorage.getItem("user");
    if (!session) return false;
    const userData = JSON.parse(session);
    return userData && (userData.nama === "Dede Hidayat" || userData.username === "Dede Hidayat");
  } catch {
    return false;
  }
}

function toggleHamburgerMenu(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('customDropdownMenu');
  if (dropdown) dropdown.classList.toggle('hidden');
}

function renderHamburgerMenuContent() {
  const container = document.getElementById('custom-hamburger-content');
  if (!container) return;

  let html = '';

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

  if (isSuperAdmin()) {
    html += `
      <button onclick="openModal('add'); toggleHamburgerMenu();" class="w-full text-left px-3 py-2 text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] flex items-center gap-2.5 transition cursor-pointer border-t border-[#f1f3f4] dark:border-[#3c4043]">
        <i class="fa-solid fa-plus text-blue-500"></i>
        <span>Tambah Tenant</span>
      </button>
    `;
  }

  html += `
    <button onclick="exportCSV(); toggleHamburgerMenu();" class="w-full text-left px-3 py-2 text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] flex items-center gap-2.5 transition cursor-pointer border-t border-[#f1f3f4] dark:border-[#3c4043]">
      <i class="fa-solid fa-file-csv text-emerald-500"></i>
      <span>Export CSV</span>
    </button>
  `;

  container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof renderHeader === 'function') {
    renderHeader({
      activeMenu: "denah",
      subtitle: "Denah Interaktif"
    });
  }

  renderHamburgerMenuContent();
  initMapControls();
  fetchDataFromSupabase();

  const img = document.getElementById('denah-img');
  if (img) {
    if (img.complete) {
      onImageLoaded();
    } else {
      img.addEventListener('load', onImageLoaded);
    }
  }

  supabaseClient
    .channel('public:tenant')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tenant' }, () => {
      fetchDataFromSupabase();
    })
    .subscribe();
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('#hamburgerBtn');
  const dropdown = document.getElementById('customDropdownMenu');
  const floatingCard = document.getElementById('floating-detail-card');

  if (btn) {
    e.stopPropagation();
    toggleHamburgerMenu(e);
    return;
  }

  if (dropdown && !dropdown.classList.contains('hidden') && !dropdown.contains(e.target)) {
    dropdown.classList.add('hidden');
  }

  if (floatingCard && !e.target.closest('.circle-marker') && !floatingCard.contains(e.target)) {
    closeFloatingCard();
  }
});

async function fetchDataFromSupabase() {
  try {
    const { data, error } = await supabaseClient
      .from('tenant')
      .select('no, lokasi, lantai, koordinat')
      .order('no', { ascending: true });

    if (error) throw error;

    tenantsData = data.map(item => {
      let parsedCoords = null;
      if (item.koordinat) {
        try {
          parsedCoords = typeof item.koordinat === 'string' 
            ? JSON.parse(item.koordinat) 
            : item.koordinat;
        } catch (e) {
          console.warn(`Gagal parse koordinat #${item.no}`, item.koordinat);
        }
      }

      return {
        no: item.no,
        lokasi: item.lokasi || `Tenant ${item.no}`,
        lantai: (item.lantai || 'basement').toLowerCase().trim(),
        koordinat: parsedCoords,
        ukuran: (parsedCoords && parsedCoords.size) ? parseFloat(parsedCoords.size) : 38
      };
    });

    renderTenantList();
    renderMarkersOnMap();

  } catch (err) {
    console.error("Gagal mengambil data:", err);
  }
}

async function saveCoordinateToSupabase(noTenant, xPercent, yPercent) {
  if (appMode !== 'edit') return;

  const target = tenantsData.find(t => t.no === noTenant);
  const currentSize = target ? target.ukuran : 38;

  const coordPayload = (xPercent !== null && yPercent !== null) 
    ? JSON.stringify({ 
        x: parseFloat(xPercent.toFixed(2)), 
        y: parseFloat(yPercent.toFixed(2)),
        size: currentSize 
      })
    : null;

  if (target) {
    target.koordinat = coordPayload ? JSON.parse(coordPayload) : null;
  }
  renderTenantList();
  renderMarkersOnMap();

  try {
    const { error } = await supabaseClient
      .from('tenant')
      .update({ koordinat: coordPayload })
      .eq('no', noTenant);

    if (error) throw error;
  } catch (err) {
    alert(`Gagal menyimpan ke database: ${err.message}`);
    fetchDataFromSupabase();
  }
}

function switchFloor(floorKey) {
  currentFloor = floorKey;
  selectedTenantNo = null;
  cancelPlacement();
  closeFloatingCard();

  ['basement', 'dasar', 'satu', 'dua', 'rooftop'].forEach(f => {
    const tab = document.getElementById(`tab-floor-${f}`);
    if (tab) {
      if (f === floorKey) {
        tab.className = "px-2.5 py-0.5 rounded-md font-medium transition bg-[#1a73e8] dark:bg-[#8ab4f8] text-white dark:text-[#121212] shadow-xs cursor-pointer";
      } else {
        tab.className = "px-2.5 py-0.5 rounded-md font-medium transition text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-white cursor-pointer";
      }
    }
  });

  const denahImg = document.getElementById('denah-img');
  if (denahImg) {
    denahImg.onload = onImageLoaded;
    denahImg.src = FLOOR_MAPS[floorKey] || FLOOR_MAPS['basement'];
  }

  renderTenantList();
}

function setAppMode(mode) {
  appMode = mode;
  const sidebarEdit = document.getElementById('sidebar-edit-container');

  if (mode === 'edit') {
    sidebarEdit.classList.remove('hidden');
  } else {
    cancelPlacement();
    sidebarEdit.classList.add('hidden');
  }

  renderHamburgerMenuContent();
  renderTenantList();
  renderMarkersOnMap();
}

function renderTenantList() {
  const container = document.getElementById('tenant-list-container');
  if (!container) return;

  const searchInput = document.getElementById('globalSearchInput');
  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let floorTenants = tenantsData.filter(t => t.lantai === currentFloor);

  let filtered = floorTenants.filter(t => {
    const matchSearch = t.lokasi.toLowerCase().includes(searchVal) || String(t.no).includes(searchVal);
    if (activeFilter === 'plotted') return matchSearch && t.koordinat !== null;
    if (activeFilter === 'unplotted') return matchSearch && t.koordinat === null;
    return matchSearch;
  });

  document.getElementById('floor-count').innerText = floorTenants.length;
  document.getElementById('plotted-count').innerText = floorTenants.filter(t => t.koordinat !== null).length;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">Tidak ada data tenant.</div>`;
    return;
  }

  const allowEdit = isSuperAdmin();

  container.innerHTML = filtered.map(t => {
    const hasCoords = t.koordinat !== null;
    const isSelected = selectedTenantNo === t.no;

    return `
      <div class="p-2.5 flex items-center justify-between transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-[#1a73e8]' : ''}"
           onclick="selectTenant(${t.no})">
        <div class="flex-1 pr-2 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-mono px-1 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-slate-300 font-semibold">#${t.no}</span>
            <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">${escapeHtml(t.lokasi)}</span>
          </div>
        </div>

        <div class="flex items-center space-x-1 shrink-0" onclick="event.stopPropagation()">
          ${hasCoords ? `
            <button onclick="startPlacement(${t.no})" title="Pindahkan Titik" class="p-1 text-slate-400 hover:text-blue-600 rounded transition cursor-pointer">
              <i class="fa-solid fa-arrows-rotate text-xs"></i>
            </button>
            ${allowEdit ? `
              <button onclick="openModal('edit', ${t.no})" title="Edit Data Tenant" class="p-1 text-slate-400 hover:text-blue-600 rounded transition cursor-pointer">
                <i class="fa-solid fa-pen text-xs"></i>
              </button>
            ` : ''}
            <button onclick="deleteCoordinate(${t.no})" title="Hapus Titik" class="p-1 text-slate-400 hover:text-red-500 rounded transition cursor-pointer">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          ` : `
            <button onclick="startPlacement(${t.no})" class="text-[11px] bg-[#1a73e8] text-white px-2 py-0.5 rounded flex items-center gap-1 font-semibold shadow-xs transition cursor-pointer">
              <i class="fa-solid fa-plus text-[10px]"></i> Plot
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function renderMarkersOnMap() {
  const overlay = document.getElementById('marker-overlay');
  if (!overlay) return;
  overlay.innerHTML = '';

  const floorTenants = tenantsData.filter(t => t.lantai === currentFloor);

  floorTenants.forEach(t => {
    if (!t.koordinat || t.koordinat.x == null || t.koordinat.y == null) return;

    const isSelected = selectedTenantNo === t.no;
    const markerSize = t.ukuran || 38;

    const marker = document.createElement('div');
    marker.className = `circle-marker ${isSelected ? 'active-selected' : ''}`;
    marker.style.left = `${t.koordinat.x}%`;
    marker.style.top = `${t.koordinat.y}%`;
    marker.style.width = `${markerSize}px`;
    marker.style.height = `${markerSize}px`;

    marker.innerHTML = `<div class="marker-tooltip">${escapeHtml(t.lokasi)}</div>`;

    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      selectTenant(t.no);
    });

    if (appMode === 'edit') {
      marker.addEventListener('mousedown', (e) => startDraggingMarker(e, t.no));
    }

    overlay.appendChild(marker);
  });
}

function renderFloatingDetail(noTenant) {
  const floatingCard = document.getElementById('floating-detail-card');
  const contentContainer = document.getElementById('floating-detail-content');

  if (!noTenant) {
    closeFloatingCard();
    return;
  }

  const tenant = tenantsData.find(t => t.no === noTenant);
  if (!tenant) return;

  contentContainer.innerHTML = `
    <div class="flex items-start justify-between border-b border-slate-200 dark:border-zinc-800 pb-2 mb-3">
      <div class="pr-2">
        <span class="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Lantai ${tenant.lantai}</span>
        <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug mt-0.5">${escapeHtml(tenant.lokasi)}</h3>
      </div>
      <button onclick="closeFloatingCard()" class="text-slate-400 hover:text-slate-600 p-1 rounded-full text-xs cursor-pointer">✕</button>
    </div>
    
    <div class="flex items-center gap-2 text-xs text-slate-500">
      <i class="fa-solid fa-circle-check text-emerald-500"></i>
      <span>Lokasi terpetakan di denah</span>
    </div>
  `;

  floatingCard.classList.remove('translate-x-[120%]', 'opacity-0', 'pointer-events-none');
  floatingCard.classList.add('translate-x-0', 'opacity-100', 'pointer-events-auto');
}

function closeFloatingCard() {
  const floatingCard = document.getElementById('floating-detail-card');
  if (floatingCard) {
    floatingCard.classList.add('translate-x-[120%]', 'opacity-0', 'pointer-events-none');
    floatingCard.classList.remove('translate-x-0', 'opacity-100', 'pointer-events-auto');
  }
}

/* ==========================================================================
   INTERACTIVE MAP ENGINE
   ========================================================================== */

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

  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      initialPinchDistance = getTouchDistance(e.touches);
      initialScale = scale;
    } else if (e.touches.length === 1 && !isPlacingMode) {
      isDraggingMap = true;
      startMouseX = e.touches[0].clientX - panX;
      startMouseY = e.touches[0].clientY - panY;
    }
  }, { passive: true });

  viewport.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && initialPinchDistance) {
      const currentDist = getTouchDistance(e.touches);
      const factor = currentDist / initialPinchDistance;
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      
      zoomAtPoint(factor, centerX, centerY, true);
      initialPinchDistance = currentDist;
    } else if (e.touches.length === 1 && isDraggingMap) {
      panX = e.touches[0].clientX - startMouseX;
      panY = e.touches[0].clientY - startMouseY;
      requestUpdateMapTransform();
    }
  }, { passive: true });

  viewport.addEventListener('touchend', () => {
    initialPinchDistance = null;
    isDraggingMap = false;
    clampBoundaries();
  });

  viewport.addEventListener('click', (e) => {
    if (!isPlacingMode || !selectedTenantNo || appMode !== 'edit') return;

    const img = document.getElementById('denah-img');
    const rect = img.getBoundingClientRect();

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (clickX < 0 || clickX > rect.width || clickY < 0 || clickY > rect.height) {
      alert("Silakan klik tepat di dalam area gambar denah.");
      return;
    }

    const xPercent = (clickX / rect.width) * 100;
    const yPercent = (clickY / rect.height) * 100;

    saveCoordinateToSupabase(selectedTenantNo, xPercent, yPercent);
    cancelPlacement();
  });
}

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function zoomAtPoint(factor, clientX, clientY, isAbsoluteFactor = false) {
  const viewport = document.getElementById('viewport');
  if (!viewport) return;

  const vRect = viewport.getBoundingClientRect();

  const targetX = (clientX !== undefined) ? (clientX - vRect.left) : (vRect.width / 2);
  const targetY = (clientY !== undefined) ? (clientY - vRect.top) : (vRect.height / 2);

  const oldScale = scale;
  let newScale = isAbsoluteFactor ? factor : scale * factor;
  
  newScale = Math.max(0.1, Math.min(8, newScale));

  if (newScale === oldScale) return;

  panX = targetX - (targetX - panX) * (newScale / oldScale);
  panY = targetY - (targetY - panY) * (newScale / oldScale);
  
  scale = newScale;
  clampBoundaries();
  requestUpdateMapTransform();
}

function clampBoundaries() {
  const viewport = document.getElementById('viewport');
  const img = document.getElementById('denah-img');
  if (!viewport || !img) return;

  const vRect = viewport.getBoundingClientRect();
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;

  if (!naturalW || !naturalH) return;

  const scaledW = naturalW * scale;
  const scaledH = naturalH * scale;

  const minX = vRect.width - scaledW - (vRect.width * 0.5);
  const maxX = vRect.width * 0.5;
  const minY = vRect.height - scaledH - (vRect.height * 0.5);
  const maxY = vRect.height * 0.5;

  panX = Math.min(Math.max(panX, minX), maxX);
  panY = Math.min(Math.max(panY, minY), maxY);
}

function zoomIn() { zoomAtPoint(1.25); }
function zoomOut() { zoomAtPoint(0.8); }

function resetZoomToFit() {
  const viewport = document.getElementById('viewport');
  const img = document.getElementById('denah-img');
  
  if (!viewport || !img) return;

  const vRect = viewport.getBoundingClientRect();
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;

  if (!naturalW || !naturalH || vRect.width === 0 || vRect.height === 0) return;

  const scaleX = vRect.width / naturalW;
  const scaleY = vRect.height / naturalH;
  scale = Math.min(scaleX, scaleY) * 0.9; 

  const scaledWidth = naturalW * scale;
  const scaledHeight = naturalH * scale;

  panX = (vRect.width - scaledWidth) / 2;
  panY = (vRect.height - scaledHeight) / 2;

  requestUpdateMapTransform();
}

function requestUpdateMapTransform() {
  if (animFrameReq) cancelAnimationFrame(animFrameReq);
  animFrameReq = requestAnimationFrame(updateMapTransform);
}

function updateMapTransform() {
  const container = document.getElementById('map-container');
  if (container) {
    container.style.transform = `translate3d(${panX}px, ${panY}px, 0px) scale(${scale})`;
  }
}

function centerMapOnCoordinate(xPercent, yPercent) {
  const viewport = document.getElementById('viewport');
  const img = document.getElementById('denah-img');
  if (!viewport || !img) return;

  const vRect = viewport.getBoundingClientRect();
  const naturalW = img.naturalWidth || img.width;
  const naturalH = img.naturalHeight || img.height;

  if (!naturalW || !naturalH) return;

  const markerPixelX = (xPercent / 100) * naturalW;
  const markerPixelY = (yPercent / 100) * naturalH;

  panX = (vRect.width / 2) - (markerPixelX * scale);
  panY = (vRect.height / 2) - (markerPixelY * scale);

  clampBoundaries();
  requestUpdateMapTransform();
}

// DIPERBARUI: Klik tenant/marker tidak lagi menggeser peta ke tengah
function selectTenant(no) {
  selectedTenantNo = no;
  renderTenantList();
  renderMarkersOnMap();

  const tenant = tenantsData.find(t => t.no === no);
  if (tenant) {
    if (tenant.lantai !== currentFloor) {
      switchFloor(tenant.lantai);
    }

    if (tenant.koordinat && tenant.koordinat.x != null && tenant.koordinat.y != null) {
      renderFloatingDetail(no);
    } else {
      closeFloatingCard();
    }
  }
}

function startPlacement(no) {
  if (appMode !== 'edit') return;
  
  selectedTenantNo = no;
  isPlacingMode = true;
  
  const t = tenantsData.find(item => item.no === no);
  document.getElementById('target-tenant-name').innerText = t ? t.lokasi : `#${no}`;
  document.getElementById('active-action-bar').classList.remove('hidden');
  document.getElementById('active-action-bar').classList.add('flex');
  document.getElementById('viewport').classList.add('placing-mode');
  
  renderTenantList();
  renderMarkersOnMap();
}

function cancelPlacement() {
  isPlacingMode = false;
  const actionBar = document.getElementById('active-action-bar');
  if (actionBar) {
    actionBar.classList.add('hidden');
    actionBar.classList.remove('flex');
  }
  const viewport = document.getElementById('viewport');
  if (viewport) {
    viewport.classList.remove('placing-mode');
  }
}

function startDraggingMarker(event, no) {
  if (event.button !== 0 || isPlacingMode || appMode !== 'edit') return;
  event.stopPropagation();
  selectTenant(no);

  const img = document.getElementById('denah-img');
  let isDragging = true;

  function onMouseMove(e) {
    if (!isDragging) return;
    const rect = img.getBoundingClientRect();
    
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;

    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    const target = tenantsData.find(t => t.no === no);
    if (target) {
      target.koordinat = { 
        x: parseFloat(x.toFixed(2)), 
        y: parseFloat(y.toFixed(2)),
        size: target.ukuran || 38
      };
      renderMarkersOnMap();
      renderFloatingDetail(no);
    }
  }

  function onMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    
    const rect = img.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;

    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    saveCoordinateToSupabase(no, x, y);
    
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function deleteCoordinate(no) {
  if (appMode !== 'edit') return;
  if (confirm(`Hapus titik lokasi untuk tenant #${no}?`)) {
    saveCoordinateToSupabase(no, null, null);
    closeFloatingCard();
  }
}

function openModal(mode, no = null) {
  if (!isSuperAdmin()) {
    alert("Anda tidak memiliki hak akses untuk menambah/mengubah data tenant.");
    return;
  }

  const modal = document.getElementById('modal');
  const form = document.getElementById('tenantForm');
  const title = document.getElementById('modalTitle');
  const btnDelete = document.getElementById('btnDeleteInModal');

  form.reset();
  document.getElementById('editNo').value = '';

  if (mode === 'add') {
    title.innerText = 'Tambah Tenant Master';
    btnDelete.classList.add('hidden');
    document.getElementById('inputLantai').value = currentFloor;
    document.getElementById('inputUkuran').value = '38';
  } else if (mode === 'edit' && no) {
    const tenant = tenantsData.find(t => t.no === no);
    if (!tenant) return;

    title.innerText = `Edit Tenant #${tenant.no}`;
    btnDelete.classList.remove('hidden');

    document.getElementById('editNo').value = tenant.no;
    document.getElementById('inputLokasi').value = tenant.lokasi || '';
    document.getElementById('inputLantai').value = tenant.lantai || currentFloor;
    document.getElementById('inputUkuran').value = tenant.ukuran || 38;
  }

  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

async function saveTenantData(e) {
  e.preventDefault();

  const editNo = document.getElementById('editNo').value;
  const lokasi = document.getElementById('inputLokasi').value.trim();
  const lantai = document.getElementById('inputLantai').value;
  const ukuranVal = document.getElementById('inputUkuran').value;
  const ukuran = ukuranVal ? parseFloat(ukuranVal) : 38;

  try {
    if (editNo) {
      const target = tenantsData.find(t => String(t.no) === String(editNo));
      let currentCoord = target ? target.koordinat : null;

      if (currentCoord) {
        currentCoord.size = ukuran;
      }

      const { error } = await supabaseClient
        .from('tenant')
        .update({ 
          lokasi, 
          lantai, 
          koordinat: currentCoord ? JSON.stringify(currentCoord) : null 
        })
        .eq('no', editNo);

      if (error) throw error;
    } else {
      const { data: maxNoData, error: maxNoError } = await supabaseClient
        .from('tenant')
        .select('no')
        .order('no', { ascending: false })
        .limit(1);

      if (maxNoError) throw maxNoError;

      let nextNo = 1;
      if (maxNoData && maxNoData.length > 0 && maxNoData[0].no) {
        nextNo = parseInt(maxNoData[0].no, 10) + 1;
      }

      const { error } = await supabaseClient
        .from('tenant')
        .insert([{ no: nextNo, lokasi, lantai, koordinat: null }]);

      if (error) throw error;
    }

    closeModal();
    fetchDataFromSupabase();

  } catch (err) {
    alert('Gagal menyimpan tenant: ' + err.message);
  }
}

async function deleteTenantInModal() {
  const no = document.getElementById('editNo').value;
  if (!no) return;

  if (!confirm(`Apakah Anda yakin ingin menghapus data tenant #${no}?`)) return;

  try {
    const { error } = await supabaseClient
      .from('tenant')
      .delete()
      .eq('no', no);

    if (error) throw error;

    closeModal();
    fetchDataFromSupabase();

  } catch (err) {
    alert('Gagal menghapus tenant: ' + err.message);
  }
}

function setFilter(filterType) {
  activeFilter = filterType;
  ['all', 'plotted', 'unplotted'].forEach(f => {
    const btn = document.getElementById(`btn-filter-${f}`);
    if (btn) {
      if (f === filterType) {
        btn.className = "py-1 rounded-md bg-[#1a73e8] dark:bg-[#8ab4f8] text-white dark:text-[#121212] font-semibold text-center cursor-pointer shadow-xs";
      } else {
        btn.className = "py-1 rounded-md bg-[#f1f3f4] dark:bg-[#2d2d2d] text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#e8eaed] text-center cursor-pointer";
      }
    }
  });
  renderTenantList();
}

function handleSearchKeyDown(e) {
  const btnClear = document.getElementById('btnClearSearch');
  const searchVal = e.target.value.trim();

  if (btnClear) btnClear.classList.toggle('hidden', searchVal === '');

  if (e.key === 'Enter') {
    e.preventDefault();
    if (searchVal.length > 0) {
      const match = tenantsData.find(t => 
        t.lokasi.toLowerCase().includes(searchVal.toLowerCase()) || String(t.no) === searchVal
      );

      if (match) {
        selectTenant(match.no);
      } else {
        alert(`Lokasi "${searchVal}" tidak ditemukan.`);
      }
    }
  }

  if (appMode === 'edit') {
    renderTenantList();
  }
}

function clearGlobalSearch() {
  const searchInput = document.getElementById('globalSearchInput');
  if (searchInput) searchInput.value = '';
  document.getElementById('btnClearSearch').classList.add('hidden');
  closeFloatingCard();
  renderTenantList();
}

function onImageLoaded() {
  setTimeout(() => {
    resetZoomToFit();
    renderMarkersOnMap();
  }, 50);
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

async function exportCSV() {
  try {
    const { data, error } = await supabaseClient
      .from('tenant')
      .select('*')
      .order('no', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    const headers = ['no', 'lokasi', 'lantai', 'koordinat'];
    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const values = headers.map(header => `"${String(row[header] ?? '').replace(/"/g, '""')}"`);
      csvRows.push(values.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tenant_denah_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    alert('Gagal mengunduh CSV: ' + err.message);
  }
}