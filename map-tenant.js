// ==========================================
// MAP-TENANT.JS - MODUL LOGIKA TENANT & POPUP
// ==========================================

let tenantsData = [];
let selectedTenantNo = null;

document.addEventListener('DOMContentLoaded', () => {
  fetchTenantFromSupabase();

  // Realtime Listener Supabase
  supabaseClient
    .channel('public:tenant-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tenant' }, () => {
      if (typeof activeBuilding !== 'undefined' && activeBuilding === 'pbc') {
        fetchTenantFromSupabase();
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tenant_pbm' }, () => {
      if (typeof activeBuilding !== 'undefined' && activeBuilding === 'pbm') {
        fetchTenantFromSupabase();
      }
    })
    .subscribe();
});

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeFloorName(floorStr) {
  if (!floorStr) return 'basement';
  const f = String(floorStr).trim().toLowerCase();
  if (f === 'lb' || f.includes('basement') || f === 'b') return 'basement';
  if (f === 'ld' || f.includes('ground') || f.includes('dasar') || f === 'g') return 'dasar';
  if (f.includes('1') || f === 'satu') return 'satu';
  if (f.includes('2') || f === 'dua') return 'dua';
  if (f.includes('roof') || f === 'r') return 'rooftop';
  return f;
}

function closeFloatingCard() {
  const floatingCard = document.getElementById('floating-detail-card');
  if (floatingCard) {
    floatingCard.classList.add('translate-x-[120%]', 'opacity-0', 'pointer-events-none');
    floatingCard.classList.remove('translate-x-0', 'opacity-100', 'pointer-events-auto');
  }
}

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

function getTenantTableName() {
  return (typeof activeBuilding !== 'undefined' && activeBuilding === 'pbm') ? 'tenant_pbm' : 'tenant';
}

