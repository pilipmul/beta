const SUPABASE_URL = 'https://sfblelnbczlvykqemhtm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0';
const GOOGLE_DRIVE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz1hEe3lHhkLKX_lM0JiG1YB0_3sFsTXzjsT3-wUfwVFdHFbMUSFiOBGZ2sSAKUVBLO/exec";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PAGE_SIZE = 200;
let currentPage = 1;
let totalRows = 0;
let rawDataMap = new Map();
let fetchedData = [];

// Kamera & File Handler State
let currentStream = null;
let currentFacingMode = "environment"; // Default kamera belakang
let selectedImageFile = null; // Menampung file gambar fisik asli

let currentUserSession = {
  nama: "Operational User",
  division: sessionStorage.getItem('event_activeDivision') || 'cleaning'
};

let globalSearchQuery = sessionStorage.getItem('event_globalSearchQuery') || '';
let sortConfig = JSON.parse(sessionStorage.getItem('event_sortConfig')) || { column: null, direction: null };

// Inisialisasi TableFilterManager untuk Modul Event
const tableFilter = new TableFilterManager({
  tableName: 'event',
  supabaseClient: _supabase,
  columns: ['id', 'timestamp', 'logged_by', 'location', 'category', 'priority', 'subject', 'status'],
  globalSearchQuery: globalSearchQuery,
  popoverId: 'filterPopover',
  containerId: 'filterItemsList',
  searchInputId: 'filterSearchInput',
  selectAllId: 'selectAllCheckbox',
  onFilterChange: () => {
    currentPage = 1;
    saveStateToSession();
    fetchTableData();
  }
});

// Restore filter tersimpan dari sessionStorage
try {
  const savedFilters = JSON.parse(sessionStorage.getItem('event_filterSelections'));
  if (savedFilters && typeof savedFilters === 'object') {
    Object.keys(savedFilters).forEach(key => {
      if (Array.isArray(savedFilters[key])) {
        tableFilter.filterSelections[key] = new Set(savedFilters[key]);
      }
    });
  }
} catch {
  tableFilter.filterSelections = {};
}

// --------------------------------------------------------------------------
// HAK AKSES & POSISI USER LOGIC
// --------------------------------------------------------------------------
function getUserData() {
  try {
    const session = localStorage.getItem("user");
    if (!session) return null;
    return JSON.parse(session);
  } catch {
    return null;
  }
}

function isSuperAdmin() {
  const userData = getUserData();
  return userData && (userData.nama === "Dede Hidayat" || userData.username === "Dede Hidayat");
}

function getUserSessionName() {
  const userData = getUserData();
  if (!userData) return "Operational User";
  return userData.nama || userData.username || "Operational User";
}

function getDivisionFromPosition(position) {
  if (!position) return 'cleaning';
  const pos = position.toLowerCase();

  if (pos.includes('cleaner') || pos.includes('cleaning')) return 'cleaning';
  if (pos.includes('engineer') || pos.includes('engineering')) return 'engineering';
  if (pos.includes('security') || pos.includes('satpam')) return 'security';

  return 'cleaning';
}

function hasFullDivisionAccess() {
  if (isSuperAdmin()) return true;

  const userData = getUserData();
  const pos = (userData?.position || '').toLowerCase();
  
  // Posisi Officer diberikan hak akses penuh ke seluruh divisi
  return pos.includes('officer');
}

function saveStateToSession() {
  sessionStorage.setItem('event_activeDivision', currentUserSession.division);
  sessionStorage.setItem('event_globalSearchQuery', tableFilter.globalSearchQuery);
  sessionStorage.setItem('event_sortConfig', JSON.stringify(sortConfig));

  const serializableFilters = {};
  Object.keys(tableFilter.filterSelections).forEach(key => {
    if (tableFilter.filterSelections[key] && tableFilter.filterSelections[key].size > 0) {
      serializableFilters[key] = Array.from(tableFilter.filterSelections[key]);
    }
  });
  sessionStorage.setItem('event_filterSelections', JSON.stringify(serializableFilters));
}

function toggleConnDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('customDropdownMenu');
  if (dropdown) dropdown.classList.toggle('hidden');
}

