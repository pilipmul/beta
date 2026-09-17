// ==========================================
// MAP-HSE.JS - MODUL LOGIKA HSE (FIXED)
// ==========================================

let hseData = [];
let selectedHSENo = null;

// Konfigurasi Visual Ikon & Warna Berdasarkan Jenis Alat
const HSE_CONFIG = {
  cctv: { icon: 'fa-video', bgColor: 'bg-indigo-600 dark:bg-indigo-500', label: 'CCTV' },
  apar: { icon: 'fa-fire-extinguisher', bgColor: 'bg-red-600 dark:bg-red-500', label: 'APAR' },
  hydrant: { icon: 'fa-faucet-drip', bgColor: 'bg-blue-600 dark:bg-blue-500', label: 'Hydrant' },
  bak_kontrol: { icon: 'fa-square-poll-vertical', bgColor: 'bg-amber-600 dark:bg-amber-500', label: 'Bak Kontrol' },
  pin_guardtour: { icon: 'fa-location-dot', bgColor: 'bg-emerald-600 dark:bg-emerald-500', label: 'Guard Tour' }
};

document.addEventListener('DOMContentLoaded', () => {
  fetchHSEFromSupabase();

  // Realtime Listener ke Tabel "hse"
  supabaseClient
    .channel('public:hse')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hse' }, () => {
      fetchHSEFromSupabase();
    })
    .subscribe();
});

function getHSEVisualConfig(jenis) {
  if (!jenis) return { icon: 'fa-shield-halved', bgColor: 'bg-slate-600', label: 'HSE' };
  
  const key = String(jenis).trim().toLowerCase().replace(/\s+/g, '_');
  
  if (key.includes('cctv')) return HSE_CONFIG.cctv;
  if (key.includes('apar')) return HSE_CONFIG.apar;
  if (key.includes('hydrant')) return HSE_CONFIG.hydrant;
  if (key.includes('bak') || key.includes('kontrol')) return HSE_CONFIG.bak_kontrol;
  if (key.includes('guard') || key.includes('tour') || key.includes('pin')) return HSE_CONFIG.pin_guardtour;

  return HSE_CONFIG[key] || { 
    icon: 'fa-shield-halved', 
    bgColor: 'bg-slate-600 dark:bg-slate-500', 
    label: jenis 
  };
}

// ==========================================
// FETCH DATA HSE FROM SUPABASE (TABEL: "hse")
// ==========================================
async function fetchHSEFromSupabase() {
  try {
    const { data, error } = await supabaseClient
      .from('hse')
      .select('*')
      .order('no', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      hseData = [];
      if (typeof activeCategory !== 'undefined' && activeCategory === 'hse') renderHSEList();
      return;
    }

    hseData = data.map(item => {
      let parsedCoords = null;
      if (item.koordinat) {
        try {
          parsedCoords = typeof item.koordinat === 'string' 
            ? JSON.parse(item.koordinat) 
            : item.koordinat;
        } catch (e) {
          console.warn(`Gagal parse koordinat HSE #${item.no}`, item.koordinat);
        }
      }

      return {
        no: item.no,
        tipe: item.tipe || '-',
        lokasi: item.lokasi || '-',
        kondisi: item.kondisi || '-',
        keterangan: item.keterangan || '-',
        update: item.update || '-',
        dokumentasi: item.dokumentasi || '',
        jenis: item.jenis || '-',
        lantai: (parsedCoords && parsedCoords.floor) ? parsedCoords.floor : (typeof currentFloor !== 'undefined' ? currentFloor : 'basement'),
        koordinat: parsedCoords,
        ukuran: (parsedCoords && parsedCoords.size) ? parseFloat(parsedCoords.size) : 32
      };
    });

    if (typeof activeCategory !== 'undefined' && activeCategory === 'hse') {
      renderHSEList();
      renderHSEMarkers();
    }
  } catch (err) {
    console.error("Gagal mengambil data dari tabel hse:", err);
  }
}