// ==========================================
// FETCH DATA TENANT SUPABASE
// ==========================================
async function fetchTenantFromSupabase() {
  const tableName = getTenantTableName();

  try {
    const { data, error } = await supabaseClient
      .from(tableName)
      .select('no, lokasi, lantai, koordinat, status, validasi, penyewa, nama_toko, update')
      .order('no', { ascending: true });

    if (error) throw error;

    tenantsData = (data || []).map(item => {
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

      const rawFloor = (parsedCoords && parsedCoords.floor) ? parsedCoords.floor : item.lantai;

      return {
        no: item.no,
        lokasi: item.lokasi || `Tenant ${item.no}`,
        penyewa: item.penyewa || '',
        nama_toko: item.nama_toko || '',
        update: item.update || '-',
        lantai: normalizeFloorName(rawFloor),
        koordinat: parsedCoords,
        ukuran: (parsedCoords && parsedCoords.size) ? parseFloat(parsedCoords.size) : 38,
        status: item.status || '',
        validasi: item.validasi || ''
      };
    });

  } catch (err) {
    console.warn(`[Info] Tabel '${tableName}' belum dapat diakses:`, err.message);
    tenantsData = [];
  }

  if (typeof calculateTenantCounts === 'function') calculateTenantCounts();

  if (typeof activeCategory !== 'undefined' && activeCategory === 'tenant') {
    renderTenantList();
    renderTenantMarkers();
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
        size: currentSize,
        floor: currentFloor
      })
    : null;

  if (target) {
    target.koordinat = coordPayload ? JSON.parse(coordPayload) : null;
  }
  
  if (typeof calculateTenantCounts === 'function') calculateTenantCounts();
  renderTenantList();
  renderTenantMarkers();

  try {
    const tableName = getTenantTableName();
    const { error } = await supabaseClient
      .from(tableName)
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
  if (typeof activeCategory !== 'undefined' && activeCategory !== 'tenant') return;

  const container = document.getElementById('sidebar-list-container');
  if (!container) return;

  const searchInput = document.getElementById('globalSearchInput');
  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let floorTenants = tenantsData.filter(t => t.lantai === currentFloor);

  let filtered = floorTenants.filter(t => {
    const matchSearch = t.lokasi.toLowerCase().includes(searchVal) || 
                        t.penyewa.toLowerCase().includes(searchVal) || 
                        t.nama_toko.toLowerCase().includes(searchVal) ||
                        String(t.no).includes(searchVal);

    if (typeof activeFilter !== 'undefined' && activeFilter === 'plotted') return matchSearch && t.koordinat !== null;
    if (typeof activeFilter !== 'undefined' && activeFilter === 'unplotted') return matchSearch && t.koordinat === null;
    return matchSearch;
  });

  const countEl = document.getElementById('floor-count');
  const plottedEl = document.getElementById('plotted-count');
  if (countEl) countEl.innerText = floorTenants.length;
  if (plottedEl) plottedEl.innerText = floorTenants.filter(t => t.koordinat !== null).length;

  if (filtered.length === 0) {
    const bName = (typeof activeBuilding !== 'undefined') ? activeBuilding.toUpperCase() : 'PBC';
    container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">Belum ada data tenant (${bName}).</div>`;
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
          ${t.penyewa ? `<div class="text-[10px] text-blue-600 dark:text-blue-400 font-medium pl-6 truncate">${escapeHtml(t.penyewa)}</div>` : ''}
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

  if (typeof activeCategory !== 'undefined' && activeCategory !== 'tenant') return;

  const searchInput = document.getElementById('globalSearchInput');
  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const floorTenants = tenantsData.filter(t => t.lantai === currentFloor);

  floorTenants.forEach(t => {
    if (!t.koordinat || t.koordinat.x == null || t.koordinat.y == null) return;

    const isSelected = selectedTenantNo === t.no;
    const markerSize = t.ukuran || 38;
    const statusClass = getStatusClass(t.status, t.validasi);

    const isMatch = !searchVal || 
                    t.lokasi.toLowerCase().includes(searchVal) || 
                    t.penyewa.toLowerCase().includes(searchVal) || 
                    t.nama_toko.toLowerCase().includes(searchVal) ||
                    String(t.no).includes(searchVal);

    const marker = document.createElement('div');
    marker.className = `circle-marker ${statusClass} ${isSelected ? 'active-selected' : ''} ${!isMatch ? 'is-filtered-out' : ''}`;
    marker.style.left = `${t.koordinat.x}%`;
    marker.style.top = `${t.koordinat.y}%`;
    marker.style.width = `${markerSize}px`;
    marker.style.height = `${markerSize}px`;

    const tooltipText = t.penyewa ? `${t.lokasi} (${t.penyewa})` : t.lokasi;
    marker.innerHTML = `<div class="marker-tooltip">${escapeHtml(tooltipText)}</div>`;

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

function selectTenant(no) {
  selectedTenantNo = no;

  const tenant = tenantsData.find(t => t.no === no);
  if (tenant) {
    if (tenant.lantai !== currentFloor) {
      switchFloor(tenant.lantai);
    } else {
      renderTenantList();
      renderTenantMarkers();
    }

    if (tenant.koordinat && tenant.koordinat.x != null) {
      showTenantDetailPopup(no);
    } else {
      closeFloatingCard();
    }
  }
}

async function showTenantDetailPopup(noTenant) {
  if (!noTenant) return;

  const floatingCard = document.getElementById('floating-detail-card');
  const contentContainer = document.getElementById('floating-detail-content');

  if (!floatingCard || !contentContainer) return;

  floatingCard.style.maxWidth = 'none';
  contentContainer.style.maxWidth = 'none';

  contentContainer.innerHTML = `
    <div class="p-4 text-center text-slate-500 dark:text-slate-400">
      <i class="fa-solid fa-circle-notch fa-spin text-lg text-blue-500 mb-1"></i>
      <p class="text-xs">Memuat detail lokasi...</p>
    </div>
  `;

  floatingCard.classList.remove('translate-x-[120%]', 'opacity-0', 'pointer-events-none');
  floatingCard.classList.add('translate-x-0', 'opacity-100', 'pointer-events-auto');

  try {
    const tableName = getTenantTableName();
    const { data, error } = await supabaseClient
      .from(tableName)
      .select('no, lokasi, lantai, luas, tipe, penyewa, status, komoditi, cp, validasi, nama_toko, update')
      .eq('no', noTenant)
      .single();

    if (error) throw error;

    if (!data) {
      contentContainer.innerHTML = `<div class="p-2 text-xs text-red-500">Data detail tidak ditemukan.</div>`;
      return;
    }

    const statusText = (data.status || '-').trim();
    const statusLower = statusText.toLowerCase();

    let statusColor = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
    if (statusLower.includes('sewa')) {
      statusColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    } else if (statusLower.includes('kosong')) {
      statusColor = 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30';
    } else if (statusLower.includes('terjual')) {
      statusColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    } else if (statusLower.includes('fasum')) {
      statusColor = 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30';
    }

    const personLabel = statusLower.includes('terjual') ? 'Pemilik' : 'Penyewa';
    const bName = (typeof activeBuilding !== 'undefined') ? activeBuilding.toUpperCase() : 'PBC';

    contentContainer.innerHTML = `
      <div class="flex items-start justify-between border-b border-slate-200 dark:border-zinc-800 pb-2 mb-3">
        <div class="pr-2 min-w-0 flex-1">
          <span class="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
            Gedung ${bName} • Lantai ${escapeHtml(data.lantai || '-')} • #${data.no}
          </span>
          <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug mt-0.5" style="white-space: normal !important; word-break: break-word !important; text-overflow: clip !important;">
            ${escapeHtml(data.lokasi || 'Tanpa Nama')}
          </h3>
        </div>
        <button onclick="closeFloatingCard()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full text-xs transition cursor-pointer shrink-0">
          ✕
        </button>
      </div>

      <div class="max-h-[60vh] sm:max-h-[70vh] overflow-y-auto custom-scroll pr-1">
        <table style="width: 100%; border-collapse: collapse; table-layout: fixed;" class="text-xs text-slate-700 dark:text-slate-300">
          <tbody>
            <tr>
              <td style="padding: 5px 0; width: 30%; font-weight: 500; vertical-align: top;" class="text-slate-400 dark:text-slate-400">Status</td>
              <td style="padding: 5px 0; width: 70%; text-align: right; vertical-align: top;">
                <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor} inline-block">
                  ${escapeHtml(statusText)}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding: 5px 0; font-weight: 500; vertical-align: top;" class="text-slate-400 dark:text-slate-400">Toko</td>
              <td style="padding: 5px 0; text-align: right; font-weight: 600; vertical-align: top; white-space: normal !important; word-break: break-word !important;" class="text-slate-800 dark:text-slate-100">
                ${escapeHtml(data.nama_toko || '-')}
              </td>
            </tr>
            <tr>
              <td style="padding: 5px 0; font-weight: 500; vertical-align: top;" class="text-slate-400 dark:text-slate-400">${personLabel}</td>
              <td style="padding: 5px 0; text-align: right; font-weight: 600; vertical-align: top; white-space: normal !important; word-break: break-word !important;" class="text-slate-800 dark:text-slate-100">
                ${escapeHtml(data.penyewa || '-')}
              </td>
            </tr>
            <tr>
              <td style="padding: 5px 0; font-weight: 500; vertical-align: top;" class="text-slate-400 dark:text-slate-400">Tipe</td>
              <td style="padding: 5px 0; text-align: right; font-weight: 600; vertical-align: top;" class="text-slate-800 dark:text-slate-100">
                ${escapeHtml(data.tipe || '-')}
              </td>
            </tr>
            <tr>
              <td style="padding: 5px 0; font-weight: 500; vertical-align: top;" class="text-slate-400 dark:text-slate-400">Luas Area</td>
              <td style="padding: 5px 0; text-align: right; font-weight: 600; vertical-align: top;" class="text-slate-800 dark:text-slate-100">
                ${escapeHtml(data.luas ? data.luas + ' m²' : '-')}
              </td>
            </tr>
            <tr>
              <td style="padding: 5px 0; font-weight: 500; vertical-align: top;" class="text-slate-400 dark:text-slate-400">Komoditi</td>
              <td style="padding: 5px 0; text-align: right; font-weight: 600; vertical-align: top;" class="text-slate-800 dark:text-slate-100">
                ${escapeHtml(data.komoditi || '-')}
              </td>
            </tr>
            <tr>
              <td style="padding: 5px 0; font-weight: 500; vertical-align: top;" class="text-slate-400 dark:text-slate-400">CP</td>
              <td style="padding: 5px 0; text-align: right; font-weight: 600; vertical-align: top;" class="text-slate-800 dark:text-slate-100">
                ${escapeHtml(data.cp || '-')}
              </td>
            </tr>
            <tr>
              <td style="padding: 5px 0; font-weight: 500; vertical-align: top;" class="text-slate-400 dark:text-slate-400">Validasi</td>
              <td style="padding: 5px 0; text-align: right; font-weight: 600; vertical-align: top;" class="text-slate-800 dark:text-slate-100">
                ${escapeHtml(data.validasi || '-')}
              </td>
            </tr>
            <tr>
              <td style="padding: 5px 0; font-weight: 500; vertical-align: top;" class="text-slate-400 dark:text-slate-400">Update</td>
              <td style="padding: 5px 0; text-align: right; font-family: monospace; font-size: 11px; vertical-align: top;" class="text-slate-500 dark:text-slate-400">
                ${escapeHtml(data.update || '-')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

  } catch (err) {
    console.error("Gagal mengambil detail tenant:", err);
    contentContainer.innerHTML = `<div class="p-2 text-xs text-red-500">Gagal memuat informasi tenant.</div>`;
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
        size: target.ukuran || 38,
        floor: currentFloor
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

      const tableName = getTenantTableName();
      const { error } = await supabaseClient
        .from(tableName)
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