function switchDivision(div) {
  const userData = getUserData();
  const userPosition = userData?.position || '';
  const userDivision = getDivisionFromPosition(userPosition);
  const fullAccess = hasFullDivisionAccess();

  // Batasi perpindahan divisi jika bukan Officer / Super Admin
  if (!fullAccess && div !== userDivision) {
    alert(`Akses ditolak! Akun Anda (${userPosition}) hanya memiliki izin untuk modul ${userDivision}.`);
    return;
  }

  currentUserSession.division = div;
  sessionStorage.setItem('event_activeDivision', div);

  // Update tampilan tombol switcher divisi
  ['cleaning', 'engineering', 'security'].forEach(d => {
    const btn = document.getElementById('btnDiv' + d.charAt(0).toUpperCase() + d.slice(1));
    if (btn) {
      if (d === div) {
        btn.className = "px-2 py-1 rounded-md transition-all bg-white dark:bg-[#404040] shadow-sm text-[#1a73e8] dark:text-[#8ab4f8] font-semibold cursor-pointer";
      } else {
        btn.className = "px-2 py-1 rounded-md transition-all text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] cursor-pointer";
      }

      // Kunci tombol divisi selain miliknya jika tidak memiliki akses penuh
      if (!fullAccess && d !== userDivision) {
        btn.disabled = true;
        btn.classList.add('opacity-40', 'cursor-not-allowed');
        btn.classList.remove('cursor-pointer');
      } else {
        btn.disabled = false;
        btn.classList.remove('opacity-40', 'cursor-not-allowed');
      }
    }
  });

  setupDynamicFormCategory();
  currentPage = 1;
  saveStateToSession();
  fetchTableData();
}

function setupDynamicFormCategory() {
  const categorySelect = document.getElementById('inputCategory');
  if (!categorySelect) return;
  categorySelect.innerHTML = '<option value="">-- Pilih Kategori --</option>';

  const categories = {
    cleaning: ['Routine Cleanup', 'Deep Cleaning', 'Chemical Spill', 'Restock Trigger', 'Neglect Notice'],
    engineering: ['Machine Breakdown', 'Preventive Maintenance', 'Asset Replacement', 'Utility Failure'],
    security: ['Facility Patrol', 'Access Breach', 'Property Lost/Found', 'Theft Incident', 'Gate Protocol']
  };

  const targetCategories = categories[currentUserSession.division] || [];
  targetCategories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.innerText = cat;
    categorySelect.appendChild(opt);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  currentUserSession.nama = getUserSessionName();

  const userData = getUserData();
  // Jika tidak punya akses penuh (bukan Officer/Super Admin), atur divisi default sesuai posisinya
  if (!hasFullDivisionAccess() && userData && userData.position) {
    currentUserSession.division = getDivisionFromPosition(userData.position);
  }

  const hamburgerMenuOptions = [
    {
      label: "Tambah Entry",
      icon: `<svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`,
      onClick: "openModal('add')"
    },
    {
      label: "Export CSV",
      icon: `<svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>`,
      onClick: "openExportModal()"
    }
  ];

  if (typeof renderHeader === 'function') {
    renderHeader({ 
      subtitle: "Event Dashboard",
      hamburgerItems: hamburgerMenuOptions 
    });
  }

  const customContainer = document.getElementById('custom-hamburger-content');
  if (customContainer && customContainer.innerHTML.trim() === '') {
    customContainer.innerHTML = hamburgerMenuOptions.map(item => `
      <button onclick="${item.onClick}; toggleConnDropdown();" class="w-full text-left px-3 py-2 hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] flex items-center gap-2.5 text-xs text-[#202124] dark:text-[#e8eaed] transition cursor-pointer">
        ${item.icon}
        <span>${item.label}</span>
      </button>
    `).join('');
  }

  if (globalSearchQuery) {
    const searchInput = document.getElementById('globalSearchInput');
    const btnClear = document.getElementById('btnClearSearch');
    if (searchInput) searchInput.value = globalSearchQuery;
    if (btnClear) btnClear.classList.remove('hidden');
  }

  switchDivision(currentUserSession.division);
  setupDropzone();

  // Supabase Realtime Listener
  _supabase
    .channel('public:event')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'event' }, (payload) => {
      handleRealtimeUpdate(payload.new);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event' }, () => {
      fetchTableData();
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'event' }, () => {
      fetchTableData();
    })
    .subscribe();
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('#hamburgerBtn');
  const dropdown = document.getElementById('customDropdownMenu');

  if (btn) {
    e.stopPropagation();
    toggleConnDropdown(e);
    return;
  }

  if (dropdown && !dropdown.classList.contains('hidden') && !dropdown.contains(e.target)) {
    dropdown.classList.add('hidden');
  }

  const popover = document.getElementById('filterPopover');
  if (popover && !popover.classList.contains('hidden') && !popover.contains(e.target) && !e.target.closest('button[id^="btn-filter-"]')) {
    tableFilter.closePopover();
  }
});

