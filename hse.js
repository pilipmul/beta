// KONFIGURASI SUPABASE
const SUPABASE_URL = 'https://sfblelnbczlvykqemhtm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PAGE_SIZE = 200;
let currentPage = 1;
let totalRows = 0;
let rawDataMap = new Map();
let fetchedData = [];

// Hak akses BO pengguna ('PBM' | 'PBC' | 'TCBU')
let userAllowedBo = (window.userBo || '').toString().trim().toUpperCase();

// Instance TableFilterManager
let tableFilter = null;
let currentSort = { column: 'no', ascending: true };

function canWriteHSE() {
  if (typeof window.canWriteModule === 'function') {
    return window.canWriteModule('hse');
  }
  return window.hseAccessLevel === 'W';
}

// Ambil kolom 'bo' dari tabel 'users' di Supabase
async function loadUserBoFromSupabase() {
  try {
    const rawSession = localStorage.getItem('user') || sessionStorage.getItem('user');
    const parsedSession = rawSession ? JSON.parse(rawSession) : null;
    const userData = window.currentUserData || (parsedSession && (parsedSession.data || parsedSession)) || null;

    const urlParams = new URLSearchParams(window.location.search);
    const urlUser = urlParams.get('user');

    const uname = (
      (userData && (userData.nama || userData.username)) ||
      urlUser ||
      ''
    ).toString().trim().toLowerCase();

    if (uname === 'dede hidayat') {
      userAllowedBo = 'TCBU';
      applyBoModalRestriction();
      return;
    }

    let query = _supabase.from('users').select('bo');

    if (userData && userData.id) {
      query = query.eq('id', userData.id);
    } else if (userData && userData.email) {
      query = query.ilike('email', userData.email.trim());
    } else if (userData && userData.username) {
      query = query.ilike('username', userData.username.trim());
    } else if (userData && userData.nama) {
      query = query.ilike('nama', userData.nama.trim());
    } else if (urlUser) {
      query = query.ilike('nama', urlUser.trim());
    } else {
      applyBoModalRestriction();
      return;
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Gagal mengambil kolom bo dari tabel users:', error);
    } else if (data && data.bo) {
      userAllowedBo = String(data.bo).trim().toUpperCase();
      window.userBo = userAllowedBo;

      // Sinkronkan kembali ke session storage agar konsisten
      if (parsedSession) {
        if (parsedSession.data) parsedSession.data.bo = userAllowedBo;
        else parsedSession.bo = userAllowedBo;

        if (localStorage.getItem('user')) {
          localStorage.setItem('user', JSON.stringify(parsedSession));
        }
        if (sessionStorage.getItem('user')) {
          sessionStorage.setItem('user', JSON.stringify(parsedSession));
        }
      }
    }

    applyBoModalRestriction();
  } catch (err) {
    console.error('Error saat memuat BO user:', err);
  }
}

// Terapkan pembatasan BO ke query Supabase
function applyUserBoFilter(query) {
  if (userAllowedBo === 'PBM') {
    return query.ilike('bo', 'PBM');
  }
  if (userAllowedBo === 'PBC') {
    return query.ilike('bo', 'PBC');
  }
  if (userAllowedBo === 'TCBU') {
    return query.in('bo', ['PBM', 'PBC', 'pbm', 'pbc']);
  }
  // Jika BO user belum terdaftar/tidak valid, blokir hasil query
  return query.eq('bo', '__NO_ACCESS__');
}