async function saveHSECoordinate(noHSE, xPercent, yPercent) {
  if (appMode !== 'edit' || !isSuperAdmin()) return;

  const target = hseData.find(h => h.no === noHSE);
  const currentSize = target ? target.ukuran : 32;

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
    target.lantai = currentFloor;
  }
  
  renderHSEList();
  renderHSEMarkers();

  try {
    const { error } = await supabaseClient
      .from('hse')
      .update({ koordinat: coordPayload })
      .eq('no', noHSE);

    if (error) throw error;
  } catch (err) {
    alert(`Gagal menyimpan koordinat HSE: ${err.message}`);
    fetchHSEFromSupabase();
  }
}

function renderHSEList() {
  if (typeof activeCategory !== 'undefined' && activeCategory !== 'hse') return;

  const container = document.getElementById('sidebar-list-container');
  if (!container) return;

  const searchInput = document.getElementById('globalSearchInput');
  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filtered = hseData.filter(h => {
    const displayText = `${h.jenis} ${h.tipe} ${h.lokasi}`.toLowerCase();
    const matchSearch = displayText.includes(searchVal) || String(h.no).includes(searchVal);

    if (typeof activeFilter !== 'undefined' && activeFilter === 'plotted') return matchSearch && h.koordinat !== null;
    if (typeof activeFilter !== 'undefined' && activeFilter === 'unplotted') return matchSearch && h.koordinat === null;
    return matchSearch;
  });

  const countEl = document.getElementById('floor-count');
  const plottedEl = document.getElementById('plotted-count');
  if (countEl) countEl.innerText = hseData.length;
  if (plottedEl) plottedEl.innerText = hseData.filter(h => h.koordinat !== null).length;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">Tidak ada data HSE.</div>`;
    return;
  }

  const allowEdit = isSuperAdmin();

  container.innerHTML = filtered.map(h => {
    const hasCoords = h.koordinat !== null;
    const isSelected = selectedHSENo === h.no;
    const config = getHSEVisualConfig(h.jenis);
    const displayText = `${h.jenis} ${h.tipe} ${h.lokasi}`;

    return `
      <div class="p-2.5 flex items-center justify-between transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800 ${isSelected ? 'bg-emerald-50 dark:bg-emerald-900/30 border-l-4 border-emerald-500' : ''}"
           onclick="selectHSE(${h.no})">
        <div class="flex-1 pr-2 min-w-0">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-md ${config.bgColor} text-white flex items-center justify-center text-[11px] shrink-0 shadow-xs">
              <i class="fa-solid ${config.icon}"></i>
            </div>
            <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title="${escapeHtml(displayText)}">
              ${escapeHtml(displayText)}
            </span>
          </div>
        </div>

        <div class="flex items-center space-x-1 shrink-0" onclick="event.stopPropagation()">
          ${hasCoords ? `
            ${allowEdit ? `
              <button onclick="startHSEPlacement(${h.no})" title="Pindahkan Titik" class="p-1 text-slate-400 hover:text-emerald-600 rounded transition cursor-pointer">
                <i class="fa-solid fa-arrows-rotate text-xs"></i>
              </button>
              <button onclick="deleteHSECoordinate(${h.no})" title="Hapus Titik" class="p-1 text-slate-400 hover:text-red-500 rounded transition cursor-pointer">
                <i class="fa-solid fa-trash-can text-xs"></i>
              </button>
            ` : ''}
          ` : `
            ${allowEdit ? `
              <button onclick="startHSEPlacement(${h.no})" class="text-[11px] bg-emerald-600 text-white px-2 py-0.5 rounded flex items-center gap-1 font-semibold shadow-xs transition cursor-pointer">
                <i class="fa-solid fa-plus text-[10px]"></i> Plot
              </button>
            ` : ''}
          `}
        </div>
      </div>
    `;
  }).join('');
}