function handleRealtimeUpdate(newRow) {
  if (!newRow || !newRow.id || newRow.division_owner !== currentUserSession.division) return;

  rawDataMap.set(newRow.id, newRow);

  const idx = fetchedData.findIndex(r => r.id === newRow.id);
  if (idx !== -1) {
    fetchedData[idx] = newRow;
  }

  const tr = document.querySelector(`tr[data-id="${newRow.id}"]`);
  if (!tr) return;

  const priorityBadge = newRow.priority === 'High' 
    ? `<span class="px-2 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">HIGH</span>`
    : newRow.priority === 'Medium'
    ? `<span class="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">MED</span>`
    : `<span class="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400">LOW</span>`;

  const statusBadge = newRow.status === 'Resolved'
    ? `<span class="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Resolved</span>`
    : newRow.status === 'In Progress'
    ? `<span class="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">In Progress</span>`
    : `<span class="px-2 py-0.5 text-[10px] font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200">Open</span>`;

  const photoBtn = newRow.link 
    ? `<button onclick="openPhotoModal('${escapeHtml(newRow.link)}', 'Log #${newRow.id}')" class="px-2.5 py-0.5 bg-[#e8f0fe] dark:bg-[#2c384e] text-[#1a73e8] dark:text-[#8ab4f8] rounded-full border border-[#1a73e8]/20 text-[11px] font-medium transition cursor-pointer">Foto</button>`
    : `<span class="text-[#5f6368] dark:text-[#9aa0a6]">-</span>`;

  const detailsContent = `
    <div class="font-bold truncate">${escapeHtml(newRow.subject)}</div>
    <div class="text-[#5f6368] dark:text-[#9aa0a6] text-[11px] line-clamp-2 mt-0.5">${escapeHtml(newRow.details)}</div>
    ${newRow.action_taken ? `<div class="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">↳ Action: ${escapeHtml(newRow.action_taken)}</div>` : ''}
  `;

  const cellValues = [
    { selector: '.cell-id', html: `<button onclick="openModalForId(${newRow.id})" class="font-mono text-[#1a73e8] dark:text-[#8ab4f8] hover:underline font-bold">${newRow.id}</button>` },
    { selector: '.cell-timestamp', html: escapeHtml(newRow.timestamp || '-') },
    { selector: '.cell-logged_by', html: escapeHtml(newRow.logged_by || '-') },
    { selector: '.cell-location', html: escapeHtml(newRow.location || '-') },
    { selector: '.cell-category', html: `<span class="bg-[#f1f3f4] dark:bg-[#2d2d2d] px-2 py-0.5 rounded font-mono text-[11px]">${escapeHtml(newRow.category || '-')}</span>` },
    { selector: '.cell-priority', html: priorityBadge },
    { selector: '.cell-subject', html: detailsContent },
    { selector: '.cell-link', html: photoBtn },
    { selector: '.cell-status', html: statusBadge }
  ];

  cellValues.forEach(col => {
    const cell = tr.querySelector(col.selector);
    if (cell && cell.innerHTML !== String(col.html)) cell.innerHTML = col.html;
  });
}

function triggerGlobalSearch() {
  const val = document.getElementById('globalSearchInput').value.trim();
  tableFilter.globalSearchQuery = val;
  currentPage = 1;
  document.getElementById('btnClearSearch').classList.toggle('hidden', val === '');
  saveStateToSession();
  fetchTableData();
}

function clearGlobalSearch() {
  document.getElementById('globalSearchInput').value = '';
  document.getElementById('btnClearSearch').classList.add('hidden');
  tableFilter.globalSearchQuery = '';
  currentPage = 1;
  saveStateToSession();
  fetchTableData();
}

