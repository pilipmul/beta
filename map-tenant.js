// ==========================================
// MAP-TENANT.JS - MODUL LOGIKA TENANT
// ==========================================

// State Khusus Modul Tenant
let tenantsData = [];
let selectedTenantNo = null;

document.addEventListener('DOMContentLoaded', () => {
  fetchTenantFromSupabase();

  // Realtime Listener Supabase khusus tabel tenant
  supabaseClient
    .channel('public:tenant')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tenant' }, () => {
      fetchTenantFromSupabase();
    })
    .subscribe();
});

// Helper Status Class Marker Tenant
function getStatusClass(status, validasi) {
  const v = String(validasi || '').trim().toLowerCase();
  if (v === 'tutup') return 'status-hilang';

  if (!status) return 'status-hilang';
  const s = String(status).trim().toLowerCase();
  if (s.includes('sewa')) return 'status-sewa';
  if (s.includes('kosong')) return 'status-kosong';
  if (s.includes('terjual')) return 'status-terjual';
  if (s.includes('fasum')) return 'status-fasum';
  return 'status-hilang';
}

// ==========================================
// FETCH DATA TENANT SUPABASE
// ==========================================
async function fetchTenantFromSupabase() {
  try {
    const { data, error } = await supabaseClient
      .from('tenant')
      .select('no, lokasi, lantai, koordinat, status, validasi')
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
          console.warn(`Gagal parse koordinat Tenant #${item.no}`, item.koordinat);
        }
      }

      return {
        no: item.no,
        lokasi: item.lokasi || `Tenant ${item.no}`,
        lantai: (item.lantai || 'basement').toLowerCase().trim(),
        koordinat: parsedCoords,
        ukuran: (parsedCoords && parsedCoords.size) ? parseFloat(parsedCoords.size) : 38,
        status: item.status || '',
        validasi: item.validasi || ''
      };
    });

    if (activeCategory === 'tenant') {
      renderTenantList();
      renderTenantMarkers();
    }
  } catch (err) {
    console.error("Gagal mengambil data tenant:", err);
  }
}

async function saveTenantCoordinate(noTenant, xPercent, yPercent) {
  if (appMode !== 'edit' || !isSuperAdmin()) return;

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
  renderTenantMarkers();

  try {
    const { error } = await supabaseClient
      .from('tenant')
      .update({ koordinat: coordPayload })
      .eq('no', noTenant);

    if (error) throw error;
  } catch (err) {
    alert(`Gagal menyimpan koordinat tenant: ${err.message}`);
    fetchTenantFromSupabase();
  }
}

