const SUPABASE_URL = 'https://sfblelnbczlvykqemhtm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PAGE_SIZE = 200;
let currentPage = 1;
let totalRows = 0;
let rawDataMap = new Map();
let fetchedData = [];

let dbUsersList = [];
let dbItemsList = [];
let dbFilterOptions = {}; 
let selectedExportItems = [];

let activeFilterColumn = null;
let filterSelections = {}; 
let draftFilterSelections = new Set(); 
let sortConfig = { column: null, direction: null };

let globalSearchQuery = '';

function isSuperAdmin() {
  try {
    const session = localStorage.getItem("user");
    if (!session) return false;
    const userData = JSON.parse(session);
    return userData && (userData.nama === "Dede Hidayat" || userData.username === "Dede Hidayat");
  } catch (err) {
    return false;
  }
}

// TOGGLE HANDLER UTAMA HAMBURGER DROPDOWN
function toggleConnDropdown(e) {
  if (e) e.stopPropagation();
  
  const dropdown = document.getElementById('customDropdownMenu') || 
                   document.getElementById('hamburgerMenuDropdown') || 
                   document.getElementById('connDropdown');
                   
  if (dropdown) {
    dropdown.classList.toggle('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // CONFIG MENU HAMBURGER OPSI (TAMBAH ITEM & EXPORT CSV)
  const hamburgerMenuOptions = [];
  if (isSuperAdmin()) {
    hamburgerMenuOptions.push({
      label: "Tambah Item",
      icon: `<svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`,
      onClick: "openModal('add')"
    });
  }
  hamburgerMenuOptions.push({
    label: "Export CSV",
    icon: `<svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>`,
    onClick: "openExportModal()"
  });

  if (typeof renderHeader === 'function') {
    renderHeader({ 
      subtitle: "Logistics",
      hamburgerItems: hamburgerMenuOptions 
    });
  }

  // MANUAL RENDER JIKA CUSTOM CONTAINER BELUM TERISI OLEH TEMPLATE
  const customContainer = document.getElementById('custom-hamburger-content');
  if (customContainer && customContainer.innerHTML.trim() === '') {
    customContainer.innerHTML = hamburgerMenuOptions.map(item => `
      <button onclick="${item.onClick}; toggleConnDropdown();" class="w-full text-left px-3 py-2 hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] flex items-center gap-2.5 text-xs text-[#202124] dark:text-[#e8eaed] transition cursor-pointer">
        ${item.icon}
        <span>${item.label}</span>
      </button>
    `).join('');
  }

  fetchTableData();
  preloadSuggestions();

  // REALTIME LISTENER SUPABASE
  _supabase
    .channel('public:inventory')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'inventory' }, (payload) => {
      handleRealtimeUpdate(payload.new);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inventory' }, () => {
      fetchTableData();
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'inventory' }, () => {
      fetchTableData();
    })
    .subscribe();
});

// DELEGATED CLICK EVENT FOR ALL DROPDOWNS & HAMBURGER
document.addEventListener('click', (e) => {
  // Handler khusus tombol 3 garis
  const btn = e.target.closest('#hamburgerBtn') || e.target.closest('button[onclick*="toggleConnDropdown"]');
  const dropdown = document.getElementById('customDropdownMenu') || 
                   document.getElementById('hamburgerMenuDropdown') || 
                   document.getElementById('connDropdown');

  if (btn) {
    e.stopPropagation();
    toggleConnDropdown(e);
    return;
  }

  // Tutup hamburger jika klik diluar
  if (dropdown && !dropdown.classList.contains('hidden')) {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  }

  // Tutup Filter Popover jika klik diluar
  const popover = document.getElementById('filterPopover');
  if (popover && !popover.classList.contains('hidden') && !popover.contains(e.target) && !e.target.closest('button[onclick*="toggleFilterMenu"]')) {
    closeFilterPopover();
  }

  // Auto suggest dropdown list close
  if (!e.target.closest('#inputUser') && !e.target.closest('#userSuggestList')) {
    const el = document.getElementById('userSuggestList');
    if (el) el.classList.add('hidden');
  }
  if (!e.target.closest('#inputItem') && !e.target.closest('#itemSuggestList')) {
    const el = document.getElementById('itemSuggestList');
    if (el) el.classList.add('hidden');
  }
});

