const SUPABASE_URL = 'https://sfblelnbczlvykqemhtm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Endpoint Google Apps Script untuk Upload ke Google Drive
const GDRIVE_UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbwN3hPHIDqB3eQEduU0-nIbbPZmfh-rN23e2ekn1GJxK-_CyY2OsdFQ_CPnImy9o0cG/exec';

const PAGE_SIZE = 200;
let currentPage = 1;
let totalRows = 0;
let rawDataMap = new Map();
let fetchedData = [];

let dbUsersList = [];
let dbFilterOptions = {}; 
let selectedExportSites = [];

let activeFilterColumn = null;
let filterSelections = {}; 
let draftFilterSelections = new Set(); 
let sortConfig = { column: null, direction: null };

let globalSearchQuery = '';
let selectedPhotoFile = null;

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

// HANDLER TOGGLE HAMBURGER MENU DROPDOWN DENGAN AUTO-RENDER
function toggleHamburgerMenu(e) {
  if (e) e.stopPropagation();
  
  const dropdown = document.getElementById('customDropdownMenu');
  const container = document.getElementById('custom-hamburger-content');
  
  if (!dropdown) return;

  // Render otomatis isi menu jika kontainer di DOM masih kosong
  if (container && (!container.innerHTML || container.innerHTML.trim() === '')) {
    renderHamburgerMenuContent();
  }

  dropdown.classList.toggle('hidden');
}

// Fungsi pembantu untuk merender isi menu hamburger
function renderHamburgerMenuContent() {
  const container = document.getElementById('custom-hamburger-content');
  if (!container) return;

  const items = [];
  if (isSuperAdmin()) {
    items.push(`
      <button onclick="openModal('add'); toggleHamburgerMenu();" class="w-full text-left px-3 py-2 text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] flex items-center gap-2.5 transition cursor-pointer">
        <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        <span>Tambah Asset</span>
      </button>
    `);
  }
  items.push(`
    <button onclick="openExportModal(); toggleHamburgerMenu();" class="w-full text-left px-3 py-2 text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] flex items-center gap-2.5 transition cursor-pointer">
      <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
      <span>Export CSV</span>
    </button>
  `);

  container.innerHTML = items.join('');
}

// Alias fungsi legacy untuk kompatibilitas
function toggleConnDropdown(e) {
  toggleHamburgerMenu(e);
}

document.addEventListener('DOMContentLoaded', () => {
  // Inisialisasi Opsi Hamburger
  const hamburgerMenuOptions = [];
  if (isSuperAdmin()) {
    hamburgerMenuOptions.push({
      label: "Tambah Asset",
      icon: `<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`,
      onClick: "openModal('add')"
    });
  }
  hamburgerMenuOptions.push({
    label: "Export CSV",
    icon: `<svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>`,
    onClick: "openExportModal()"
  });

  if (typeof renderHeader === 'function') {
    renderHeader({
      subtitle: "Assets",
      hamburgerItems: hamburgerMenuOptions
    });
  }

  // Pre-render kontainer hamburger menu
  renderHamburgerMenuContent();

  fetchTableData();
  preloadSuggestions();
  setupDropzone();

  _supabase
    .channel('public:assets')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assets' }, (payload) => {
      handleRealtimeUpdate(payload.new);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'assets' }, () => {
      fetchTableData();
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'assets' }, () => {
      fetchTableData();
    })
    .subscribe();
});

// Setup Drag & Drop Zone
function setupDropzone() {
  const zone = document.getElementById('dropzonePhoto');
  if (!zone) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    zone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    zone.addEventListener(eventName, () => zone.classList.add('border-[#1a73e8]', 'bg-[#e8f0fe]', 'dark:bg-[#2c384e]'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    zone.addEventListener(eventName, () => zone.classList.remove('border-[#1a73e8]', 'bg-[#e8f0fe]', 'dark:bg-[#2c384e]'), false);
  });

  zone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      processFile(files[0]);
    }
  });
}

function processFile(file) {
  selectedPhotoFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    showImagePreview(e.target.result, file.name);
  };
  reader.readAsDataURL(file);
}