function updateFilterButtonStyles() {
  const allColumns = ['id', 'timestamp', 'logged_by', 'location', 'category', 'priority', 'subject', 'status'];

  allColumns.forEach(col => {
    const btn = document.getElementById(`btn-filter-${col}`);
    if (!btn) return;

    const isActive = tableFilter.filterSelections[col] && tableFilter.filterSelections[col].size > 0;

    if (isActive) {
      btn.className = "p-0.5 text-[#1a73e8] dark:text-[#8ab4f8] cursor-pointer transition-transform duration-150 scale-140 inline-block";
      btn.innerHTML = `<svg class="w-2 h-2" viewBox="0 0 10 6"><polygon points="1,1 9,1 5,5" fill="currentColor" stroke="none"/></svg>`;
    } else {
      btn.className = "p-0.5 text-[#5f6368] dark:text-[#bdc1c6] hover:text-[#202124] dark:hover:text-white cursor-pointer transition-transform duration-150 scale-100 inline-block";
      btn.innerHTML = `<svg class="w-2 h-2" viewBox="0 0 10 6"><polygon points="1,1 9,1 5,5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
    }
  });
}

async function fetchTableData() {
  const tbody = document.getElementById('eventTableBody');
  tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Memuat data...</td></tr>`;

  try {
    let countQuery = _supabase.from('event').select('*', { count: 'exact', head: true }).eq('division_owner', currentUserSession.division);
    countQuery = tableFilter.applyToSupabaseQuery(countQuery, ['logged_by', 'location', 'category', 'subject', 'details', 'action_taken']);

    const { count, error: countErr } = await countQuery;
    if (countErr) throw countErr;

    totalRows = count || 0;
    document.getElementById('totalDataCount').innerText = totalRows;

    if (totalRows === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Tidak ada data entry ditemukan.</td></tr>`;
      fetchedData = [];
      updatePaginationUI();
      updateFilterButtonStyles();
      return;
    }

    const totalPages = Math.ceil(totalRows / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;

    const fromIndex = (currentPage - 1) * PAGE_SIZE;
    const toIndex = Math.min(currentPage * PAGE_SIZE - 1, totalRows - 1);

    let dataQuery = _supabase.from('event').select('*').eq('division_owner', currentUserSession.division);
    dataQuery = tableFilter.applyToSupabaseQuery(dataQuery, ['logged_by', 'location', 'category', 'subject', 'details', 'action_taken']);

    if (sortConfig.column && sortConfig.direction) {
      dataQuery = dataQuery.order(sortConfig.column, { ascending: sortConfig.direction === 'asc' });
    } else {
      dataQuery = dataQuery.order('id', { ascending: false });
    }

    dataQuery = dataQuery.range(fromIndex, toIndex);

    const { data, error } = await dataQuery;
    if (error) throw error;

    fetchedData = data || [];
    rawDataMap.clear();
    fetchedData.forEach(row => rawDataMap.set(row.id, row));

    renderTable();

  } catch (err) {
    console.error("Gagal mengambil data event:", err);
    tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500 font-medium">Gagal memuat data event.<br><span class="text-xs text-[#5f6368] dark:text-[#9aa0a6] font-normal">Error: ${err.message}</span></td></tr>`;
  }
}

function renderTable() {
  const tbody = document.getElementById('eventTableBody');
  tbody.innerHTML = '';

  if (fetchedData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Tidak ada data entry ditemukan.</td></tr>`;
    updatePaginationUI();
    updateFilterButtonStyles();
    return;
  }

  fetchedData.forEach(row => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-id', row.id);
    tr.className = 'hover:bg-[#f8f9fa] dark:hover:bg-[#252525] border-b border-[#f1f3f4] dark:border-[#2d2d2d] text-[#202124] dark:text-[#e8eaed] transition-colors';

    const priorityBadge = row.priority === 'High' 
      ? `<span class="px-2 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">HIGH</span>`
      : row.priority === 'Medium'
      ? `<span class="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">MED</span>`
      : `<span class="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400">LOW</span>`;

    const statusBadge = row.status === 'Resolved'
      ? `<span class="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Resolved</span>`
      : row.status === 'In Progress'
      ? `<span class="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">In Progress</span>`
      : `<span class="px-2 py-0.5 text-[10px] font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200">Open</span>`;

    const photoBtn = row.link 
      ? `<button onclick="openPhotoModal('${escapeHtml(row.link)}', 'Log #${row.id}')" class="px-2.5 py-0.5 bg-[#e8f0fe] dark:bg-[#2c384e] text-[#1a73e8] dark:text-[#8ab4f8] rounded-full border border-[#1a73e8]/20 text-[11px] font-medium transition cursor-pointer">Foto</button>`
      : `<span class="text-[#5f6368] dark:text-[#9aa0a6]">-</span>`;

    tr.innerHTML = `
      <td class="cell-id p-2.5 text-center"><button onclick="openModalForId(${row.id})" class="font-mono text-[#1a73e8] dark:text-[#8ab4f8] hover:underline font-bold">${row.id}</button></td>
      <td class="cell-timestamp p-2.5 font-mono text-[#5f6368] dark:text-[#9aa0a6] text-[11px] truncate">${escapeHtml(row.timestamp || '-')}</td>
      <td class="cell-logged_by p-2.5 font-medium truncate">${escapeHtml(row.logged_by || '-')}</td>
      <td class="cell-location p-2.5 text-[#5f6368] dark:text-[#9aa0a6] truncate">${escapeHtml(row.location || '-')}</td>
      <td class="cell-category p-2.5"><span class="bg-[#f1f3f4] dark:bg-[#2d2d2d] px-2 py-0.5 rounded font-mono text-[11px]">${escapeHtml(row.category || '-')}</span></td>
      <td class="cell-priority p-2.5 text-center">${priorityBadge}</td>
      <td class="cell-subject p-2.5 max-w-xs">
        <div class="font-bold truncate">${escapeHtml(row.subject)}</div>
        <div class="text-[#5f6368] dark:text-[#9aa0a6] text-[11px] line-clamp-2 mt-0.5">${escapeHtml(row.details)}</div>
        ${row.action_taken ? `<div class="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">↳ Action: ${escapeHtml(row.action_taken)}</div>` : ''}
      </td>
      <td class="cell-link p-2.5 text-center">${photoBtn}</td>
      <td class="cell-status p-2.5 text-center">${statusBadge}</td>
    `;
    tbody.appendChild(tr);
  });

  updatePaginationUI();
  updateFilterButtonStyles();
}

function toggleFilterMenu(columnKey, event) {
  tableFilter.toggleMenu(columnKey, event, fetchedData);
}

function closeFilterPopover() {
  tableFilter.closePopover();
}

function renderFilterCheckboxes() {
  tableFilter.renderCheckboxes();
}

function toggleSelectAllFilters(checked) {
  tableFilter.toggleSelectAll(checked);
}

function clearFilterColumn() {
  tableFilter.clearColumn();
}

function applyFilter() {
  tableFilter.applyFilter();
}

function applySort(direction) {
  sortConfig = { column: tableFilter.activeFilterColumn, direction };
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
  const modal = document.getElementById('modal');
  const form = document.getElementById('eventForm');
  const title = document.getElementById('modalTitle');
  const btnDelete = document.getElementById('btnDeleteInModal');

  form.reset();
  removeSelectedFile();
  stopCameraStream();
  switchDocMode('upload');
  document.getElementById('editId').value = '';

  if (mode === 'add') {
    title.innerText = 'Tambah Entry Event Baru';
    btnDelete.classList.add('hidden');
  } else if (mode === 'edit' && data) {
    title.innerText = `Edit Entry #${data.id}`;
    btnDelete.classList.remove('hidden');

    document.getElementById('editId').value = data.id;
    document.getElementById('inputLocation').value = data.location || '';
    document.getElementById('inputCategory').value = data.category || '';
    document.getElementById('inputPriority').value = data.priority || 'Low';
    document.getElementById('inputStatus').value = data.status || 'Open';
    document.getElementById('inputSubject').value = data.subject || '';
    document.getElementById('inputDetails').value = data.details || '';
    document.getElementById('inputActionTaken').value = data.action_taken || '';
    document.getElementById('inputLink').value = data.link || '';

    if (data.link) showImagePreview(data.link, 'Foto Tersimpan');
  }

  modal.classList.remove('hidden');
}

function openModalForId(id) {
  const data = rawDataMap.get(id);
  if (data) openModal('edit', data);
}

function closeModal() {
  stopCameraStream();
  document.getElementById('modal').classList.add('hidden');
}

// --------------------------------------------------------------------------
// GOOGLE DRIVE UPLOAD & CAMERA CAPTURE LOGIC
// --------------------------------------------------------------------------
async function uploadToGoogleDrive(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result.split(',')[1];
      const payload = {
        fileName: `event_${Date.now()}_${file.name || 'capture.jpg'}`,
        mimeType: file.type || 'image/jpeg',
        base64Data: base64Data
      };

      try {
        const response = await fetch(GOOGLE_DRIVE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        const rawText = await response.text();
        let resData;

        try {
          resData = JSON.parse(rawText);
        } catch (parseErr) {
          if (rawText.includes("<!DOCTYPE") || rawText.includes("<html")) {
            throw new Error("Server Google Apps Script mengembalikan HTML/Error. Pastikan Web App diset 'Anyone'.");
          } else {
            throw new Error(`Respon server bukan JSON valid: "${rawText}"`);
          }
        }

        if (resData.status === 'success') {
          resolve(resData.url);
        } else {
          reject(new Error(resData.message || "Gagal mengunggah gambar ke Drive."));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

function switchDocMode(mode) {
  stopCameraStream();

  const secUpload = document.getElementById('docSectionUpload');
  const secCamera = document.getElementById('docSectionCamera');
  const secUrl = document.getElementById('docSectionUrl');

  const tabUpload = document.getElementById('tabUpload');
  const tabCamera = document.getElementById('tabCamera');
  const tabUrl = document.getElementById('tabUrl');

  [secUpload, secCamera, secUrl].forEach(el => el.classList.add('hidden'));
  [tabUpload, tabCamera, tabUrl].forEach(tab => {
    tab.className = "px-3 py-1.5 border-b-2 border-transparent text-[#5f6368] hover:text-[#202124] dark:text-[#9aa0a6]";
  });

  if (mode === 'upload') {
    secUpload.classList.remove('hidden');
    tabUpload.className = "px-3 py-1.5 border-b-2 border-[#1a73e8] text-[#1a73e8] dark:text-[#8ab4f8] font-bold";
  } else if (mode === 'camera') {
    secCamera.classList.remove('hidden');
    tabCamera.className = "px-3 py-1.5 border-b-2 border-[#1a73e8] text-[#1a73e8] dark:text-[#8ab4f8] font-bold";
    startCameraStream();
  } else if (mode === 'url') {
    secUrl.classList.remove('hidden');
    tabUrl.className = "px-3 py-1.5 border-b-2 border-[#1a73e8] text-[#1a73e8] dark:text-[#8ab4f8] font-bold";
  }
}

function setupDropzone() {
  const zone = document.getElementById('dropzonePhoto');
  const fileInput = document.getElementById('fileInputPhoto');

  if (!zone || !fileInput) return;

  zone.addEventListener('click', () => fileInput.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('border-[#1a73e8]', 'bg-blue-50/20');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('border-[#1a73e8]', 'bg-blue-50/20');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('border-[#1a73e8]', 'bg-blue-50/20');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files);
    }
  });
}

function handleFileSelected(files) {
  if (!files || files.length === 0) return;
  const file = files[0];

  if (!file.type.startsWith('image/')) {
    alert('Format file tidak didukung. Harap pilih gambar.');
    return;
  }

  selectedImageFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64Url = e.target.result;
    document.getElementById('inputLink').value = base64Url;
    showImagePreview(base64Url, file.name);
  };
  reader.readAsDataURL(file);
}

async function startCameraStream() {
  stopCameraStream();
  const video = document.getElementById('cameraVideo');

  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode }
    });
    video.srcObject = currentStream;
  } catch (err) {
    alert('Gagal mengakses kamera: ' + err.message);
  }
}