function renderHSEMarkers() {
  const container = document.getElementById('marker-hse-layer');
  if (!container) return;
  container.innerHTML = '';

  if (typeof activeCategory !== 'undefined' && activeCategory !== 'hse') return;

  const floorHSE = hseData.filter(h => h.koordinat && h.koordinat.floor === currentFloor);

  floorHSE.forEach(h => {
    if (!h.koordinat || h.koordinat.x == null || h.koordinat.y == null) return;

    const isSelected = selectedHSENo === h.no;
    const markerSize = h.ukuran || 32;
    const config = getHSEVisualConfig(h.jenis);

    const marker = document.createElement('div');
    marker.className = `hse-marker absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer transition-all ${config.bgColor} ${isSelected ? 'ring-4 ring-white shadow-xl scale-110 z-30' : 'hover:scale-115 z-20'}`;
    marker.style.left = `${h.koordinat.x}%`;
    marker.style.top = `${h.koordinat.y}%`;
    marker.style.width = `${markerSize}px`;
    marker.style.height = `${markerSize}px`;

    marker.innerHTML = `
      <i class="fa-solid ${config.icon} text-xs pointer-events-none"></i>
      <div class="marker-tooltip">[${escapeHtml(h.jenis)}] ${escapeHtml(h.lokasi)}</div>
    `;

    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      selectHSE(h.no);
    });

    if (appMode === 'edit' && isSuperAdmin()) {
      marker.addEventListener('mousedown', (e) => startDraggingHSEMarker(e, h.no));
    }

    container.appendChild(marker);
  });
}

// ==========================================
// SELEKSI, PLOTTING & POPUP HSE
// ==========================================
function selectHSE(no) {
  selectedHSENo = no;
  renderHSEList();
  renderHSEMarkers();

  const hseItem = hseData.find(h => h.no === no);
  if (hseItem) {
    if (hseItem.koordinat && hseItem.koordinat.floor && hseItem.koordinat.floor !== currentFloor) {
      switchFloor(hseItem.koordinat.floor);
    }

    if (hseItem.koordinat && hseItem.koordinat.x != null) {
      showHSEDetailPopup(no);
    } else {
      closeFloatingCard();
    }
  }
}

/**
 * Mengambil detail lengkap item HSE dari Supabase / State dan menampilkan pop-up
 */