function handleRealtimeUpdate(newRow) {
  if (!newRow || !newRow.no) return;

  rawDataMap.set(newRow.no, newRow);

  const idx = fetchedData.findIndex(r => r.no === newRow.no);
  if (idx !== -1) {
    fetchedData[idx] = newRow;
  }

  const tr = document.querySelector(`tr[data-no="${newRow.no}"]`);
  if (!tr) return;

  const allowEdit = isSuperAdmin();
  const projectText = newRow.project ? escapeHtml(newRow.project) : (allowEdit ? 'Edit' : '-');
  const projectBtn = allowEdit 
    ? `<button onclick="openModalForNo(${newRow.no})" title="Edit Transaksi #${newRow.no}" class="inline-block max-w-full px-2.5 py-0.5 bg-[#e8f0fe] dark:bg-[#2c384e] hover:bg-[#d2e3fc] dark:hover:bg-[#3a4963] text-[#1a73e8] dark:text-[#8ab4f8] rounded-full border border-[#1a73e8]/20 dark:border-[#8ab4f8]/20 font-medium text-[11px] truncate transition cursor-pointer">${projectText}</button>`
    : `<span class="inline-block max-w-full px-2 py-0.5 text-[#5f6368] dark:text-[#9aa0a6] text-[11px] truncate">${projectText}</span>`;

  const cellValues = [
    { selector: '.cell-no', html: newRow.no },
    { selector: '.cell-user', html: escapeHtml(newRow.user || '-'), title: escapeHtml(newRow.user || '') },
    { selector: '.cell-item', html: escapeHtml(newRow.item || '-') },
    { selector: '.cell-in', html: newRow.in ?? '' },
    { selector: '.cell-out', html: newRow.out ?? '' },
    { selector: '.cell-date', html: escapeHtml(newRow.date || '-') },
    { selector: '.cell-note', html: escapeHtml(newRow.note || '-') },
    { selector: '.cell-trx_code', html: escapeHtml(newRow.trx_code || '-') },
    { selector: '.cell-balance', html: newRow.balance ?? '-' },
    { selector: '.cell-project', html: projectBtn }
  ];

  cellValues.forEach(col => {
    const cell = tr.querySelector(col.selector);
    if (cell) {
      if (cell.innerHTML !== String(col.html)) {
        cell.innerHTML = col.html;
      }
      if (col.title !== undefined) {
        cell.title = col.title;
      }
    }
  });
}

async function preloadSuggestions() {
  try {
    const [usersRes, itemsRes] = await Promise.all([
      _supabase.from('users').select('nama').order('nama', { ascending: true }),
      _supabase.from('item').select('item').order('item', { ascending: true })
    ]);

    if (usersRes.data) {
      dbUsersList = Array.from(new Set(usersRes.data.map(u => u.nama).filter(Boolean)));
    }
    if (itemsRes.data) {
      dbItemsList = Array.from(new Set(itemsRes.data.map(i => i.item).filter(Boolean)));
    }
  } catch (err) {
    console.error('Gagal mengambil data referensi saran:', err);
  }
}

function handleUserSuggest() {
  const inputVal = document.getElementById('inputUser').value.trim().toLowerCase();
  const listEl = document.getElementById('userSuggestList');
  
  if (!inputVal) {
    listEl.classList.add('hidden');
    listEl.innerHTML = '';
    return;
  }

  const filtered = dbUsersList.filter(name => name.toLowerCase().includes(inputVal));
  if (filtered.length === 0) {
    listEl.classList.add('hidden');
    return;
  }

  listEl.innerHTML = '';
  filtered.forEach(name => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'px-3 py-1.5 hover:bg-[#e8f0fe] dark:hover:bg-[#2c384e] hover:text-[#1a73e8] dark:hover:text-[#8ab4f8] text-[#202124] dark:text-[#e8eaed] cursor-pointer transition';
    itemDiv.innerText = name;
    itemDiv.onclick = () => {
      document.getElementById('inputUser').value = name;
      listEl.classList.add('hidden');
    };
    listEl.appendChild(itemDiv);
  });

  listEl.classList.remove('hidden');
}

