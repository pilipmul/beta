// KONFIGURASI SUPABASE SAMA PERSIS DENGAN INVENTORY
const SUPABASE_URL = 'https://sfblelnbczlvykqemhtm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PAGE_SIZE = 200;
let currentPage = 1;
let totalRows = 0;
let rawDataMap = new Map();
let fetchedData = [];
let dbFilterOptions = {};

let activeFilterColumn = null;
let draftFilterSelections = new Set();

let globalSearchQuery = sessionStorage.getItem('tenant_globalSearchQuery') || '';
let sortConfig = JSON.parse(sessionStorage.getItem('tenant_sortConfig')) || { column: null, direction: null };

let filterSelections = {};
try {
  const savedFilters = JSON.parse(sessionStorage.getItem('tenant_filterSelections'));
  if (savedFilters && typeof savedFilters === 'object') {
    Object.keys(savedFilters).forEach(key => {
      if (Array.isArray(savedFilters[key])) {
        filterSelections[key] = new Set(savedFilters[key]);
      }
    });
  }
} catch {
  filterSelections = {};
}

// Daftar akun yang memiliki hak akses CRUD (Create, Update, Delete)
const ALLOWED_EDITORS = ["Dede Hidayat", "Sutriono", "Herliana Oktavianti"];

function isSuperAdmin() {
  try {
    const session = localStorage.getItem("user");
    if (!session) return false;
    
    const userData = JSON.parse(session);
    if (!userData) return false;

    // Cek apakah nama atau username ada di dalam daftar ALLOWED_EDITORS
    const isEditor = ALLOWED_EDITORS.includes(userData.nama) || ALLOWED_EDITORS.includes(userData.username);

    return isEditor || userData.role === "Admin" || userData.role === "SuperAdmin";
  } catch (err) {
    console.error("Gagal verifikasi hak akses editor:", err);
    return false;
  }
}

