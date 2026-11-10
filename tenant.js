// KONFIGURASI SUPABASE SAMA PERSIS DENGAN INVENTORY
const SUPABASE_URL = 'https://sfblelnbczlvykqemhtm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PAGE_SIZE = 200;
let currentPage = 1;
let totalRows = 0;
let rawDataMap = new Map();
let fetchedData = [];

// Penentuan Tabel Berdasarkan User BO
let currentSourceTable = 'tenant'; // Default 'tenant' (PBC)
let userBo = ''; // Store user BO ('pbc', 'pbm', 'tcbu')
let realtimeChannel = null;

// INSTANCE TABLE FILTER MANAGER
let tableFilter = null;

let globalSearchQuery = sessionStorage.getItem('tenant_globalSearchQuery') || '';
let sortConfig = JSON.parse(sessionStorage.getItem('tenant_sortConfig')) || { column: null, direction: null };

// Daftar akun yang memiliki hak akses CRUD (Create, Update, Delete)
const ALLOWED_EDITORS = ["Dede Hidayat", "Sutriono", "Herliana Oktavianti"];

function getuserData() {
  try {
    const session = localStorage.getItem("user");
    return session ? JSON.parse(session) : null;
  } catch (err) {
    console.error("Gagal membaca session user:", err);
    return null;
  }
}

function initUserBoAccess() {
  const userData = getuserData();
  if (userData && userData.bo) {
    userBo = String(userData.bo).toLowerCase();
  }

  // Set default tabel aktif berdasarkan hak akses BO
  if (userBo === 'pbm') {
    currentSourceTable = 'tenant_pbm';
  } else if (userBo === 'pbc') {
    currentSourceTable = 'tenant';
  } else {
    // Untuk 'tcbu' atau fallback
    currentSourceTable = sessionStorage.getItem('tenant_activeTable') || 'tenant';
  }
}

function isSuperAdmin() {
  const userData = getuserData();
  if (!userData) return false;

  const isEditor = ALLOWED_EDITORS.includes(userData.nama) || ALLOWED_EDITORS.includes(userData.username);
  return isEditor || userData.role === "Admin" || userData.role === "SuperAdmin";
}

function initTableFilter() {
  if (typeof TableFilterManager !== 'undefined') {
    tableFilter = new TableFilterManager({
      tableName: currentSourceTable,
      supabaseClient: _supabase,
      columns: ['no', 'lokasi', 'nama_toko', 'luas', 'tipe', 'penyewa', 'komoditi', 'status', 'cp', 'validasi', 'update'],
      dateColumns: ['update'],
      globalSearchQuery: globalSearchQuery,
      onFilterChange: () => {
        currentPage = 1;
        saveStateToSession();
        fetchTableData();
      }
    });

    try {
      const savedFilters = JSON.parse(sessionStorage.getItem('tenant_filterSelections'));
      if (savedFilters && typeof savedFilters === 'object') {
        Object.keys(savedFilters).forEach(key => {
          if (Array.isArray(savedFilters[key])) {
            tableFilter.filterSelections[key] = new Set(savedFilters[key]);
          }
        });
      }
    } catch {
      if (tableFilter) tableFilter.filterSelections = {};
    }
  }
}

function saveStateToSession() {
  sessionStorage.setItem('tenant_globalSearchQuery', globalSearchQuery);
  sessionStorage.setItem('tenant_sortConfig', JSON.stringify(sortConfig));
  sessionStorage.setItem('tenant_activeTable', currentSourceTable);

  if (tableFilter && tableFilter.filterSelections) {
    const serializableFilters = {};
    Object.keys(tableFilter.filterSelections).forEach(key => {
      if (tableFilter.filterSelections[key] && tableFilter.filterSelections[key].size > 0) {
        serializableFilters[key] = Array.from(tableFilter.filterSelections[key]);
      }
    });
    sessionStorage.setItem('tenant_filterSelections', JSON.stringify(serializableFilters));
  }
}