function handleItemSuggest() {
  const inputVal = document.getElementById('inputItem').value.trim().toLowerCase();
  const listEl = document.getElementById('itemSuggestList');
  
  if (!inputVal) {
    listEl.classList.add('hidden');
    listEl.innerHTML = '';
    return;
  }

  const filtered = dbItemsList.filter(item => item.toLowerCase().includes(inputVal));
  if (filtered.length === 0) {
    listEl.classList.add('hidden');
    return;
  }

  listEl.innerHTML = '';
  filtered.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'px-3 py-1.5 hover:bg-[#e8f0fe] dark:hover:bg-[#2c384e] hover:text-[#1a73e8] dark:hover:text-[#8ab4f8] text-[#202124] dark:text-[#e8eaed] cursor-pointer transition';
    itemDiv.innerText = item;
    itemDiv.onclick = () => {
      document.getElementById('inputItem').value = item;
      listEl.classList.add('hidden');
    };
    listEl.appendChild(itemDiv);
  });

  listEl.classList.remove('hidden');
}

function triggerGlobalSearch() {
  const val = document.getElementById('globalSearchInput').value.trim();
  globalSearchQuery = val;
  currentPage = 1;

  const btnClear = document.getElementById('btnClearSearch');
  if (val !== '') {
    btnClear.classList.remove('hidden');
  } else {
    btnClear.classList.add('hidden');
  }

  fetchTableData();
}

function clearGlobalSearch() {
  document.getElementById('globalSearchInput').value = '';
  document.getElementById('btnClearSearch').classList.add('hidden');
  globalSearchQuery = '';
  currentPage = 1;
  fetchTableData();
}