// ==========================================
// RENDER SIDEBAR LIST & MARKER
// ==========================================
function renderTenantList() {
  if (activeCategory !== 'tenant') return;

  const container = document.getElementById('sidebar-list-container');
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

  const countEl = document.getElementById('floor-count');
  const plottedEl = document.getElementById('plotted-count');
  if (countEl) countEl.innerText = floorTenants.length;
  if (plottedEl) plottedEl.innerText = floorTenants.filter(t => t.koordinat !== null).length;

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
            <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title="${escapeHtml(t.lokasi)}">${escapeHtml(t.lokasi)}</span>
          </div>
        </div>

        <div class="flex items-center space-x-1 shrink-0" onclick="event.stopPropagation()">
          ${hasCoords ? `
            ${allowEdit ? `
              <button onclick="startPlacement(${t.no})" title="Pindahkan Titik" class="p-1 text-slate-400 hover:text-blue-600 rounded transition cursor-pointer">
                <i class="fa-solid fa-arrows-rotate text-xs"></i>
              </button>
              <button onclick="openModal('edit', ${t.no})" title="Edit Ukuran Marker" class="p-1 text-slate-400 hover:text-blue-600 rounded transition cursor-pointer">
                <i class="fa-solid fa-pen text-xs"></i>
              </button>
              <button onclick="deleteTenantCoordinate(${t.no})" title="Hapus Titik" class="p-1 text-slate-400 hover:text-red-500 rounded transition cursor-pointer">
                <i class="fa-solid fa-trash-can text-xs"></i>
              </button>
            ` : ''}
          ` : `
            ${allowEdit ? `
              <button onclick="startPlacement(${t.no})" class="text-[11px] bg-[#1a73e8] text-white px-2 py-0.5 rounded flex items-center gap-1 font-semibold shadow-xs transition cursor-pointer">
                <i class="fa-solid fa-plus text-[10px]"></i> Plot
              </button>
            ` : ''}
          `}
        </div>
      </div>
    `;
  }).join('');
}

function renderTenantMarkers() {
  const container = document.getElementById('marker-tenant-layer');
  if (!container) return;
  container.innerHTML = '';

  if (activeCategory !== 'tenant') return;

  const floorTenants = tenantsData.filter(t => t.lantai === currentFloor);

  floorTenants.forEach(t => {
    if (!t.koordinat || t.koordinat.x == null || t.koordinat.y == null) return;

    const isSelected = selectedTenantNo === t.no;
    const markerSize = t.ukuran || 38;
    const statusClass = getStatusClass(t.status, t.validasi);

    const marker = document.createElement('div');
    marker.className = `circle-marker ${statusClass} ${isSelected ? 'active-selected' : ''}`;
    marker.style.left = `${t.koordinat.x}%`;
    marker.style.top = `${t.koordinat.y}%`;
    marker.style.width = `${markerSize}px`;
    marker.style.height = `${markerSize}px`;

    marker.innerHTML = `<div class="marker-tooltip">${escapeHtml(t.lokasi)}</div>`;

    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      selectTenant(t.no);
    });

    if (appMode === 'edit' && isSuperAdmin()) {
      marker.addEventListener('mousedown', (e) => startDraggingTenantMarker(e, t.no));
    }

    container.appendChild(marker);
  });
}

// ==========================================
// SELEKSI & PLOTTING ACTION TENANT
// ==========================================
function selectTenant(no) {
  selectedTenantNo = no;
  renderTenantList();
  renderTenantMarkers();

  const tenant = tenantsData.find(t => t.no === no);
  if (tenant) {
    if (tenant.lantai !== currentFloor) switchFloor(tenant.lantai);

    if (tenant.koordinat && tenant.koordinat.x != null) {
      // Panggil fungsi penampil pop up detail dari mapb.js
      if (typeof showTenantDetailPopup === 'function') {
        showTenantDetailPopup(no);
      }
    } else {
      closeFloatingCard();
    }
  }
}

function startPlacement(no) {
  if (appMode !== 'edit' || !isSuperAdmin()) return;
  
  selectedTenantNo = no;
  isPlacingMode = true;
  
  const t = tenantsData.find(item => item.no === no);
  const targetName = document.getElementById('target-tenant-name');
  const actionBar = document.getElementById('active-action-bar');
  const viewport = document.getElementById('viewport');

  if (targetName) targetName.innerText = t ? t.lokasi : `#${no}`;
  if (actionBar) {
    actionBar.classList.remove('hidden');
    actionBar.classList.add('flex');
  }
  if (viewport) viewport.classList.add('placing-mode');
  
  renderTenantList();
  renderTenantMarkers();
}

function startDraggingTenantMarker(event, no) {
  if (event.button !== 0 || isPlacingMode || appMode !== 'edit' || !isSuperAdmin()) return;
  event.stopPropagation();
  selectTenant(no);

  const img = document.getElementById('denah-img');
  if (!img) return;
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
      renderTenantMarkers();
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

    saveTenantCoordinate(no, x, y);
    
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function deleteTenantCoordinate(no) {
  if (appMode !== 'edit' || !isSuperAdmin()) return;
  if (confirm(`Hapus titik lokasi untuk tenant #${no}?`)) {
    saveTenantCoordinate(no, null, null);
    closeFloatingCard();
  }
}

// ==========================================
// MODAL MANAGEMENT & FORM (EDIT SIZE)
// ==========================================
function openModal(mode, no = null) {
  if (!isSuperAdmin()) return;

  const modal = document.getElementById('modal');
  const form = document.getElementById('tenantForm');
  if (form) form.reset();

  const editNoEl = document.getElementById('editNo');
  if (editNoEl) editNoEl.value = no || '';

  if (mode === 'edit' && no) {
    const tenant = tenantsData.find(t => t.no === no);
    if (!tenant) return;

    document.getElementById('inputLokasi').value = tenant.lokasi || '';
    document.getElementById('inputLantai').value = tenant.lantai || currentFloor;
    document.getElementById('inputUkuran').value = tenant.ukuran || 38;
  }

  if (modal) modal.classList.remove('hidden');
}

function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.classList.add('hidden');
}

async function saveTenantData(e) {
  e.preventDefault();
  if (!isSuperAdmin()) return;

  const editNo = document.getElementById('editNo').value;
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
        .update({ koordinat: currentCoord ? JSON.stringify(currentCoord) : null })
        .eq('no', editNo);

      if (error) throw error;
    }

    closeModal();
    fetchTenantFromSupabase();
  } catch (err) {
    alert('Gagal menyimpan ukuran marker tenant: ' + err.message);
  }
}