function toggleHamburgerMenu(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('customDropdownMenu');
  if (dropdown) dropdown.classList.toggle('hidden');
}

function switchTenantSource(targetTable) {
  if (currentSourceTable === targetTable) return;

  currentSourceTable = targetTable;
  currentPage = 1;
  saveStateToSession();

  // Re-initialize filter table & realtime listener
  if (tableFilter) {
    tableFilter.tableName = currentSourceTable;
    tableFilter.filterSelections = {};
  }
  
  setupRealtimeSubscription();
  fetchTableData();
  renderHamburgerMenuContent();
}

function renderHamburgerMenuContent() {
  const container = document.getElementById('custom-hamburger-content');
  if (!container) return;

  let html = '';

  // --- TOGGLE PBC & PBM BERDASARKAN BO ---
  html += `<div class="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#dadce0] dark:border-[#3c4043] bg-slate-50 dark:bg-[#1a1a1a]">Kategori Tenant</div>`;

  if (userBo === 'tcbu') {
    // Bisa beralih PBC dan PBM
    html += `
      <div class="p-1 flex gap-1 bg-[#f1f3f4] dark:bg-[#1e1e1e] mx-2 my-1.5 rounded-lg border border-[#dadce0] dark:border-[#3c4043]">
        <button onclick="switchTenantSource('tenant'); toggleHamburgerMenu();" 
                class="flex-1 py-1 px-2 text-center rounded-md font-semibold text-xs transition cursor-pointer ${currentSourceTable === 'tenant' ? 'bg-[#1a73e8] text-white shadow-sm' : 'text-[#5f6368] dark:text-[#bdc1c6] hover:bg-slate-200 dark:hover:bg-slate-700'}">
          PBC
        </button>
        <button onclick="switchTenantSource('tenant_pbm'); toggleHamburgerMenu();" 
                class="flex-1 py-1 px-2 text-center rounded-md font-semibold text-xs transition cursor-pointer ${currentSourceTable === 'tenant_pbm' ? 'bg-[#1a73e8] text-white shadow-sm' : 'text-[#5f6368] dark:text-[#bdc1c6] hover:bg-slate-200 dark:hover:bg-slate-700'}">
          PBM
        </button>
      </div>
    `;
  } else if (userBo === 'pbm') {
    // Hanya PBM
    html += `
      <div class="px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
        <span>Tipe: PBM</span>
        <span class="text-[10px] bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-500/30">Aktif</span>
      </div>
    `;
  } else {
    // Default PBC (termasuk userBo === 'pbc')
    html += `
      <div class="px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center justify-between">
        <span>Tipe: PBC</span>
        <span class="text-[10px] bg-blue-100 dark:bg-blue-950 px-1.5 py-0.5 rounded border border-blue-500/30">Aktif</span>
      </div>
    `;
  }

  html += `<div class="border-t border-[#dadce0] dark:border-[#3c4043] my-1"></div>`;

  // --- MENU CRUD & EXPORT ---
  if (isSuperAdmin()) {
    html += `
      <button onclick="openModal('add'); toggleHamburgerMenu();" class="w-full text-left px-3 py-2 text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] flex items-center gap-2.5 transition cursor-pointer">
        <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        <span>Tambah Data ${currentSourceTable === 'tenant_pbm' ? 'PBM' : 'PBC'}</span>
      </button>
    `;
  }

  html += `
    <button onclick="exportCSV(); toggleHamburgerMenu();" class="w-full text-left px-3 py-2 text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] flex items-center gap-2.5 transition cursor-pointer">
      <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
      <span>Export CSV</span>
    </button>
  `;

  container.innerHTML = html;
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

// Helper untuk mengambil nilai paling baru dari data array JSONB / string
function parseJsonbFirst(val) {
  if (!val) return '-';
  if (Array.isArray(val)) return val[0] || '-';
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed[0] || '-';
    } catch (e) {
      return val;
    }
  }
  return String(val);
}