function applySupabaseFilters(query) {
  if (globalSearchQuery !== '') {
    query = query.or(
      `user.ilike.%${globalSearchQuery}%,` +
      `item.ilike.%${globalSearchQuery}%,` +
      `note.ilike.%${globalSearchQuery}%,` +
      `trx_code.ilike.%${globalSearchQuery}%,` +
      `project.ilike.%${globalSearchQuery}%`
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
    let countQuery = _supabase.from('inventory').select('*', { count: 'exact', head: true });
    countQuery = applySupabaseFilters(countQuery);

    const { count, error: countErr } = await countQuery;
    if (countErr) throw countErr;

    totalRows = count || 0;
    document.getElementById('totalDataCount').innerText = totalRows;

    if (totalRows === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Tidak ditemukan transaksi yang sesuai.</td></tr>`;
      updatePaginationUI();
      return;
    }

    const totalPages = Math.ceil(totalRows / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;

    const fromIndex = (currentPage - 1) * PAGE_SIZE;
    const toIndex = Math.min(currentPage * PAGE_SIZE - 1, totalRows - 1);

    let dataQuery = _supabase.from('inventory').select('*');
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
    alert('Gagal mengambil data: ' + err.message);
  }
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (fetchedData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Tidak ada data yang sesuai filter.</td></tr>`;
    updatePaginationUI();
    return;
  }

  const allowEdit = isSuperAdmin();

  fetchedData.forEach(row => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-no', row.no);
    tr.className = 'hover:bg-[#f8f9fa] dark:hover:bg-[#252525] border-b border-[#f1f3f4] dark:border-[#2d2d2d] text-[#202124] dark:text-[#e8eaed] transition-colors';

    const projectText = row.project ? escapeHtml(row.project) : (allowEdit ? 'Edit' : '-');
    
    const projectBtn = allowEdit 
      ? `<button onclick="openModalForNo(${row.no})" title="Edit Transaksi #${row.no}" class="inline-block max-w-full px-2.5 py-0.5 bg-[#e8f0fe] dark:bg-[#2c384e] hover:bg-[#d2e3fc] dark:hover:bg-[#3a4963] text-[#1a73e8] dark:text-[#8ab4f8] rounded-full border border-[#1a73e8]/20 dark:border-[#8ab4f8]/20 font-medium text-[11px] truncate transition cursor-pointer">${projectText}</button>`
      : `<span class="inline-block max-w-full px-2 py-0.5 text-[#5f6368] dark:text-[#9aa0a6] text-[11px] truncate">${projectText}</span>`;

    tr.innerHTML = `
      <td class="cell-no p-2 text-center font-mono text-[#5f6368] dark:text-[#9aa0a6]">${row.no}</td>
      <td class="cell-user p-2 truncate" title="${escapeHtml(row.user || '')}">${escapeHtml(row.user || '-')}</td>
      <td class="cell-item p-2 font-medium text-[#202124] dark:text-[#f1f3f4] break-words">${escapeHtml(row.item || '-')}</td>
      <td class="cell-in p-2 text-center text-[#137333] dark:text-[#81c995] font-semibold">${row.in ?? ''}</td>
      <td class="cell-out p-2 text-center text-[#d93025] dark:text-[#f28b82] font-semibold">${row.out ?? ''}</td>
      <td class="cell-date p-2 font-mono text-[#5f6368] dark:text-[#9aa0a6] truncate">${escapeHtml(row.date || '-')}</td>
      <td class="cell-note p-2 text-[#5f6368] dark:text-[#bdc1c6] break-words">${escapeHtml(row.note || '-')}</td>
      <td class="cell-trx_code p-2 font-mono text-[#5f6368] dark:text-[#9aa0a6] break-all">${escapeHtml(row.trx_code || '-')}</td>
      <td class="cell-balance p-2 text-center text-[#202124] dark:text-[#f1f3f4] bg-[#f8f9fa] dark:bg-[#252525] font-bold">${row.balance ?? '-'}</td>
      <td class="cell-project p-2 text-center">${projectBtn}</td>
    `;
    tbody.appendChild(tr);
  });

  updatePaginationUI();
}

async function toggleFilterMenu(columnKey, event) {
  event.stopPropagation();
  activeFilterColumn = columnKey;

  const popover = document.getElementById('filterPopover');
  const rect = event.currentTarget.getBoundingClientRect();
  
  let leftPos = rect.left + window.scrollX - 100;
  if (leftPos < 8) leftPos = 8;
  const maxLeft = window.innerWidth - 250;
  if (leftPos > maxLeft) leftPos = maxLeft;

  popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
  popover.style.left = `${leftPos}px`;

  document.getElementById('filterSearchInput').value = '';
  
  if (!dbFilterOptions[columnKey]) {
    try {
      const { data, error } = await _supabase
        .from('inventory')
        .select(columnKey);
      if (!error && data) {
        const allVals = data.map(r => (r[columnKey] !== null && r[columnKey] !== undefined && r[columnKey] !== '') ? String(r[columnKey]) : '-');
        dbFilterOptions[columnKey] = Array.from(new Set(allVals)).sort();
      } else {
        dbFilterOptions[columnKey] = Array.from(new Set(fetchedData.map(r => (r[columnKey] !== null && r[columnKey] !== undefined && r[columnKey] !== '') ? String(r[columnKey]) : '-'))).sort();
      }
    } catch (e) {
      dbFilterOptions[columnKey] = Array.from(new Set(fetchedData.map(r => (r[columnKey] !== null && r[columnKey] !== undefined && r[columnKey] !== '') ? String(r[columnKey]) : '-'))).sort();
    }
  }

  const activeSaved = filterSelections[activeFilterColumn];
  const allOpts = dbFilterOptions[activeFilterColumn] || [];

  if (activeSaved && activeSaved.size > 0) {
    draftFilterSelections = new Set(activeSaved);
  } else {
    draftFilterSelections = new Set(allOpts);
  }

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

  let visibleCount = 0;
  let visibleCheckedCount = 0;

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
    checkbox.className = 'filter-cb rounded border-[#dadce0] dark:border-[#3c4043] text-[#1a73e8] dark:text-[#8ab4f8] focus:ring-0 bg-transparent';
    
    checkbox.onchange = (e) => {
      if (e.target.checked) {
        draftFilterSelections.add(val);
      } else {
        draftFilterSelections.delete(val);
      }
      updateSelectAllState();
    };

    label.appendChild(checkbox);

    const span = document.createElement('span');
    span.className = 'truncate';
    span.title = val;
    span.innerText = val;
    label.appendChild(span);

    container.appendChild(label);
  });

  const selectAllCb = document.getElementById('selectAllCheckbox');
  if (selectAllCb) {
    selectAllCb.checked = visibleCount > 0 && visibleCheckedCount === visibleCount;
  }
}

