// KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://sfblelnbczlvykqemhtm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PAGE_SIZE = 200;
let currentPage = 1;
let totalRows = 0;
let rawDataMap = new Map();
let fetchedData = [];

// Instance TableFilterManager
let tableFilter = null;
let currentSort = { column: 'no', ascending: true };

// Daftar akun yang memiliki hak akses CRUD
const ALLOWED_EDITORS = ["Dede Hidayat", "Sutriono", "Herliana Oktavianti"];

function isSuperAdmin() {
  try {
    const session = localStorage.getItem("user");
    if (!session) return false;
    
    const userData = JSON.parse(session);
    if (!userData) return false;

    const isEditor = ALLOWED_EDITORS.includes(userData.nama) || ALLOWED_EDITORS.includes(userData.username);
    return isEditor || userData.role === "Admin" || userData.role === "SuperAdmin";
  } catch (err) {
    console.error("Gagal verifikasi hak akses editor:", err);
    return false;
  }
}

// JSONB Parsing utilities for "update" column
function getLatestUpdateObj(rawUpdate) {
  if (!rawUpdate) return null;

  try {
    let parsed = (typeof rawUpdate === 'string') ? JSON.parse(rawUpdate) : rawUpdate;

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed[parsed.length - 1];
    } else if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch (e) {
    if (typeof rawUpdate === 'string') {
      const parts = rawUpdate.split(',');
      return {
        date: parts[0]?.trim() || '',
        note: parts[1]?.trim() || ''
      };
    }
  }
  return null;
}

function formatUpdateDisplay(rawUpdate) {
  const latest = getLatestUpdateObj(rawUpdate);
  if (!latest) return '-';

  const dateStr = latest.date || '';
  const noteStr = latest.note ? `, ${latest.note}` : '';
  
  return (dateStr + noteStr).trim() || '-';
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
        <span>Tambah Data HSE</span>
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
      label: "Tambah Data HSE",
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
      subtitle: "Health, Safety, and Environment",
      hamburgerItems: hamburgerMenuOptions
    });
  }

  renderHamburgerMenuContent();

  // Inisialisasi TableFilterManager
  tableFilter = new TableFilterManager({
    tableName: 'hse',
    supabaseClient: _supabase,
    columns: ['no', 'kategori', 'lokasi', 'kondisi', 'spek', 'update', 'dokumentasi'],
    numericColumns: ['no'],
    dateColumns: [],
    popoverId: 'filterPopover',
    containerId: 'filterItemsList',
    searchInputId: 'filterSearchInput',
    selectAllId: 'selectAllCheckbox',
    onFilterChange: () => {
      currentPage = 1;
      fetchTableData();
    }
  });

  fetchTableData();

  _supabase
    .channel('public:hse')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hse' }, () => {
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
  if (popover && !popover.contains(e.target) && !e.target.closest('.filter-icon-btn')) {
    tableFilter.closePopover();
  }
});

window.addEventListener('scroll', (e) => {
  const popover = document.getElementById('filterPopover');
  if (popover && !popover.contains(e.target) && tableFilter) {
    tableFilter.closePopover();
  }
}, true);

function triggerGlobalSearch() {
  const val = document.getElementById('globalSearchInput').value.trim();
  tableFilter.globalSearchQuery = val;
  currentPage = 1;
  document.getElementById('btnClearSearch').classList.toggle('hidden', val === '');
  fetchTableData();
}

function clearGlobalSearch() {
  document.getElementById('globalSearchInput').value = '';
  document.getElementById('btnClearSearch').classList.add('hidden');
  tableFilter.globalSearchQuery = '';
  currentPage = 1;
  fetchTableData();
}

function updateFilterUI() {
  if (!tableFilter) return;
  document.querySelectorAll('.filter-icon-btn').forEach(btn => {
    const colKey = btn.getAttribute('data-col');
    const th = btn.closest('th');
    if (!th) return;

    if (colKey && tableFilter.filterSelections[colKey] && tableFilter.filterSelections[colKey].size > 0) {
      th.classList.add('filter-active');
    } else {
      th.classList.remove('filter-active');
    }
  });
}

function execSort(dir) {
  if (!tableFilter || !tableFilter.activeFilterColumn) return;
  currentSort = {
    column: tableFilter.activeFilterColumn,
    ascending: dir === 'asc'
  };
  tableFilter.closePopover();
  fetchTableData();
}