function setupRealtimeSubscription() {
  if (realtimeChannel) {
    _supabase.removeChannel(realtimeChannel);
  }

  realtimeChannel = _supabase
    .channel(`public:${currentSourceTable}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: currentSourceTable }, () => {
      fetchTableData();
    })
    .subscribe();
}

document.addEventListener('DOMContentLoaded', () => {
  initUserBoAccess();
  initTableFilter();

  if (typeof renderHeader === 'function') {
    renderHeader({
      subtitle: "Tenant",
      hamburgerItems: []
    });
  }

  renderHamburgerMenuContent();

  if (globalSearchQuery) {
    const searchInput = document.getElementById('globalSearchInput');
    const btnClear = document.getElementById('btnClearSearch');
    if (searchInput) searchInput.value = globalSearchQuery;
    if (btnClear) btnClear.classList.remove('hidden');
  }

  fetchTableData();
  setupRealtimeSubscription();
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('#hamburgerBtn');
  const dropdown = document.getElementById('customDropdownMenu');

  if (btn) {
    e.stopPropagation();
    toggleHamburgerMenu(e);
    return;
  }

  if (dropdown && !dropdown.classList.contains('hidden') && !dropdown.contains(e.target)) {
    dropdown.classList.add('hidden');
  }

  const popover = document.getElementById('filterPopover');
  if (popover && !popover.classList.contains('hidden') && !popover.contains(e.target) && !e.target.closest('button[onclick*="toggleFilterMenu"]')) {
    closeFilterPopover();
  }
});

function triggerGlobalSearch() {
  const val = document.getElementById('globalSearchInput').value.trim();
  globalSearchQuery = val;
  if (tableFilter) tableFilter.globalSearchQuery = globalSearchQuery;
  currentPage = 1;
  document.getElementById('btnClearSearch').classList.toggle('hidden', val === '');
  saveStateToSession();
  fetchTableData();
}

function clearGlobalSearch() {
  document.getElementById('globalSearchInput').value = '';
  document.getElementById('btnClearSearch').classList.add('hidden');
  globalSearchQuery = '';
  if (tableFilter) tableFilter.globalSearchQuery = '';
  currentPage = 1;
  saveStateToSession();
  fetchTableData();
}

function updateFilterButtonStyles() {
  const allColumns = ['no', 'lokasi', 'nama_toko', 'luas', 'tipe', 'penyewa', 'komoditi', 'status', 'cp', 'validasi', 'update'];

  allColumns.forEach(col => {
    const btn = document.getElementById(`btn-filter-${col}`);
    if (!btn) return;

    const isActive = tableFilter && tableFilter.filterSelections && tableFilter.filterSelections[col] && tableFilter.filterSelections[col].size > 0;

    if (isActive) {
      btn.className = "p-0.5 text-[#1a73e8] dark:text-[#8ab4f8] cursor-pointer transition-transform duration-150 scale-140 inline-block";
      btn.innerHTML = `<svg class="w-2 h-2" viewBox="0 0 10 6"><polygon points="1,1 9,1 5,5" fill="currentColor" stroke="none"/></svg>`;
    } else {
      btn.className = "p-0.5 text-[#5f6368] dark:text-[#bdc1c6] hover:text-[#202124] dark:hover:text-white cursor-pointer transition-transform duration-150 scale-100 inline-block";
      btn.innerHTML = `<svg class="w-2 h-2" viewBox="0 0 10 6"><polygon points="1,1 9,1 5,5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
    }
  });
}