function showImagePreview(url, nameText = 'Foto Terpilih') {
  const previewImg = document.getElementById('imgPreviewPhoto');
  const fileName = document.getElementById('fileNamePhoto');
  const container = document.getElementById('previewContainerPhoto');
  const placeholder = document.getElementById('placeholderPhoto');

  if (previewImg) previewImg.src = url;
  if (fileName) fileName.innerText = nameText;
  if (container) container.classList.remove('hidden');
  if (placeholder) placeholder.classList.add('hidden');
}

function removeSelectedFile() {
  selectedPhotoFile = null;
  document.getElementById('inputLink').value = '';
  const container = document.getElementById('previewContainerPhoto');
  const placeholder = document.getElementById('placeholderPhoto');
  if (container) container.classList.add('hidden');
  if (placeholder) placeholder.classList.remove('hidden');
}

// FUNGSI POPUP PREVIEW FOTO TABEL
function openPhotoModal(url, titleName = '') {
  if (!url) return;
  const imageModal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');
  const modalTitle = document.getElementById('modalPhotoTitle');

  if (modalImage) modalImage.src = url;
  if (modalTitle) modalTitle.innerText = titleName ? `Foto - ${titleName}` : 'Preview Foto Asset';
  if (imageModal) imageModal.classList.remove('hidden');
}

function closePhotoModal() {
  const imageModal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');
  if (imageModal) imageModal.classList.add('hidden');
  if (modalImage) modalImage.src = '';
}

function handleRealtimeUpdate(newRow) {
  if (!newRow || !newRow.no) return;

  rawDataMap.set(newRow.no, newRow);

  const idx = fetchedData.findIndex(r => r.no === newRow.no);
  if (idx !== -1) {
    fetchedData[idx] = newRow;
  }

  const tr = document.querySelector(`tr[data-no="${newRow.no}"]`);
  if (!tr) return;

  const photoBtn = newRow.link 
    ? `<button onclick="openPhotoModal('${escapeHtml(newRow.link)}', '${escapeHtml(newRow.aset || '')}')" class="inline-flex items-center gap-1 px-2.5 py-1 bg-[#e8f0fe] dark:bg-[#2c384e] hover:bg-[#d2e3fc] dark:hover:bg-[#3a4963] text-[#1a73e8] dark:text-[#8ab4f8] rounded-full border border-[#1a73e8]/20 dark:border-[#8ab4f8]/20 font-medium text-[11px] transition cursor-pointer">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        Foto
       </button>`
    : `<span class="text-[#5f6368] dark:text-[#9aa0a6] text-[11px]">-</span>`;

  const cellValues = [
    { selector: '.cell-no', html: newRow.no },
    { selector: '.cell-aset', html: escapeHtml(newRow.aset || '-') },
    { selector: '.cell-site', html: escapeHtml(newRow.site || '-') },
    { selector: '.cell-lokasi', html: escapeHtml(newRow.lokasi || '-') },
    { selector: '.cell-pic', html: escapeHtml(newRow.pic || '-'), title: escapeHtml(newRow.pic || '') },
    { selector: '.cell-kondisi', html: escapeHtml(newRow.kondisi || '-') },
    { selector: '.cell-link', html: photoBtn },
    { selector: '.cell-note', html: escapeHtml(newRow.note || '-') }
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

// EVENT LISTENER PENUTUP POPUP & DROPDOWN KETIKA KLIK DI LUAR
document.addEventListener('click', (e) => {
  const popover = document.getElementById('filterPopover');
  if (popover && !popover.classList.contains('hidden') && !popover.contains(e.target) && !e.target.closest('button[onclick*="toggleFilterMenu"]')) {
    closeFilterPopover();
  }

  if (!e.target.closest('#inputPic') && !e.target.closest('#picSuggestList')) {
    const suggestList = document.getElementById('picSuggestList');
    if (suggestList) suggestList.classList.add('hidden');
  }

  const dropdown = document.getElementById('customDropdownMenu');
  const btn = document.getElementById('hamburgerBtn');
  if (dropdown && !dropdown.classList.contains('hidden')) {
    if (!dropdown.contains(e.target) && !btn?.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  }
});

async function preloadSuggestions() {
  try {
    const usersRes = await _supabase.from('users').select('nama').order('nama', { ascending: true });
    if (usersRes.data) {
      dbUsersList = Array.from(new Set(usersRes.data.map(u => u.nama).filter(Boolean)));
    }
  } catch (err) {
    console.error('Gagal mengambil data referensi saran:', err);
  }
}

function handlePicSuggest() {
  const inputVal = document.getElementById('inputPic').value.trim().toLowerCase();
  const listEl = document.getElementById('picSuggestList');
  
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
      document.getElementById('inputPic').value = name;
      listEl.classList.add('hidden');
    };
    listEl.appendChild(itemDiv);
  });

  listEl.classList.remove('hidden');
}