async function showHSEDetailPopup(noHSE) {
  const floatingCard = document.getElementById('floating-detail-card');
  const contentContainer = document.getElementById('floating-detail-content');
  if (!floatingCard || !contentContainer) return;

  let item = hseData.find(h => h.no === noHSE);

  if (!item) {
    try {
      const { data, error } = await supabaseClient
        .from('hse')
        .select('*')
        .eq('no', noHSE)
        .single();

      if (error) throw error;
      item = data;
    } catch (err) {
      console.error("Gagal mengambil detail HSE:", err);
      contentContainer.innerHTML = `<div class="p-2 text-xs text-red-500">Gagal memuat detail HSE.</div>`;
      return;
    }
  }

  if (!item) return;

  const config = getHSEVisualConfig(item.jenis);
  const kondisiText = (item.kondisi || '-').trim();
  const kondisiLower = kondisiText.toLowerCase();

  let kondisiColor = 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
  if (kondisiLower.includes('baik') || kondisiLower.includes('ok') || kondisiLower.includes('normal')) {
    kondisiColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
  } else if (kondisiLower.includes('rusak') || kondisiLower.includes('buruk') || kondisiLower.includes('bahaya')) {
    kondisiColor = 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30';
  } else if (kondisiLower.includes('perbaikan') || kondisiLower.includes('pending')) {
    kondisiColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
  }

  let docHtml = '-';
  if (item.dokumentasi) {
    const docStr = String(item.dokumentasi).trim();
    if (docStr.startsWith('http://') || docStr.startsWith('https://')) {
      docHtml = `<a href="${escapeHtml(docStr)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-medium">🔗 Lihat Dokumen</a>`;
    } else {
      docHtml = escapeHtml(docStr);
    }
  }

  contentContainer.innerHTML = `
    <!-- Header Popup HSE dengan Nomor di Header -->
    <div class="flex items-start justify-between border-b border-slate-200 dark:border-zinc-800 pb-2 mb-3">
      <div class="pr-2 min-w-0">
        <div class="flex items-center gap-1.5 mb-1">
          <span class="px-2 py-0.5 text-[10px] font-bold rounded text-white ${config.bgColor}">
            ${escapeHtml(item.jenis || 'HSE')}
          </span>
          <span class="text-[11px] font-mono font-bold text-emerald-500">
            #${item.no}
          </span>
        </div>
        <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug truncate" title="${escapeHtml(item.lokasi || item.tipe || 'Detail HSE')}">
          ${escapeHtml(item.lokasi || item.tipe || 'Detail HSE')}
        </h3>
      </div>
      <button onclick="closeFloatingCard()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full text-xs transition cursor-pointer">
        ✕
      </button>
    </div>

    <!-- Detail Informasi Tabel HSE -->
    <div class="space-y-2 text-xs text-slate-700 dark:text-slate-300 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto custom-scroll pr-1">
      <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
        <span class="text-slate-400 font-medium">Jenis</span>
        <span class="font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(item.jenis || '-')}</span>
      </div>

      <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
        <span class="text-slate-400 font-medium">Tipe</span>
        <span class="font-medium text-slate-800 dark:text-slate-200">${escapeHtml(item.tipe || '-')}</span>
      </div>

      <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
        <span class="text-slate-400 font-medium">Lokasi</span>
        <span class="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title="${escapeHtml(item.lokasi || '-')}">${escapeHtml(item.lokasi || '-')}</span>
      </div>

      <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
        <span class="text-slate-400 font-medium">Kondisi</span>
        <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold border ${kondisiColor}">
          ${escapeHtml(kondisiText)}
        </span>
      </div>

      <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
        <span class="text-slate-400 font-medium">Keterangan</span>
        <span class="font-medium text-slate-800 dark:text-slate-200 break-words max-w-[150px] text-right" title="${escapeHtml(item.keterangan || '-')}">${escapeHtml(item.keterangan || '-')}</span>
      </div>

      <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
        <span class="text-slate-400 font-medium">Terakhir Update</span>
        <span class="font-mono text-[11px] text-slate-600 dark:text-slate-400">${escapeHtml(item.update || '-')}</span>
      </div>

      <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
        <span class="text-slate-400 font-medium">Dokumentasi</span>
        <span class="font-medium">${docHtml}</span>
      </div>
    </div>
  `;

  floatingCard.classList.remove('translate-x-[120%]', 'opacity-0', 'pointer-events-none');
  floatingCard.classList.add('translate-x-0', 'opacity-100', 'pointer-events-auto');
}

function startHSEPlacement(no) {
  if (appMode !== 'edit' || !isSuperAdmin()) return;
  
  selectedHSENo = no;
  isPlacingMode = true;
  
  const h = hseData.find(item => item.no === no);
  const targetName = document.getElementById('target-tenant-name');
  const actionBar = document.getElementById('active-action-bar');
  const viewport = document.getElementById('viewport');

  if (targetName) targetName.innerText = h ? `${h.jenis} - ${h.lokasi}` : `#${no}`;
  if (actionBar) {
    actionBar.classList.remove('hidden');
    actionBar.classList.add('flex');
  }
  if (viewport) viewport.classList.add('placing-mode');
  
  renderHSEList();
  renderHSEMarkers();
}

function startDraggingHSEMarker(event, no) {
  if (event.button !== 0 || isPlacingMode || appMode !== 'edit' || !isSuperAdmin()) return;
  event.stopPropagation();
  selectHSE(no);

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

    const target = hseData.find(h => h.no === no);
    if (target) {
      target.koordinat = { 
        x: parseFloat(x.toFixed(2)), 
        y: parseFloat(y.toFixed(2)),
        size: target.ukuran || 32,
        floor: currentFloor
      };
      renderHSEMarkers();
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

    saveHSECoordinate(no, x, y);
    
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function deleteHSECoordinate(no) {
  if (appMode !== 'edit' || !isSuperAdmin()) return;
  if (confirm(`Hapus titik lokasi untuk HSE #${no}?`)) {
    saveHSECoordinate(no, null, null);
    closeFloatingCard();
  }
}