function applySupabaseFilters(query) {
  // Sync globalSearchQuery into tableFilter if available
  if (tableFilter) {
    tableFilter.globalSearchQuery = globalSearchQuery;
  }

  // Safe Supabase ILIKE filters for standard string columns only
  if (globalSearchQuery) {
    const rawTerm = globalSearchQuery.trim();
    const q = `%${rawTerm}%`;

    const searchConditions = [
      `lokasi.ilike.${q}`,
      `nama_toko.ilike.${q}`,
      `tipe.ilike.${q}`,
      `penyewa.ilike.${q}`,
      `status.ilike.${q}`,
      `komoditi.ilike.${q}`,
      `cp.ilike.${q}`
    ];

    // Safe query for numeric 'no' column without type mismatch
    if (!isNaN(rawTerm) && rawTerm !== '') {
      searchConditions.push(`no.eq.${parseInt(rawTerm, 10)}`);
    }

    query = query.or(searchConditions.join(','));
  }

  // Apply column-specific popover filters if tableFilter exists
  if (tableFilter && typeof tableFilter.applyToSupabaseQuery === 'function') {
    query = tableFilter.applyToSupabaseQuery(query, [
      'lokasi', 'nama_toko', 'tipe', 'penyewa', 'status', 'komoditi', 'cp'
    ]);
  }

  return query;
}