// Kunci atau buka pilihan BO di form modal sesuai hak akses
function applyBoModalRestriction() {
  const inputBo = document.getElementById('inputBo');
  if (!inputBo) return;

  if (userAllowedBo === 'PBM' || userAllowedBo === 'PBC') {
    inputBo.value = userAllowedBo;
    inputBo.disabled = true;
  } else if (userAllowedBo === 'TCBU') {
    inputBo.disabled = !canWriteHSE();
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
  if (canWriteHSE()) {
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
  if (str === null || str === undefined) return '';
  const qDouble = String.fromCharCode(34);
  const qSingle = String.fromCharCode(39);
  return String(str)
    .split('&').join('&')
    .split('<').join('<')
    .split('>').join('>')
    .split(qDouble).join('"')
    .split(qSingle).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof renderHeader === 'function') {
    renderHeader();
  }

  renderHamburgerMenuContent();

  // Ambil BO pengguna terlebih dahulu sebelum inisialisasi filter & fetch data
  await loadUserBoFromSupabase();

  // Inisialisasi TableFilterManager
  tableFilter = new TableFilterManager({
    tableName: 'hse',
    supabaseClient: _supabase,
    columns: ['no', 'bo', 'kategori', 'lokasi', 'kondisi', 'spek', 'update', 'dokumentasi'],
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
    if (tableFilter) tableFilter.closePopover();
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
  tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Memuat data...</td></tr>`;

  try {
    if (!userAllowedBo) {
      await loadUserBoFromSupabase();
    }

    let countQuery = _supabase.from('hse').select('*', { count: 'exact', head: true });
    countQuery = applyUserBoFilter(countQuery);
    countQuery = tableFilter.applyToSupabaseQuery(countQuery, ['bo', 'lokasi', 'kondisi', 'kategori', 'spek', 'dokumentasi']);

    const { count, error: countErr } = await countQuery;
    if (countErr) throw countErr;

    totalRows = count || 0;
    document.getElementById('totalDataCount').innerText = totalRows;

    if (totalRows === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Data HSE tidak ditemukan.</td></tr>`;
      updatePaginationUI();
      updateFilterUI();
      return;
    }

    const totalPages = Math.ceil(totalRows / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;

    const fromIndex = (currentPage - 1) * PAGE_SIZE;
    const toIndex = Math.min(currentPage * PAGE_SIZE - 1, totalRows - 1);

    let dataQuery = _supabase.from('hse').select('*');
    dataQuery = applyUserBoFilter(dataQuery);
    dataQuery = tableFilter.applyToSupabaseQuery(dataQuery, ['bo', 'lokasi', 'kondisi', 'kategori', 'spek', 'dokumentasi']);

    if (currentSort.column) {
      dataQuery = dataQuery.order(currentSort.column, { ascending: currentSort.ascending });
    } else {
      dataQuery = dataQuery.order('no', { ascending: true });
    }

    dataQuery = dataQuery.range(fromIndex, toIndex);

    const { data, error } = await dataQuery;
    if (error) throw error;

    // Lapis pengaman tambahan di sisi FE agar hanya BO sesuai hak akses yang tampil
    fetchedData = (data || []).filter(row => {
      const rowBo = String(row.bo || '').trim().toUpperCase();
      if (userAllowedBo === 'PBM') return rowBo === 'PBM';
      if (userAllowedBo === 'PBC') return rowBo === 'PBC';
      if (userAllowedBo === 'TCBU') return rowBo === 'PBM' || rowBo === 'PBC';
      return false;
    });

    rawDataMap.clear();
    fetchedData.forEach(row => rawDataMap.set(row.no, row));

    renderTable();
    updateFilterUI();

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-red-500 font-medium">Gagal memuat data dari Supabase.<br><span class="text-xs text-[#5f6368] dark:text-[#9aa0a6] font-normal">Error: ${escapeHtml(err.message)}</span></td></tr>`;
  }
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (fetchedData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Tidak ada data yang sesuai filter.</td></tr>`;
    updatePaginationUI();
    return;
  }

  const allowEdit = canWriteHSE();

  fetchedData.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-[#f8f9fa] dark:hover:bg-[#252525] border-b border-[#f1f3f4] dark:border-[#2d2d2d] text-[#202124] dark:text-[#e8eaed] transition-colors';

    const noBtn = `<button onclick="openModalForNo(${row.no})" title="${allowEdit ? 'Edit Data HSE' : 'Lihat Detail HSE'} #${row.no}" class="inline-block px-2 py-0.5 text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-[#e8f0fe] dark:hover:bg-[#2c384e] hover:underline rounded font-medium text-xs transition-colors cursor-pointer">${row.no}</button>`;

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
    const boFormatted = row.bo ? String(row.bo).toUpperCase() : '-';

    tr.innerHTML = `
      <td class="p-2.5 text-center font-mono">${noBtn}</td>
      <td class="p-2.5 text-center font-bold text-[#202124] dark:text-[#f1f3f4] uppercase truncate">${escapeHtml(boFormatted)}</td>
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
  const allowWrite = canWriteHSE();

  if (mode === 'add' && !allowWrite) {
    alert("Anda hanya memiliki akses Read Only pada modul HSE.");
    return;
  }

  const modal = document.getElementById('modal');
  const form = document.getElementById('hseForm');
  const title = document.getElementById('modalTitle');
  const btnDelete = document.getElementById('btnDeleteInModal');
  const btnSave = document.getElementById('btnSaveHse');

  form.reset();
  document.getElementById('editNo').value = '';

  if (mode === 'add') {
    title.innerText = 'Tambah Data HSE Baru';
    btnDelete.classList.add('hidden');
    if (userAllowedBo === 'PBM' || userAllowedBo === 'PBC') {
      document.getElementById('inputBo').value = userAllowedBo;
    } else {
      document.getElementById('inputBo').value = 'PBC';
    }
    document.getElementById('inputUpdateDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('inputUpdateNote').value = '';
  } else if (mode === 'edit' && data) {
    const rowBo = data.bo ? String(data.bo).trim().toUpperCase() : '';
    if (userAllowedBo !== 'TCBU' && rowBo !== userAllowedBo) {
      alert("Anda tidak memiliki akses untuk membuka data BO ini.");
      return;
    }

    title.innerText = allowWrite ? `Edit Data HSE #${data.no}` : `Detail Data HSE #${data.no}`;
    if (allowWrite) {
      btnDelete.classList.remove('hidden');
    } else {
      btnDelete.classList.add('hidden');
    }

    document.getElementById('editNo').value = data.no;
    document.getElementById('inputBo').value = rowBo;
    document.getElementById('inputLokasi').value = data.lokasi || '';
    document.getElementById('inputKondisi').value = data.kondisi || '';
    document.getElementById('inputSpek').value = data.spek || '';
    document.getElementById('inputDokumentasi').value = data.dokumentasi || '';
    document.getElementById('inputKategori').value = data.kategori || '';

    const latestUpdate = getLatestUpdateObj(data.update);
    document.getElementById('inputUpdateDate').value = latestUpdate?.date || '';
    document.getElementById('inputUpdateNote').value = latestUpdate?.note || '';
  }

  // Kunci form jika user hanya memiliki izin Read Only (R)
  form.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach(el => {
    el.disabled = !allowWrite;
  });

  // Kunci field BO khusus jika user hanya punya 1 BO (PBM atau PBC)
  if (allowWrite && (userAllowedBo === 'PBM' || userAllowedBo === 'PBC')) {
    document.getElementById('inputBo').disabled = true;
  }

  if (btnSave) {
    btnSave.classList.toggle('hidden', !allowWrite);
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
  if (!canWriteHSE()) {
    alert("Anda hanya memiliki akses Read Only pada modul HSE.");
    return;
  }

  const editNo = document.getElementById('editNo').value;
  const updateDate = document.getElementById('inputUpdateDate').value.trim();
  const updateNote = document.getElementById('inputUpdateNote').value.trim();

  // Pastikan nilai BO sesuai hak akses pengguna
  const boVal = (userAllowedBo === 'PBM' || userAllowedBo === 'PBC')
    ? userAllowedBo
    : (document.getElementById('inputBo').value.trim().toUpperCase() || null);

  if (boVal !== 'PBM' && boVal !== 'PBC') {
    alert("Branch Office (BO) harus PBM atau PBC.");
    return;
  }

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
    bo: boVal,
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
  if (!canWriteHSE()) {
    alert("Anda hanya memiliki akses Read Only pada modul HSE.");
    return;
  }
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
    query = applyUserBoFilter(query);
    query = tableFilter.applyToSupabaseQuery(query, ['bo', 'lokasi', 'kondisi', 'kategori', 'spek', 'dokumentasi']);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      alert('Tidak ada data untuk diexport.');
      return;
    }

    const headers = ['no', 'bo', 'lokasi', 'kondisi', 'update', 'dokumentasi', 'kategori', 'spek'];
    const csvRows = [headers.join(',')];

    const qDouble = String.fromCharCode(34);
    data.forEach(row => {
      const values = headers.map(header => {
        let rawVal = row[header];
        if (header === 'update') rawVal = formatUpdateDisplay(rawVal);
        if (header === 'bo' && rawVal) rawVal = String(rawVal).toUpperCase();
        const escaped = String(rawVal ?? '').split(qDouble).join(qDouble + qDouble);
        return `${qDouble}${escaped}${qDouble}`;
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