function saveStateToSession() {
  sessionStorage.setItem('tenant_globalSearchQuery', globalSearchQuery);
  sessionStorage.setItem('tenant_sortConfig', JSON.stringify(sortConfig));

  const serializableFilters = {};
  Object.keys(filterSelections).forEach(key => {
    if (filterSelections[key] && filterSelections[key].size > 0) {
      serializableFilters[key] = Array.from(filterSelections[key]);
    }
  });
  sessionStorage.setItem('tenant_filterSelections', JSON.stringify(serializableFilters));
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
  if (isSuperAdmin()) {
    html += `
      <button onclick="openModal('add'); toggleHamburgerMenu();" class="w-full text-left px-3 py-2 text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] flex items-center gap-2.5 transition cursor-pointer">
        <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        <span>Tambah Tenant</span>
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

document.addEventListener('DOMContentLoaded', () => {
  const hamburgerMenuOptions = [];
  if (isSuperAdmin()) {
    hamburgerMenuOptions.push({
      label: "Tambah Tenant",
      icon: `<svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`,
      onClick: "openModal('add')"
    });
  }
  hamburgerMenuOptions.push({
    label: "Export CSV",
    icon: `<svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>`,
    onClick: "exportCSV()"
  });

  if (typeof renderHeader === 'function') {
    renderHeader({
      subtitle: "Tenant",
      hamburgerItems: hamburgerMenuOptions
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

  _supabase
    .channel('public:tenant')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tenant' }, () => {
      fetchTableData();
    })
    .subscribe();
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
  currentPage = 1;
  document.getElementById('btnClearSearch').classList.toggle('hidden', val === '');
  saveStateToSession();
  fetchTableData();
}

function clearGlobalSearch() {
  document.getElementById('globalSearchInput').value = '';
  document.getElementById('btnClearSearch').classList.add('hidden');
  globalSearchQuery = '';
  currentPage = 1;
  saveStateToSession();
  fetchTableData();
}

function updateFilterButtonStyles() {
  const allColumns = ['no', 'lokasi', 'nama_toko', 'luas', 'tipe', 'penyewa', 'komoditi', 'status', 'cp', 'validasi'];

  allColumns.forEach(col => {
    const btn = document.getElementById(`btn-filter-${col}`);
    if (!btn) return;

    const isActive = filterSelections[col] && filterSelections[col].size > 0;

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
  if (globalSearchQuery !== '') {
    query = query.or(
      `lokasi.ilike.%${globalSearchQuery}%,` +
      `nama_toko.ilike.%${globalSearchQuery}%,` +
      `tipe.ilike.%${globalSearchQuery}%,` +
      `penyewa.ilike.%${globalSearchQuery}%,` +
      `status.ilike.%${globalSearchQuery}%,` +
      `komoditi.ilike.%${globalSearchQuery}%,` +
      `cp.ilike.%${globalSearchQuery}%,` +
      `validasi.ilike.%${globalSearchQuery}%`
    );
  }

  for (const colKey in filterSelections) {
    const selectedSet = filterSelections[colKey];
    if (selectedSet && selectedSet.size > 0) {
      const selectedArray = Array.from(selectedSet);
      const hasBlank = selectedArray.includes('-');
      const nonBlankValues = selectedArray.filter(v => v !== '-');

      if (hasBlank && nonBlankValues.length > 0) {
        query = query.or(`${colKey}.in.(${nonBlankValues.map(v => `"${v}"`).join(',')}),${colKey}.is.null,${colKey}.eq.`);
      } else if (hasBlank) {
        query = query.or(`${colKey}.is.null,${colKey}.eq.`);
      } else if (nonBlankValues.length > 0) {
        query = query.in(colKey, nonBlankValues);
      }
    }
  }
  return query;
}

async function fetchTableData() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Memuat data...</td></tr>`;

  try {
    let countQuery = _supabase.from('tenant').select('*', { count: 'exact', head: true });
    countQuery = applySupabaseFilters(countQuery);

    const { count, error: countErr } = await countQuery;
    if (countErr) throw countErr;

    totalRows = count || 0;
    document.getElementById('totalDataCount').innerText = totalRows;

    if (totalRows === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Data tenant tidak ditemukan.</td></tr>`;
      updatePaginationUI();
      updateFilterButtonStyles();
      return;
    }

    const totalPages = Math.ceil(totalRows / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;

    const fromIndex = (currentPage - 1) * PAGE_SIZE;
    const toIndex = Math.min(currentPage * PAGE_SIZE - 1, totalRows - 1);

    let dataQuery = _supabase.from('tenant').select('*');
    dataQuery = applySupabaseFilters(dataQuery);

    if (sortConfig.column && sortConfig.direction) {
      dataQuery = dataQuery.order(sortConfig.column, { ascending: sortConfig.direction === 'asc' });
    } else {
      dataQuery = dataQuery.order('no', { ascending: true });
    }

    dataQuery = dataQuery.range(fromIndex, toIndex);

    const { data, error } = await dataQuery;
    if (error) throw error;

    fetchedData = data || [];
    rawDataMap.clear();
    fetchedData.forEach(row => rawDataMap.set(row.no, row));

    renderTable();

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-red-500 font-medium">Gagal memuat data dari Supabase.<br><span class="text-xs text-[#5f6368] dark:text-[#9aa0a6] font-normal">Error: ${err.message}</span></td></tr>`;
  }
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (fetchedData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Tidak ada data yang sesuai filter.</td></tr>`;
    updatePaginationUI();
    updateFilterButtonStyles();
    return;
  }

  const allowEdit = isSuperAdmin();

  fetchedData.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-[#f8f9fa] dark:hover:bg-[#252525] border-b border-[#f1f3f4] dark:border-[#2d2d2d] text-[#202124] dark:text-[#e8eaed] transition-colors';

    // No Menjadi Tombol Edit jika akun berhak
    const noBtn = allowEdit 
      ? `<button onclick="openModalForNo(${row.no})" title="Edit Tenant #${row.no}" class="inline-block px-2.5 py-0.5 bg-[#e8f0fe] dark:bg-[#2c384e] hover:bg-[#d2e3fc] dark:hover:bg-[#3a4963] text-[#1a73e8] dark:text-[#8ab4f8] rounded-full border border-[#1a73e8]/20 dark:border-[#8ab4f8]/20 font-medium text-xs transition cursor-pointer">${row.no}</button>`
      : `<span class="inline-block px-2 py-0.5 text-[#5f6368] dark:text-[#9aa0a6] font-mono text-xs">${row.no}</span>`;

    // Status Badge Styling
    const statusVal = String(row.status || '').toLowerCase();
    let statusBadgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    if (statusVal.includes('tersewa') || statusVal.includes('active') || statusVal.includes('isi') || statusVal.includes('sewa')) {
      statusBadgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500/20';
    } else if (statusVal.includes('vacant') || statusVal.includes('kosong')) {
      statusBadgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-500/20';
    }

    tr.innerHTML = `
      <td class="p-2.5 text-center font-mono">${noBtn}</td>
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
      <td class="p-2.5 text-center font-semibold text-[#5f6368] dark:text-[#9aa0a6] truncate">${escapeHtml(row.validasi || '-')}</td>
    `;
    tbody.appendChild(tr);
  });

  updatePaginationUI();
  updateFilterButtonStyles();
}

async function toggleFilterMenu(columnKey, event) {
  event.stopPropagation();
  activeFilterColumn = columnKey;

  const popover = document.getElementById('filterPopover');
  const rect = event.currentTarget.getBoundingClientRect();
  
  let leftPos = Math.max(10, Math.min(rect.left + window.scrollX - 100, window.innerWidth - 230));

  popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
  popover.style.left = `${leftPos}px`;
  document.getElementById('filterSearchInput').value = '';
  
  if (!dbFilterOptions[columnKey]) {
    try {
      const { data, error } = await _supabase.from('tenant').select(columnKey);
      if (!error && data) {
        const allVals = data.map(r => (r[columnKey] !== null && r[columnKey] !== undefined && r[columnKey] !== '') ? String(r[columnKey]) : '-');
        dbFilterOptions[columnKey] = Array.from(new Set(allVals)).sort();
      } else {
        dbFilterOptions[columnKey] = Array.from(new Set(fetchedData.map(r => (r[columnKey] !== null && r[columnKey] !== undefined && r[columnKey] !== '') ? String(r[columnKey]) : '-'))).sort();
      }
    } catch {
      dbFilterOptions[columnKey] = Array.from(new Set(fetchedData.map(r => (r[columnKey] !== null && r[columnKey] !== undefined && r[columnKey] !== '') ? String(r[columnKey]) : '-'))).sort();
    }
  }

  const activeSaved = filterSelections[activeFilterColumn];
  const allOpts = dbFilterOptions[activeFilterColumn] || [];

  draftFilterSelections = (activeSaved && activeSaved.size > 0) ? new Set(activeSaved) : new Set(allOpts);

  renderFilterCheckboxes();
  popover.classList.remove('hidden');
}

function closeFilterPopover() {
  document.getElementById('filterPopover').classList.add('hidden');
}

function renderFilterCheckboxes() {
  const container = document.getElementById('filterItemsList');
  const searchVal = document.getElementById('filterSearchInput').value.trim().toLowerCase();
  const uniqueValues = dbFilterOptions[activeFilterColumn] || Array.from(new Set(fetchedData.map(r => (r[activeFilterColumn] !== null && r[activeFilterColumn] !== undefined && r[activeFilterColumn] !== '') ? String(r[activeFilterColumn]) : '-'))).sort();

  container.innerHTML = '';
  let visibleCount = 0, visibleCheckedCount = 0;

  uniqueValues.forEach(val => {
    if (searchVal && !val.toLowerCase().includes(searchVal)) return;

    visibleCount++;
    const isChecked = draftFilterSelections.has(val);
    if (isChecked) visibleCheckedCount++;

    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 text-[11px] text-[#202124] dark:text-[#e8eaed] hover:bg-[#e8eaed] dark:hover:bg-[#2d2d2d] p-1 rounded cursor-pointer truncate';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = val;
    checkbox.checked = isChecked;
    checkbox.className = 'filter-cb';
    
    checkbox.onchange = (e) => {
      if (e.target.checked) draftFilterSelections.add(val);
      else draftFilterSelections.delete(val);
      updateSelectAllState();
    };

    label.appendChild(checkbox);
    const span = document.createElement('span');
    span.className = 'truncate';
    span.innerText = val;
    label.appendChild(span);

    container.appendChild(label);
  });

  const selectAllCb = document.getElementById('selectAllCheckbox');
  if (selectAllCb) selectAllCb.checked = visibleCount > 0 && visibleCheckedCount === visibleCount;
}

function updateSelectAllState() {
  const cbs = document.querySelectorAll('#filterItemsList .filter-cb');
  const allChecked = cbs.length > 0 && Array.from(cbs).every(cb => cb.checked);
  const selectAllCb = document.getElementById('selectAllCheckbox');
  if (selectAllCb) selectAllCb.checked = allChecked;
}

function toggleSelectAllFilters(checked) {
  document.querySelectorAll('#filterItemsList .filter-cb').forEach(cb => {
    cb.checked = checked;
    if (checked) draftFilterSelections.add(cb.value);
    else draftFilterSelections.delete(cb.value);
  });
}

function clearFilterColumn() {
  delete filterSelections[activeFilterColumn];
  draftFilterSelections = new Set(dbFilterOptions[activeFilterColumn] || []);
  document.getElementById('filterSearchInput').value = '';
  renderFilterCheckboxes();
  currentPage = 1;
  saveStateToSession();
  fetchTableData();
}

function applyFilter() {
  const allOpts = dbFilterOptions[activeFilterColumn] || [];
  if (draftFilterSelections.size === 0 || draftFilterSelections.size === allOpts.length) {
    delete filterSelections[activeFilterColumn];
  } else {
    filterSelections[activeFilterColumn] = new Set(draftFilterSelections);
  }
  closeFilterPopover();
  currentPage = 1;
  saveStateToSession();
  fetchTableData();
}

function applySort(direction) {
  sortConfig = { column: activeFilterColumn, direction };
  closeFilterPopover();
  currentPage = 1;
  saveStateToSession();
  fetchTableData();
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

  if (mode === 'add') {
    title.innerText = 'Tambah Tenant Baru';
    btnDelete.classList.add('hidden');
  } else if (mode === 'edit' && data) {
    title.innerText = `Edit Tenant #${data.no}`;
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
    document.getElementById('inputValidasi').value = data.validasi || '';
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
    validasi: document.getElementById('inputValidasi').value.trim() || null
  };

  try {
    if (editNo) {
      const { error } = await _supabase
        .from('tenant')
        .update(payload)
        .eq('no', editNo);

      if (error) throw error;
    } else {
      const { data: maxNoData, error: maxNoError } = await _supabase
        .from('tenant')
        .select('no')
        .order('no', { ascending: false })
        .limit(1);

      if (maxNoError) throw maxNoError;

      let nextNo = 1;
      if (maxNoData && maxNoData.length > 0 && maxNoData[0].no) {
        nextNo = parseInt(maxNoData[0].no, 10) + 1;
      }

      payload.no = nextNo;

      const { error } = await _supabase
        .from('tenant')
        .insert([payload]);

      if (error) throw error;
    }

    closeModal();
    dbFilterOptions = {};
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
      .from('tenant')
      .delete()
      .eq('no', no);

    if (error) throw error;

    closeModal();
    dbFilterOptions = {};
    await fetchTableData();

  } catch (err) {
    alert('Gagal menghapus data tenant: ' + err.message);
  }
}

async function exportCSV() {
  try {
    let query = _supabase.from('tenant').select('*').order('no', { ascending: true });
    query = applySupabaseFilters(query);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    const headers = ['no', 'lokasi', 'lantai', 'nama_toko', 'luas', 'tipe', 'penyewa', 'status', 'komoditi', 'cp', 'validasi'];
    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const values = headers.map(header => `"${String(row[header] ?? '').replace(/"/g, '""')}"`);
      csvRows.push(values.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tenant_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    alert('Gagal mengunduh CSV: ' + err.message);
  }
}