async function fetchTableData() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = `<tr><td colspan="11" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Memuat data ${currentSourceTable === 'tenant_pbm' ? 'PBM' : 'PBC'}...</td></tr>`;

  try {
    let dataQuery = _supabase.from(currentSourceTable).select('*');
    
    // Fetch base query filtered by search text
    if (!globalSearchQuery) {
      dataQuery = applySupabaseFilters(dataQuery);
    } else {
      // If searching, fetch all matching database records to perform safe all-column matching
      const rawTerm = globalSearchQuery.trim();
      const q = `%${rawTerm}%`;
      const conditions = [
        `lokasi.ilike.${q}`,
        `nama_toko.ilike.${q}`,
        `tipe.ilike.${q}`,
        `penyewa.ilike.${q}`,
        `status.ilike.${q}`,
        `komoditi.ilike.${q}`,
        `cp.ilike.${q}`
      ];
      if (!isNaN(rawTerm) && rawTerm !== '') {
        conditions.push(`no.eq.${parseInt(rawTerm, 10)}`);
      }
      dataQuery = dataQuery.or(conditions.join(','));
    }

    if (sortConfig.column && sortConfig.direction) {
      dataQuery = dataQuery.order(sortConfig.column, { ascending: sortConfig.direction === 'asc' });
    } else {
      dataQuery = dataQuery.order('no', { ascending: true });
    }

    const { data, error } = await dataQuery;
    if (error) throw error;

    let rows = data || [];

    // Complete all-column matching client-side (including 'luas', 'validasi', 'update', 'no')
    if (globalSearchQuery) {
      const term = globalSearchQuery.trim().toLowerCase();
      rows = rows.filter(row => {
        const noMatch = String(row.no || '').toLowerCase().includes(term);
        const lokasiMatch = String(row.lokasi || '').toLowerCase().includes(term);
        const tokoMatch = String(row.nama_toko || '').toLowerCase().includes(term);
        const luasMatch = String(row.luas || '').toLowerCase().includes(term);
        const tipeMatch = String(row.tipe || '').toLowerCase().includes(term);
        const penyewaMatch = String(row.penyewa || '').toLowerCase().includes(term);
        const statusMatch = String(row.status || '').toLowerCase().includes(term);
        const komoditiMatch = String(row.komoditi || '').toLowerCase().includes(term);
        const cpMatch = String(row.cp || '').toLowerCase().includes(term);
        const validasiMatch = String(parseJsonbFirst(row.validasi)).toLowerCase().includes(term);
        const updateMatch = String(parseJsonbFirst(row.update)).toLowerCase().includes(term);

        return noMatch || lokasiMatch || tokoMatch || luasMatch || tipeMatch || 
               penyewaMatch || statusMatch || komoditiMatch || cpMatch || 
               validasiMatch || updateMatch;
      });
    }

    totalRows = rows.length;
    document.getElementById('totalDataCount').innerText = totalRows;

    if (totalRows === 0) {
      tbody.innerHTML = `<tr><td colspan="11" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Data tenant (${currentSourceTable === 'tenant_pbm' ? 'PBM' : 'PBC'}) tidak ditemukan.</td></tr>`;
      updatePaginationUI();
      updateFilterButtonStyles();
      return;
    }

    const totalPages = Math.ceil(totalRows / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;

    const fromIndex = (currentPage - 1) * PAGE_SIZE;
    const toIndex = Math.min(currentPage * PAGE_SIZE, totalRows);

    fetchedData = rows.slice(fromIndex, toIndex);
    rawDataMap.clear();
    fetchedData.forEach(row => rawDataMap.set(row.no, row));

    renderTable();

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="11" class="p-6 text-center text-red-500 font-medium">Gagal memuat data dari Supabase.<br><span class="text-xs text-[#5f6368] dark:text-[#9aa0a6] font-normal">Error: ${err.message}</span></td></tr>`;
  }
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (fetchedData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Tidak ada data yang sesuai filter.</td></tr>`;
    updatePaginationUI();
    updateFilterButtonStyles();
    return;
  }

  const allowEdit = isSuperAdmin();

  fetchedData.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-[#f8f9fa] dark:hover:bg-[#252525] border-b border-[#f1f3f4] dark:border-[#2d2d2d] text-[#202124] dark:text-[#e8eaed] transition-colors group';

    const noContent = allowEdit 
      ? `<button onclick="openModalForNo(${row.no})" title="Edit Tenant #${row.no}" class="font-mono text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] group-hover:text-[#1a73e8] dark:group-hover:text-[#8ab4f8] transition-colors cursor-pointer select-none">${row.no}</button>`
      : `<span class="font-mono text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6]">${row.no}</span>`;

    const statusVal = String(row.status || '').toLowerCase();
    let statusBadgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    if (statusVal.includes('tersewa') || statusVal.includes('active') || statusVal.includes('isi') || statusVal.includes('sewa')) {
      statusBadgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500/20';
    } else if (statusVal.includes('vacant') || statusVal.includes('kosong')) {
      statusBadgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-500/20';
    }

    const currentValidasi = parseJsonbFirst(row.validasi);
    const currentUpdate = parseJsonbFirst(row.update);

    tr.innerHTML = `
      <td class="p-2.5 text-center">${noContent}</td>
      <td class="p-2.5 font-medium text-[#202124] dark:text-[#f1f3f4] break-words">${escapeHtml(row.lokasi || '-')}</td>
      <td class="p-2.5 font-semibold text-[#202124] dark:text-[#f1f3f4] break-words">${escapeHtml(row.nama_toko || '-')}</td>
      <td class="p-2.5 text-center text-[#5f6368] dark:text-[#9aa0a6] truncate">${escapeHtml(row.luas || '-')}</td>
      <td class="p-2.5 text-[#5f6368] dark:text-[#9aa0a6] truncate">${escapeHtml(row.tipe || '-')}</td>
      <td class="p-2.5 font-medium text-[#202124] dark:text-[#f1f3f4] break-words">${escapeHtml(row.penyewa || '-')}</td>
      <td class="p-2.5 text-[#5f6368] dark:text-[#9aa0a6] truncate">${escapeHtml(row.komoditi || '-')}</td>
      <td class="p-2.5 text-center">
        <span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusBadgeClass}">
          ${escapeHtml(row.status || '-')}
        </span>
      </td>
      <td class="p-2.5 text-[#5f6368] dark:text-[#9aa0a6] truncate" title="${escapeHtml(row.cp || '')}">${escapeHtml(row.cp || '-')}</td>
      <td class="p-2.5 text-center">
        <button onclick="showHistoryModal(${row.no})" title="Lihat riwayat validasi #${row.no}" class="font-mono text-xs font-semibold text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#1a73e8] dark:hover:text-[#8ab4f8] transition-colors cursor-pointer select-none">
          ${escapeHtml(currentValidasi)}
        </button>
      </td>
      <td class="p-2.5 text-center text-[#5f6368] dark:text-[#9aa0a6] font-mono text-[11px] truncate">${escapeHtml(currentUpdate)}</td>
    `;
    tbody.appendChild(tr);
  });

  updatePaginationUI();
  updateFilterButtonStyles();
}