function stopCameraStream() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
}

function toggleCameraFacing() {
  currentFacingMode = (currentFacingMode === "environment") ? "user" : "environment";
  startCameraStream();
}

function capturePhotoFromCamera() {
  const video = document.getElementById('cameraVideo');
  const canvas = document.getElementById('cameraCanvas');

  if (!video || !currentStream) return;

  const maxDimension = 800;
  let width = video.videoWidth || 640;
  let height = video.videoHeight || 480;

  if (width > height && width > maxDimension) {
    height = Math.round((height * maxDimension) / width);
    width = maxDimension;
  } else if (height > maxDimension) {
    width = Math.round((width * maxDimension) / height);
    height = maxDimension;
  }

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, width, height);

  canvas.toBlob((blob) => {
    selectedImageFile = new File([blob], `event_camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
  }, 'image/jpeg', 0.85);

  const base64Url = canvas.toDataURL('image/jpeg', 0.85);
  document.getElementById('inputLink').value = base64Url;

  showImagePreview(base64Url, `Foto Kamera (${new Date().toLocaleTimeString('id-ID')})`);
  stopCameraStream();
  switchDocMode('upload');
}

function applyUrlLink() {
  const url = document.getElementById('inputUrlLink').value.trim();
  if (url) {
    selectedImageFile = null;
    document.getElementById('inputLink').value = url;
    showImagePreview(url, "URL Link foto");
  }
}

function showImagePreview(url, name = 'Foto Terpilih') {
  document.getElementById('imgPreviewPhoto').src = url;
  document.getElementById('fileNamePhoto').innerText = name;
  document.getElementById('previewContainerPhoto').classList.remove('hidden');
}

function removeSelectedFile() {
  selectedImageFile = null;
  document.getElementById('inputLink').value = '';
  document.getElementById('previewContainerPhoto').classList.add('hidden');
}

function openPhotoModal(url, title = '') {
  document.getElementById('modalImage').src = url;
  document.getElementById('modalPhotoTitle').innerText = title || 'Preview Photo';
  document.getElementById('imageModal').classList.remove('hidden');
}

function closePhotoModal() {
  document.getElementById('imageModal').classList.add('hidden');
}

async function saveData(e) {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  const idVal = document.getElementById('editId').value;
  let photoUrl = document.getElementById('inputLink').value;

  try {
    if (selectedImageFile) {
      if (submitBtn) submitBtn.innerText = "Uploading foto ke Drive...";
      photoUrl = await uploadToGoogleDrive(selectedImageFile);
    }

    if (submitBtn) submitBtn.innerText = "Menyimpan data...";

    const payload = {
      location: document.getElementById('inputLocation').value.trim(),
      category: document.getElementById('inputCategory').value,
      priority: document.getElementById('inputPriority').value,
      status: document.getElementById('inputStatus').value,
      subject: document.getElementById('inputSubject').value.trim(),
      details: document.getElementById('inputDetails').value.trim(),
      action_taken: document.getElementById('inputActionTaken').value.trim(),
      link: photoUrl,
      logged_by: currentUserSession.nama,
      division_owner: currentUserSession.division
    };

    if (idVal) {
      const { error } = await _supabase.from('event').update(payload).eq('id', idVal);
      if (error) throw error;
    } else {
      payload.timestamp = new Date().toISOString();
      const { error } = await _supabase.from('event').insert([payload]);
      if (error) throw error;
    }

    selectedImageFile = null;
    closeModal();
    fetchTableData();
  } catch (err) {
    alert("Gagal memproses data: " + (err.message || err));
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = "Simpan";
    }
  }
}

async function deleteDataInModal() {
  const idVal = document.getElementById('editId').value;
  if (!idVal || !confirm(`Apakah Anda yakin ingin menghapus entry event #${idVal}?`)) return;

  try {
    const { error } = await _supabase.from('event').delete().eq('id', idVal);
    if (error) throw error;

    closeModal();
    fetchTableData();
  } catch (err) {
    alert("Gagal menghapus data: " + err.message);
  }
}

function openExportModal() {
  document.getElementById('exportDivisionText').value = currentUserSession.division;
  document.getElementById('exportStartDate').value = '';
  document.getElementById('exportEndDate').value = '';
  document.getElementById('exportModal').classList.remove('hidden');
}

function closeExportModal() {
  document.getElementById('exportModal').classList.add('hidden');
}

async function processExportCSV() {
  const startDate = document.getElementById('exportStartDate').value;
  const endDate = document.getElementById('exportEndDate').value;

  try {
    let query = _supabase.from('event').select('*').eq('division_owner', currentUserSession.division).order('id', { ascending: false });

    if (startDate) query = query.gte('timestamp', startDate);
    if (endDate) query = query.lte('timestamp', endDate);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      alert('Tidak ada data yang sesuai untuk diexport.');
      return;
    }

    const headers = ['id', 'timestamp', 'logged_by', 'location', 'category', 'priority', 'subject', 'details', 'action_taken', 'status', 'link'];
    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const values = headers.map(header => `"${String(row[header] ?? '').replace(/"/g, '""')}"`);
      csvRows.push(values.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `event_${currentUserSession.division}_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    closeExportModal();

  } catch (err) {
    alert('Gagal mengunduh CSV: ' + err.message);
  }
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