function updateSelectAllState() {
  const container = document.getElementById('filterItemsList');
  const cbs = container.querySelectorAll('.filter-cb');
  let allChecked = cbs.length > 0;

  cbs.forEach(cb => {
    if (!cb.checked) allChecked = false;
  });

  const selectAllCb = document.getElementById('selectAllCheckbox');
  if (selectAllCb) selectAllCb.checked = allChecked;
}

function toggleSelectAllFilters(checked) {
  const container = document.getElementById('filterItemsList');
  const cbs = container.querySelectorAll('.filter-cb');

  cbs.forEach(cb => {
    cb.checked = checked;
    if (checked) {
      draftFilterSelections.add(cb.value);
    } else {
      draftFilterSelections.delete(cb.value);
    }
  });
}

function clearFilterColumn() {
  delete filterSelections[activeFilterColumn];
  const allOpts = dbFilterOptions[activeFilterColumn] || [];
  draftFilterSelections = new Set(allOpts);
  
  document.getElementById('filterSearchInput').value = '';
  renderFilterCheckboxes();
  
  currentPage = 1;
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
  fetchTableData();
}

function applySort(direction) {
  sortConfig = { column: activeFilterColumn, direction };
  closeFilterPopover();
  
  currentPage = 1;
  fetchTableData();
}