function showHistoryModal(no) {
  const data = rawDataMap.get(no);
  if (!data) return;

  const historyList = document.getElementById('historyListContent');
  
  let validasiArr = [];
  if (Array.isArray(data.validasi)) {
    validasiArr = data.validasi;
  } else if (data.validasi) {
    try { validasiArr = JSON.parse(data.validasi); } catch { validasiArr = [data.validasi]; }
  }

  let updateArr = [];
  if (Array.isArray(data.update)) {
    updateArr = data.update;
  } else if (data.update) {
    try { updateArr = JSON.parse(data.update); } catch { updateArr = [data.update]; }
  }

  if (!Array.isArray(validasiArr)) validasiArr = [validasiArr];
  if (!Array.isArray(updateArr)) updateArr = [updateArr];

  if (validasiArr.length === 0 || (validasiArr.length === 1 && !validasiArr[0])) {
    historyList.innerHTML = `<div class="text-[#5f6368] dark:text-[#9aa0a6] text-center italic py-2">Belum ada riwayat validasi</div>`;
  } else {
    let itemsHtml = '';
    const maxLength = Math.max(validasiArr.length, updateArr.length);

    for (let i = 0; i < maxLength; i++) {
      const dateVal = updateArr[i] || '-';
      const statusVal = validasiArr[i] || '-';
      itemsHtml += `
        <div class="flex items-center justify-between py-1.5 border-b border-[#f1f3f4] dark:border-[#2d2d2d] last:border-0">
          <span class="font-bold text-[#1a73e8] dark:text-[#8ab4f8]">${escapeHtml(dateVal)}</span>
          <span class="font-medium text-[#202124] dark:text-[#e8eaed]">${escapeHtml(statusVal)}</span>
        </div>`;
    }
    historyList.innerHTML = itemsHtml;
  }

  document.getElementById('historyModal').classList.remove('hidden');
}

function closeHistoryModal() {
  document.getElementById('historyModal').classList.add('hidden');
}

function toggleFilterMenu(columnKey, event) {
  if (tableFilter) {
    tableFilter.toggleMenu(columnKey, event, fetchedData);
  }
}

function closeFilterPopover() {
  if (tableFilter) tableFilter.closePopover();
}

function renderFilterCheckboxes() {
  if (tableFilter) tableFilter.renderCheckboxes();
}

function toggleSelectAllFilters(checked) {
  if (tableFilter) tableFilter.toggleSelectAll(checked);
}

function clearFilterColumn() {
  if (tableFilter) tableFilter.clearColumn();
}

function applyFilter() {
  if (tableFilter) tableFilter.applyFilter();
}

function applySort(direction) {
  if (tableFilter) {
    sortConfig = { column: tableFilter.activeFilterColumn, direction };
    closeFilterPopover();
    currentPage = 1;
    saveStateToSession();
    fetchTableData();
  }
}

function updatePaginationUI() {
  const totalPages = Math.ceil(totalRows / PAGE_SIZE) || 1;
  const startRow = totalRows === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(currentPage * PAGE_SIZE, totalRows);

  document.getElementById('pageInfo').innerText = `Menampilkan ${startRow}-${endRow} dari ${totalRows} data`;
  document.getElementById('totalPagesText').innerText = `/ ${totalPages}`;
  document.getElementById('jumpPageInput').value = currentPage;

  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  document.getElementById('btnHome').disabled = isFirstPage;
  document.getElementById('btnPrev').disabled = isFirstPage;
  document.getElementById('btnNext').disabled = isLastPage;
  document.getElementById('btnEnd').disabled = isLastPage;
}