// Fungsi Upload Foto ke Google Drive
async function uploadPhotoFile(file) {
  if (!file) return null;
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64Data = reader.result.split(',')[1];
        const payload = {
          fileName: `asset_${Date.now()}_${file.name}`,
          mimeType: file.type,
          base64Data: base64Data
        };

        const response = await fetch(GDRIVE_UPLOAD_URL, {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.status === 'success' || result.url) {
          resolve(result.url);
        } else {
          reject(new Error(result.message || 'Gagal upload ke Google Drive'));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (error) => reject(error);
  });
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
      `aset.ilike.%${globalSearchQuery}%,` +
      `site.ilike.%${globalSearchQuery}%,` +
      `lokasi.ilike.%${globalSearchQuery}%,` +
      `pic.ilike.%${globalSearchQuery}%,` +
      `kondisi.ilike.%${globalSearchQuery}%,` +
      `note.ilike.%${globalSearchQuery}%`
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
  tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Memuat data...</td></tr>`;

  try {
    let countQuery = _supabase.from('assets').select('*', { count: 'exact', head: true });
    countQuery = applySupabaseFilters(countQuery);

    const { count, error: countErr } = await countQuery;
    if (countErr) throw countErr;

    totalRows = count || 0;

    // UPDATE COUNTER TOTAL ASSET SEPERTI PADA LOGISTICS
    const counterEl = document.getElementById('totalDataCount');
    if (counterEl) counterEl.innerText = totalRows;

    if (totalRows === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Tidak ditemukan aset yang sesuai.</td></tr>`;
      updatePaginationUI();
      return;
    }

    const totalPages = Math.ceil(totalRows / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;

    const fromIndex = (currentPage - 1) * PAGE_SIZE;
    const toIndex = Math.min(currentPage * PAGE_SIZE - 1, totalRows - 1);

    let dataQuery = _supabase.from('assets').select('*');
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
    tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Tidak ada data yang sesuai filter.</td></tr>`;
    updatePaginationUI();
    return;
  }

  const allowEdit = isSuperAdmin();

  fetchedData.forEach(row => {
    const tr = document.createElement('tr');
    tr.setAttribute('data-no', row.no);
    tr.className = 'hover:bg-[#f8f9fa] dark:hover:bg-[#252525] border-b border-[#f1f3f4] dark:border-[#2d2d2d] text-[#202124] dark:text-[#e8eaed] transition-colors';

    const photoBtn = row.link 
      ? `<button onclick="openPhotoModal('${escapeHtml(row.link)}', '${escapeHtml(row.aset || '')}')" class="inline-flex items-center gap-1 px-2.5 py-1 bg-[#e8f0fe] dark:bg-[#2c384e] hover:bg-[#d2e3fc] dark:hover:bg-[#3a4963] text-[#1a73e8] dark:text-[#8ab4f8] rounded-full border border-[#1a73e8]/20 dark:border-[#8ab4f8]/20 font-medium text-[11px] transition cursor-pointer">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          Foto
         </button>`
      : `<span class="text-[#5f6368] dark:text-[#9aa0a6] text-[11px]">-</span>`;

    const noCellContent = allowEdit 
      ? `<button onclick="openModalForNo(${row.no})" title="Edit Asset #${row.no}" class="font-mono text-[#1a73e8] dark:text-[#8ab4f8] hover:underline font-bold">${row.no}</button>`
      : `<span class="font-mono text-[#5f6368] dark:text-[#9aa0a6]">${row.no}</span>`;

    tr.innerHTML = `
      <td class="cell-no p-2 text-center">${noCellContent}</td>
      <td class="cell-aset p-2 font-medium text-[#202124] dark:text-[#f1f3f4] break-words">${escapeHtml(row.aset || '-')}</td>
      <td class="cell-site p-2 text-center font-semibold text-[#5f6368] dark:text-[#bdc1c6] truncate">${escapeHtml(row.site || '-')}</td>
      <td class="cell-lokasi p-2 text-[#5f6368] dark:text-[#bdc1c6] break-words">${escapeHtml(row.lokasi || '-')}</td>
      <td class="cell-pic p-2 truncate" title="${escapeHtml(row.pic || '')}">${escapeHtml(row.pic || '-')}</td>
      <td class="cell-kondisi p-2 text-[#5f6368] dark:text-[#bdc1c6] truncate">${escapeHtml(row.kondisi || '-')}</td>
      <td class="cell-link p-2 text-center">${photoBtn}</td>
      <td class="cell-note p-2 text-[#5f6368] dark:text-[#bdc1c6] break-words">${escapeHtml(row.note || '-')}</td>
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
        .from('assets')
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
  const form = document.getElementById('assetsForm');
  const title = document.getElementById('modalTitle');
  const btnDelete = document.getElementById('btnDeleteInModal');

  form.reset();
  removeSelectedFile();
  document.getElementById('editNo').value = '';
  const uploadStatus = document.getElementById('uploadStatusText');
  if (uploadStatus) uploadStatus.innerText = '';

  if (mode === 'add') {
    title.innerText = 'Tambah Asset Baru';
    btnDelete.classList.add('hidden');
  } else if (mode === 'edit' && data) {
    title.innerText = `Edit Asset #${data.no}`;
    btnDelete.classList.remove('hidden');

    document.getElementById('editNo').value = data.no;
    document.getElementById('inputAset').value = data.aset || '';
    document.getElementById('inputSite').value = data.site || '';
    document.getElementById('inputLokasi').value = data.lokasi || '';
    document.getElementById('inputPic').value = data.pic || '';
    document.getElementById('inputKondisi').value = data.kondisi || '';
    document.getElementById('inputLink').value = data.link || '';
    document.getElementById('inputNote').value = data.note || '';

    if (data.link) showImagePreview(data.link, 'Foto Tersimpan');
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

async function getNextAssetNo() {
  const { data, error } = await _supabase
    .from('assets')
    .select('no')
    .order('no', { ascending: false })
    .limit(1);

  if (error) throw error;
  
  if (data && data.length > 0 && data[0].no) {
    return Number(data[0].no) + 1;
  }
  return 1;
}

async function saveData(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('btnSaveSubmit');
  if (submitBtn) submitBtn.disabled = true;

  const statusEl = document.getElementById('uploadStatusText');

  const no = document.getElementById('editNo').value;
  const aset = document.getElementById('inputAset').value.trim();
  const site = document.getElementById('inputSite').value.trim() || null;
  const lokasi = document.getElementById('inputLokasi').value.trim() || null;
  const pic = document.getElementById('inputPic').value.trim() || null;
  const kondisi = document.getElementById('inputKondisi').value.trim() || null;
  let link = document.getElementById('inputLink').value.trim() || null;
  const note = document.getElementById('inputNote').value.trim() || null;

  try {
    if (selectedPhotoFile) {
      if (statusEl) statusEl.innerText = 'Mengunggah ke GDrive...';
      link = await uploadPhotoFile(selectedPhotoFile);
    }

    if (statusEl) statusEl.innerText = 'Menyimpan data...';

    const payload = {
      aset,
      site,
      lokasi,
      pic,
      kondisi,
      link,
      note
    };

    if (no) {
      const { error } = await _supabase
        .from('assets')
        .update(payload)
        .eq('no', no);
      if (error) throw error;
    } else {
      const newNo = await getNextAssetNo();
      payload.no = newNo;

      const { error } = await _supabase
        .from('assets')
        .insert([payload]);
      if (error) throw error;
    }

    closeModal();
    dbFilterOptions = {}; 

  } catch (err) {
    alert('Gagal menyimpan data: ' + err.message);
    if (statusEl) statusEl.innerText = 'Gagal menyimpan.';
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function deleteDataInModal() {
  const no = document.getElementById('editNo').value;
  if (!no) return;

  if (!confirm(`Apakah Anda yakin ingin menghapus asset #${no}?`)) return;

  try {
    const { error } = await _supabase
      .from('assets')
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
      .from('assets')
      .select('site')
      .not('site', 'is', null);

    if (error) throw error;

    const sites = Array.from(new Set(data.map(i => i.site).filter(Boolean))).sort();
    selectedExportSites = [...sites];

    renderExportSiteCheckboxes(sites);
    modal.classList.remove('hidden');

  } catch (err) {
    alert('Gagal memuat daftar site untuk export: ' + err.message);
  }
}

function closeExportModal() {
  document.getElementById('exportModal').classList.add('hidden');
}

function renderExportSiteCheckboxes(siteList = null) {
  const container = document.getElementById('exportSitesContainer');

  if (!siteList) {
    const cbs = container.querySelectorAll('.export-site-cb');
    siteList = Array.from(cbs).map(cb => cb.value);
  }

  container.innerHTML = '';

  siteList.forEach(site => {
    const isChecked = selectedExportSites.includes(site);

    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 text-[11px] text-[#202124] dark:text-[#e8eaed] hover:bg-[#e8eaed] dark:hover:bg-[#2d2d2d] p-1 rounded cursor-pointer truncate';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = site;
    checkbox.checked = isChecked;
    checkbox.onchange = (e) => handleExportSiteCbChange(e.target);
    checkbox.className = 'export-site-cb rounded border-[#dadce0] dark:border-[#3c4043] text-[#137333] dark:text-[#81c995] focus:ring-0 bg-transparent';

    label.appendChild(checkbox);

    const span = document.createElement('span');
    span.className = 'truncate';
    span.title = site;
    span.innerText = site;
    label.appendChild(span);

    container.appendChild(label);
  });

  document.getElementById('exportSiteCount').innerText = `Terpilih: ${selectedExportSites.length}/${siteList.length}`;
  document.getElementById('exportSelectAllCb').checked = (selectedExportSites.length === siteList.length && siteList.length > 0);
}

function handleExportSiteCbChange(cb) {
  if (cb.checked) {
    if (!selectedExportSites.includes(cb.value)) selectedExportSites.push(cb.value);
  } else {
    selectedExportSites = selectedExportSites.filter(i => i !== cb.value);
  }

  const allCbs = document.querySelectorAll('.export-site-cb');
  document.getElementById('exportSiteCount').innerText = `Terpilih: ${selectedExportSites.length}/${allCbs.length}`;
  document.getElementById('exportSelectAllCb').checked = (selectedExportSites.length === allCbs.length);
}

function toggleSelectAllExportSites(checked) {
  const cbs = document.querySelectorAll('.export-site-cb');
  selectedExportSites = [];

  cbs.forEach(cb => {
    cb.checked = checked;
    if (checked) selectedExportSites.push(cb.value);
  });

  document.getElementById('exportSiteCount').innerText = `Terpilih: ${selectedExportSites.length}/${cbs.length}`;
}

async function processExportCSV() {
  if (selectedExportSites.length === 0) {
    alert('Silakan pilih minimal satu site untuk diexport.');
    return;
  }

  try {
    let query = _supabase
      .from('assets')
      .select('*')
      .in('site', selectedExportSites)
      .order('no', { ascending: true });

    const { data, error } = await query;

    if (error) throw error;
    if (!data || data.length === 0) {
      alert('Tidak ada data yang sesuai dengan site yang dipilih.');
      return;
    }

    const headers = ['no', 'aset', 'site', 'lokasi', 'pic', 'kondisi', 'link', 'note'];
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
    link.setAttribute('download', `assets_export_${new Date().toISOString().slice(0,10)}.csv`);
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