function updatePaginationUI() {
  const totalPages = Math.ceil(totalRows / PAGE_SIZE) || 1;
  
  const startRow = totalRows === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(currentPage * PAGE_SIZE, totalRows);

  document.getElementById('pageInfo').innerText = `Menampilkan ${startRow}-${endRow} dari ${totalRows} data`;
  document.getElementById('totalPagesText').innerText = `/ ${totalPages}`;
  document.getElementById('jumpPageInput').value = currentPage;

  document.getElementById('btnPrev').disabled = (currentPage <= 1);
  document.getElementById('btnNext').disabled = (currentPage >= totalPages);
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
  const form = document.getElementById('inventoryForm');
  const title = document.getElementById('modalTitle');
  const btnDelete = document.getElementById('btnDeleteInModal');

  form.reset();
  document.getElementById('editNo').value = '';

  if (mode === 'add') {
    title.innerText = 'Tambah Transaksi Baru';
    btnDelete.classList.add('hidden');
    document.getElementById('inputDate').value = new Date().toISOString().slice(0, 10);
  } else if (mode === 'edit' && data) {
    title.innerText = `Edit Transaksi #${data.no}`;
    btnDelete.classList.remove('hidden');

    document.getElementById('editNo').value = data.no;
    document.getElementById('inputUser').value = data.user || '';
    document.getElementById('inputItem').value = data.item || '';
    document.getElementById('inputIn').value = data.in ?? '';
    document.getElementById('inputOut').value = data.out ?? '';
    document.getElementById('inputDate').value = data.date || '';
    document.getElementById('inputTrxCode').value = data.trx_code || '';
    document.getElementById('inputNote').value = data.note || '';
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

  const no = document.getElementById('editNo').value;
  const user = document.getElementById('inputUser').value.trim();
  const item = document.getElementById('inputItem').value.trim();
  const inVal = document.getElementById('inputIn').value ? parseInt(document.getElementById('inputIn').value, 10) : null;
  const outVal = document.getElementById('inputOut').value ? parseInt(document.getElementById('inputOut').value, 10) : null;
  const date = document.getElementById('inputDate').value || null;
  const trx_code = document.getElementById('inputTrxCode').value.trim() || null;
  const note = document.getElementById('inputNote').value.trim() || null;

  const payload = {
    user,
    item,
    in: inVal,
    out: outVal,
    date,
    trx_code,
    note
  };

  try {
    if (no) {
      const { error } = await _supabase
        .from('inventory')
        .update(payload)
        .eq('no', no);
      if (error) throw error;
    } else {
      const { error } = await _supabase
        .from('inventory')
        .insert([payload]);
      if (error) throw error;
    }

    closeModal();
    dbFilterOptions = {}; 

  } catch (err) {
    alert('Gagal menyimpan data: ' + err.message);
  }
}

async function deleteDataInModal() {
  const no = document.getElementById('editNo').value;
  if (!no) return;

  if (!confirm(`Apakah Anda yakin ingin menghapus transaksi #${no}?`)) return;

  try {
    const { error } = await _supabase
      .from('inventory')
      .delete()
      .eq('no', no);

    if (error) throw error;

    closeModal();
    dbFilterOptions = {}; 

  } catch (err) {
    alert('Gagal menghapus data: ' + err.message);
  }
}

async function openExportModal() {
  const modal = document.getElementById('exportModal');
  
  try {
    const { data, error } = await _supabase
      .from('inventory')
      .select('item')
      .not('item', 'is', null);

    if (error) throw error;

    const items = Array.from(new Set(data.map(i => i.item).filter(Boolean))).sort();
    selectedExportItems = [...items];

    renderExportItemCheckboxes(items);

    document.getElementById('exportItemSearch').value = '';
    document.getElementById('exportStartDate').value = '';
    document.getElementById('exportEndDate').value = '';

    modal.classList.remove('hidden');

  } catch (err) {
    alert('Gagal memuat daftar item untuk export: ' + err.message);
  }
}

function closeExportModal() {
  document.getElementById('exportModal').classList.add('hidden');
}

function renderExportItemCheckboxes(itemList = null) {
  const container = document.getElementById('exportItemsContainer');
  const searchVal = document.getElementById('exportItemSearch').value.trim().toLowerCase();

  if (!itemList) {
    const cbs = container.querySelectorAll('.export-item-cb');
    itemList = Array.from(cbs).map(cb => cb.value);
  }

  container.innerHTML = '';

  let totalVisible = 0;
  itemList.forEach(item => {
    if (searchVal && !item.toLowerCase().includes(searchVal)) return;

    totalVisible++;
    const isChecked = selectedExportItems.includes(item);

    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 text-[11px] text-[#202124] dark:text-[#e8eaed] hover:bg-[#e8eaed] dark:hover:bg-[#2d2d2d] p-1 rounded cursor-pointer truncate';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = item;
    checkbox.checked = isChecked;
    checkbox.onchange = (e) => handleExportItemCbChange(e.target);
    checkbox.className = 'export-item-cb rounded border-[#dadce0] dark:border-[#3c4043] text-[#137333] dark:text-[#81c995] focus:ring-0 bg-transparent';

    label.appendChild(checkbox);

    const span = document.createElement('span');
    span.className = 'truncate';
    span.title = item;
    span.innerText = item;
    label.appendChild(span);

    container.appendChild(label);
  });

  document.getElementById('exportItemCount').innerText = `Terpilih: ${selectedExportItems.length}/${itemList.length}`;
  document.getElementById('exportSelectAllCb').checked = (selectedExportItems.length === itemList.length && itemList.length > 0);
}

function handleExportItemCbChange(cb) {
  if (cb.checked) {
    if (!selectedExportItems.includes(cb.value)) selectedExportItems.push(cb.value);
  } else {
    selectedExportItems = selectedExportItems.filter(i => i !== cb.value);
  }

  const allCbs = document.querySelectorAll('.export-item-cb');
  document.getElementById('exportItemCount').innerText = `Terpilih: ${selectedExportItems.length}/${allCbs.length}`;
  document.getElementById('exportSelectAllCb').checked = (selectedExportItems.length === allCbs.length);
}

function toggleSelectAllExportItems(checked) {
  const cbs = document.querySelectorAll('.export-item-cb');
  selectedExportItems = [];

  cbs.forEach(cb => {
    cb.checked = checked;
    if (checked) selectedExportItems.push(cb.value);
  });

  document.getElementById('exportItemCount').innerText = `Terpilih: ${selectedExportItems.length}/${cbs.length}`;
}

async function processExportCSV() {
  if (selectedExportItems.length === 0) {
    alert('Silakan pilih minimal satu item untuk diexport.');
    return;
  }

  const startDate = document.getElementById('exportStartDate').value;
  const endDate = document.getElementById('exportEndDate').value;

  try {
    let query = _supabase
      .from('inventory')
      .select('*')
      .in('item', selectedExportItems)
      .order('no', { ascending: true });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    if (!data || data.length === 0) {
      alert('Tidak ada data yang sesuai dengan filter yang dipilih.');
      return;
    }

    const headers = ['no', 'user', 'item', 'in', 'out', 'date', 'note', 'trx_code', 'balance', 'project'];
    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const values = headers.map(header => {
        const val = row[header] ?? '';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventory_export_${new Date().toISOString().slice(0,10)}.csv`);
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