function goToHome() {
  if (currentPage !== 1) {
    currentPage = 1;
    fetchTableData();
  }
}

function goToEnd() {
  const totalPages = Math.ceil(totalRows / PAGE_SIZE) || 1;
  if (currentPage !== totalPages) {
    currentPage = totalPages;
    fetchTableData();
  }
}

function changePage(delta) {
  const totalPages = Math.ceil(totalRows / PAGE_SIZE) || 1;
  const newPage = currentPage + delta;

  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    fetchTableData();
  }
}

function jumpToPage() {
  const totalPages = Math.ceil(totalRows / PAGE_SIZE) || 1;
  const input = document.getElementById('jumpPageInput');
  let val = parseInt(input.value, 10);

  if (isNaN(val) || val < 1) val = 1;
  if (val > totalPages) val = totalPages;

  currentPage = val;
  fetchTableData();
}

function openModal(mode, data = null) {
  if (!isSuperAdmin()) {
    alert("Anda tidak memiliki hak akses untuk mengubah data.");
    return;
  }

  const modal = document.getElementById('modal');
  const form = document.getElementById('tenantForm');
  const title = document.getElementById('modalTitle');
  const btnDelete = document.getElementById('btnDeleteInModal');

  form.reset();
  document.getElementById('editNo').value = '';

  const tagTabel = currentSourceTable === 'tenant_pbm' ? '(PBM)' : '(PBC)';

  if (mode === 'add') {
    title.innerText = `Tambah Tenant Baru ${tagTabel}`;
    btnDelete.classList.add('hidden');
  } else if (mode === 'edit' && data) {
    title.innerText = `Edit Tenant ${tagTabel} #${data.no}`;
    btnDelete.classList.remove('hidden');

    document.getElementById('editNo').value = data.no;
    document.getElementById('inputLokasi').value = data.lokasi || '';
    document.getElementById('inputLantai').value = data.lantai || '';
    document.getElementById('inputNamaToko').value = data.nama_toko || '';
    document.getElementById('inputLuas').value = data.luas || '';
    document.getElementById('inputTipe').value = data.tipe || '';
    document.getElementById('inputPenyewa').value = data.penyewa || '';
    document.getElementById('inputStatus').value = data.status || '';
    document.getElementById('inputKomoditi').value = data.komoditi || '';
    document.getElementById('inputCp').value = data.cp || '';
    document.getElementById('inputValidasi').value = parseJsonbFirst(data.validasi);
  }

  modal.classList.remove('hidden');
}