async function fetchTableData() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Memuat data...</td></tr>`;

  try {
    let countQuery = _supabase.from('hse').select('*', { count: 'exact', head: true });
    countQuery = tableFilter.applyToSupabaseQuery(countQuery, ['lokasi', 'kondisi', 'kategori', 'spek', 'dokumentasi']);

    const { count, error: countErr } = await countQuery;
    if (countErr) throw countErr;

    totalRows = count || 0;
    document.getElementById('totalDataCount').innerText = totalRows;

    if (totalRows === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Data HSE tidak ditemukan.</td></tr>`;
      updatePaginationUI();
      updateFilterUI();
      return;
    }

    const totalPages = Math.ceil(totalRows / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;

    const fromIndex = (currentPage - 1) * PAGE_SIZE;
    const toIndex = Math.min(currentPage * PAGE_SIZE - 1, totalRows - 1);

    let dataQuery = _supabase.from('hse').select('*');
    dataQuery = tableFilter.applyToSupabaseQuery(dataQuery, ['lokasi', 'kondisi', 'kategori', 'spek', 'dokumentasi']);

    if (currentSort.column) {
      dataQuery = dataQuery.order(currentSort.column, { ascending: currentSort.ascending });
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
    updateFilterUI();

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-medium">Gagal memuat data dari Supabase.<br><span class="text-xs text-[#5f6368] dark:text-[#9aa0a6] font-normal">Error: ${err.message}</span></td></tr>`;
  }
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (fetchedData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Tidak ada data yang sesuai filter.</td></tr>`;
    updatePaginationUI();
    return;
  }

  const allowEdit = isSuperAdmin();

  fetchedData.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-[#f8f9fa] dark:hover:bg-[#252525] border-b border-[#f1f3f4] dark:border-[#2d2d2d] text-[#202124] dark:text-[#e8eaed] transition-colors';

    const noBtn = allowEdit 
      ? `<button onclick="openModalForNo(${row.no})" title="Edit Data HSE #${row.no}" class="inline-block px-2 py-0.5 text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-[#e8f0fe] dark:hover:bg-[#2c384e] hover:underline rounded font-medium text-xs transition-colors cursor-pointer">${row.no}</button>`
      : `<span class="inline-block px-2 py-0.5 text-[#5f6368] dark:text-[#9aa0a6] font-mono text-xs">${row.no}</span>`;

    const kondisiVal = String(row.kondisi || '').toLowerCase();
    let kondisiBadgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    if (kondisiVal.includes('baik') || kondisiVal.includes('ok') || kondisiVal.includes('normal')) {
      kondisiBadgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500/20';
    } else if (kondisiVal.includes('rusak') || kondisiVal.includes('buruk') || kondisiVal.includes('bahaya')) {
      kondisiBadgeClass = 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400 border border-red-500/20';
    } else if (kondisiVal.includes('perbaikan') || kondisiVal.includes('pending')) {
      kondisiBadgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-500/20';
    }

    let docHtml = '-';
    if (row.dokumentasi) {
      const docStr = String(row.dokumentasi).trim();
      if (docStr.startsWith('http://') || docStr.startsWith('https://')) {
        docHtml = `<a href="${escapeHtml(docStr)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">🔗 Lihat Dokumentasi</a>`;
      } else {
        docHtml = escapeHtml(docStr);
      }
    }

    const updateFormatted = formatUpdateDisplay(row.update);

    tr.innerHTML = `
      <td class="p-2.5 text-center font-mono">${noBtn}</td>
      <td class="p-2.5 text-[#5f6368] dark:text-[#9aa0a6] truncate">${escapeHtml(row.kategori || '-')}</td>
      <td class="p-2.5 font-medium text-[#202124] dark:text-[#f1f3f4] break-words">${escapeHtml(row.lokasi || '-')}</td>
      <td class="p-2.5 text-center">
        <span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${kondisiBadgeClass}">
          ${escapeHtml(row.kondisi || '-')}
        </span>
      </td>
      <td class="p-2.5 text-[#5f6368] dark:text-[#9aa0a6] break-words">${escapeHtml(row.spek || '-')}</td>
      <td class="p-2.5 text-center text-[#5f6368] dark:text-[#9aa0a6] truncate" title="${escapeHtml(updateFormatted)}">${escapeHtml(updateFormatted)}</td>
      <td class="p-2.5 truncate" title="${escapeHtml(row.dokumentasi || '')}">${docHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  updatePaginationUI();
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
  const form = document.getElementById('hseForm');
  const title = document.getElementById('modalTitle');
  const btnDelete = document.getElementById('btnDeleteInModal');

  form.reset();
  document.getElementById('editNo').value = '';

  if (mode === 'add') {
    title.innerText = 'Tambah Data HSE Baru';
    btnDelete.classList.add('hidden');
    document.getElementById('inputUpdateDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('inputUpdateNote').value = '';
  } else if (mode === 'edit' && data) {
    title.innerText = `Edit Data HSE #${data.no}`;
    btnDelete.classList.remove('hidden');

    document.getElementById('editNo').value = data.no;
    document.getElementById('inputLokasi').value = data.lokasi || '';
    document.getElementById('inputKondisi').value = data.kondisi || '';
    document.getElementById('inputSpek').value = data.spek || '';
    document.getElementById('inputDokumentasi').value = data.dokumentasi || '';
    document.getElementById('inputKategori').value = data.kategori || '';

    const latestUpdate = getLatestUpdateObj(data.update);
    document.getElementById('inputUpdateDate').value = latestUpdate?.date || '';
    document.getElementById('inputUpdateNote').value = latestUpdate?.note || '';
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
  const updateDate = document.getElementById('inputUpdateDate').value.trim();
  const updateNote = document.getElementById('inputUpdateNote').value.trim();

  let updatedHistory = [];

  if (editNo) {
    const existingData = rawDataMap.get(parseInt(editNo, 10)) || rawDataMap.get(editNo);
    let currentHistory = existingData?.update;

    if (typeof currentHistory === 'string') {
      try { 
        currentHistory = JSON.parse(currentHistory); 
      } catch { 
        if (currentHistory.trim()) {
          const parts = currentHistory.split(',');
          currentHistory = [{ date: parts[0]?.trim() || '', note: parts[1]?.trim() || '' }];
        } else {
          currentHistory = [];
        }
      }
    }

    if (Array.isArray(currentHistory)) {
      updatedHistory = [...currentHistory];
    } else if (typeof currentHistory === 'object' && currentHistory !== null) {
      if (currentHistory.date || currentHistory.note) {
        updatedHistory = [currentHistory];
      }
    }

    if (updateDate || updateNote) {
      updatedHistory.push({
        date: updateDate,
        note: updateNote
      });
    }
  } else if (updateDate || updateNote) {
    updatedHistory.push({
      date: updateDate,
      note: updateNote
    });
  }

  const payload = {
    lokasi: document.getElementById('inputLokasi').value.trim() || null,
    kondisi: document.getElementById('inputKondisi').value.trim() || null,
    update: updatedHistory,
    dokumentasi: document.getElementById('inputDokumentasi').value.trim() || null,
    kategori: document.getElementById('inputKategori').value.trim() || null,
    spek: document.getElementById('inputSpek').value.trim() || null
  };

  try {
    if (editNo) {
      const { error } = await _supabase
        .from('hse')
        .update(payload)
        .eq('no', editNo);

      if (error) throw error;
    } else {
      const { data: maxNoData, error: maxNoError } = await _supabase
        .from('hse')
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
        .from('hse')
        .insert([payload]);

      if (error) throw error;
    }

    closeModal();
    if (tableFilter) tableFilter.dbFilterOptions = {};
    await fetchTableData();

  } catch (err) {
    alert('Gagal menyimpan data HSE: ' + err.message);
  }
}

async function deleteDataInModal() {
  if (!isSuperAdmin()) return;
  const no = document.getElementById('editNo').value;
  if (!no) return;

  if (!confirm(`Apakah Anda yakin ingin menghapus data HSE #${no}?`)) return;

  try {
    const { error } = await _supabase
      .from('hse')
      .delete()
      .eq('no', no);

    if (error) throw error;

    closeModal();
    if (tableFilter) tableFilter.dbFilterOptions = {};
    await fetchTableData();

  } catch (err) {
    alert('Gagal menghapus data HSE: ' + err.message);
  }
}

async function exportCSV() {
  try {
    let query = _supabase.from('hse').select('*').order('no', { ascending: true });
    query = tableFilter.applyToSupabaseQuery(query, ['lokasi', 'kondisi', 'kategori', 'spek', 'dokumentasi']);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    const headers = ['no', 'lokasi', 'kondisi', 'update', 'dokumentasi', 'kategori', 'spek'];
    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const values = headers.map(header => {
        let rawVal = row[header];
        if (header === 'update') rawVal = formatUpdateDisplay(rawVal);
        return `"${String(rawVal ?? '').replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hse_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    alert('Gagal mengunduh CSV: ' + err.message);
  }
}