function openModalForNo(no) {
  const data = rawDataMap.get(no);
  if (data) openModal('edit', data);
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

async function saveData(e) {
  e.preventDefault();
  if (!isSuperAdmin()) return;

  const editNo = document.getElementById('editNo').value;
  const currentDate = new Date().toISOString().split('T')[0];
  const newValidasiInput = document.getElementById('inputValidasi').value.trim();

  let validasiArray = [];
  let updateArray = [];

  try {
    if (editNo) {
      const existingData = rawDataMap.get(parseInt(editNo, 10)) || {};

      if (Array.isArray(existingData.validasi)) {
        validasiArray = [...existingData.validasi];
      } else if (existingData.validasi) {
        try { validasiArray = JSON.parse(existingData.validasi); } catch { validasiArray = [existingData.validasi]; }
      }

      if (Array.isArray(existingData.update)) {
        updateArray = [...existingData.update];
      } else if (existingData.update) {
        try { updateArray = JSON.parse(existingData.update); } catch { updateArray = [existingData.update]; }
      }

      if (!Array.isArray(validasiArray)) validasiArray = [validasiArray];
      if (!Array.isArray(updateArray)) updateArray = [updateArray];

      const lastValidasi = validasiArray[0] || '';

      if (newValidasiInput !== lastValidasi) {
        if (newValidasiInput) {
          validasiArray.unshift(newValidasiInput);
          updateArray.unshift(currentDate);
        }
      }

      const payload = {
        lokasi: document.getElementById('inputLokasi').value.trim() || null,
        lantai: document.getElementById('inputLantai').value.trim() || null,
        nama_toko: document.getElementById('inputNamaToko').value.trim() || null,
        luas: document.getElementById('inputLuas').value.trim() || null,
        tipe: document.getElementById('inputTipe').value.trim() || null,
        penyewa: document.getElementById('inputPenyewa').value.trim() || null,
        status: document.getElementById('inputStatus').value.trim() || null,
        komoditi: document.getElementById('inputKomoditi').value.trim() || null,
        cp: document.getElementById('inputCp').value.trim() || null,
        validasi: validasiArray,
        update: updateArray
      };

      const { error } = await _supabase
        .from(currentSourceTable)
        .update(payload)
        .eq('no', editNo);

      if (error) throw error;
    } else {
      if (newValidasiInput) {
        validasiArray = [newValidasiInput];
        updateArray = [currentDate];
      }

      const { data: maxNoData, error: maxNoError } = await _supabase
        .from(currentSourceTable)
        .select('no')
        .order('no', { ascending: false })
        .limit(1);

      if (maxNoError) throw maxNoError;

      let nextNo = 1;
      if (maxNoData && maxNoData.length > 0 && maxNoData[0].no) {
        nextNo = parseInt(maxNoData[0].no, 10) + 1;
      }

      const payload = {
        no: nextNo,
        lokasi: document.getElementById('inputLokasi').value.trim() || null,
        lantai: document.getElementById('inputLantai').value.trim() || null,
        nama_toko: document.getElementById('inputNamaToko').value.trim() || null,
        luas: document.getElementById('inputLuas').value.trim() || null,
        tipe: document.getElementById('inputTipe').value.trim() || null,
        penyewa: document.getElementById('inputPenyewa').value.trim() || null,
        status: document.getElementById('inputStatus').value.trim() || null,
        komoditi: document.getElementById('inputKomoditi').value.trim() || null,
        cp: document.getElementById('inputCp').value.trim() || null,
        validasi: validasiArray,
        update: updateArray
      };

      const { error } = await _supabase
        .from(currentSourceTable)
        .insert([payload]);

      if (error) throw error;
    }

    closeModal();
    if (tableFilter) tableFilter.dbFilterOptions = {};
    await fetchTableData();

  } catch (err) {
    alert('Gagal menyimpan data tenant: ' + err.message);
  }
}

async function deleteDataInModal() {
  if (!isSuperAdmin()) return;
  const no = document.getElementById('editNo').value;
  if (!no) return;

  if (!confirm(`Apakah Anda yakin ingin menghapus data tenant #${no}?`)) return;

  try {
    const { error } = await _supabase
      .from(currentSourceTable)
      .delete()
      .eq('no', no);

    if (error) throw error;

    closeModal();
    if (tableFilter) tableFilter.dbFilterOptions = {};
    await fetchTableData();

  } catch (err) {
    alert('Gagal menghapus data tenant: ' + err.message);
  }
}

async function exportCSV() {
  try {
    let query = _supabase.from(currentSourceTable).select('*').order('no', { ascending: true });
    query = applySupabaseFilters(query);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    const headers = ['no', 'lokasi', 'lantai', 'nama_toko', 'luas', 'tipe', 'penyewa', 'status', 'komoditi', 'cp', 'validasi', 'update'];
    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const values = headers.map(header => {
        const rawVal = row[header];
        const val = (header === 'validasi' || header === 'update') ? parseJsonbFirst(rawVal) : rawVal;
        return `"${String(val ?? '').replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${currentSourceTable}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    alert('Gagal mengunduh CSV: ' + err.message);
  }
}