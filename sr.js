const SUPABASE_URL = "https://sfblelnbczlvykqemhtm.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0"; 
const GOOGLE_DRIVE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz1hEe3lHhkLKX_lM0JiG1YB0_3sFsTXzjsT3-wUfwVFdHFbMUSFiOBGZ2sSAKUVBLO/exec";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const PAGE_SIZE = 200;
let currentPage = 1;
let totalRows = 0;
let rawDataMap = new Map();
let fetchedData = [];
let dbFilterOptions = {};

let currentPhotos = { before: "", after: "", objectName: "" };
let selectedFiles = { before: null, after: null };

let activeFilterColumn = null;
let draftFilterSelections = new Set();

let globalSearchQuery = sessionStorage.getItem('sr_globalSearchQuery') || '';
let sortConfig = JSON.parse(sessionStorage.getItem('sr_sortConfig')) || { column: null, direction: null };

let filterSelections = {};
try {
  const savedFilters = JSON.parse(sessionStorage.getItem('sr_filterSelections'));
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

function saveStateToSession() {
  sessionStorage.setItem('sr_globalSearchQuery', globalSearchQuery);
  sessionStorage.setItem('sr_sortConfig', JSON.stringify(sortConfig));

  const serializableFilters = {};
  Object.keys(filterSelections).forEach(key => {
    if (filterSelections[key] && filterSelections[key].size > 0) {
      serializableFilters[key] = Array.from(filterSelections[key]);
    }
  });
  sessionStorage.setItem('sr_filterSelections', JSON.stringify(serializableFilters));
}

function toggleHamburgerMenu(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('customDropdownMenu');
  const container = document.getElementById('custom-hamburger-content');
  if (!dropdown) return;

  if (container && (!container.innerHTML || container.innerHTML.trim() === '')) {
    renderHamburgerMenuContent();
  }
  dropdown.classList.toggle('hidden');
}

function renderHamburgerMenuContent() {
  const container = document.getElementById('custom-hamburger-content');
  if (!container) return;

  container.innerHTML = `
    <button onclick="openFormModal(); toggleHamburgerMenu();" class="w-full text-left px-3 py-2 text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] flex items-center gap-2.5 transition cursor-pointer">
      <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
      <span>Add Report</span>
    </button>
  `;
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

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

document.addEventListener("DOMContentLoaded", () => {
  if (typeof renderHeader === 'function') {
    renderHeader({
      subtitle: "Dokumentasi Perbaikan",
      hamburgerItems: [
        {
          label: "Add Report",
          icon: `<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`,
          onClick: "openFormModal()"
        }
      ]
    });
  }

  renderHamburgerMenuContent();
  setupDropzone('dropzoneBefore', 'before');
  setupDropzone('dropzoneAfter', 'after');

  if (globalSearchQuery) {
    const searchInput = document.getElementById('globalSearchInput');
    const btnClear = document.getElementById('btnClearSearch');
    if (searchInput) searchInput.value = globalSearchQuery;
    if (btnClear) btnClear.classList.remove('hidden');
  }

  fetchTableData();

  db.channel('public:logbook')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'logbook' }, () => {
      fetchTableData();
    })
    .subscribe();
});

document.addEventListener('click', (e) => {
  const popover = document.getElementById('filterPopover');
  if (popover && !popover.classList.contains('hidden') && !popover.contains(e.target) && !e.target.closest('button[onclick*="toggleFilterMenu"]')) {
    closeFilterPopover();
  }

  const dropdown = document.getElementById('customDropdownMenu');
  const btn = document.getElementById('hamburgerBtn');
  if (dropdown && !dropdown.classList.contains('hidden')) {
    if (!dropdown.contains(e.target) && !btn?.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
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
  const allColumns = ['no', 'subject', 'item', 'date', 'notes'];

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
      `subject.ilike.%${globalSearchQuery}%,` +
      `item.ilike.%${globalSearchQuery}%,` +
      `notes.ilike.%${globalSearchQuery}%`
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
  tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Memuat data...</td></tr>`;

  try {
    let countQuery = db.from('logbook').select('*', { count: 'exact', head: true });
    countQuery = applySupabaseFilters(countQuery);

    const { count, error: countErr } = await countQuery;
    if (countErr) throw countErr;

    totalRows = count || 0;
    document.getElementById('totalDataCount').innerText = totalRows;

    if (totalRows === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Data perbaikan tidak ditemukan.</td></tr>`;
      updatePaginationUI();
      updateFilterButtonStyles();
      return;
    }

    const totalPages = Math.ceil(totalRows / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;

    const fromIndex = (currentPage - 1) * PAGE_SIZE;
    const toIndex = Math.min(currentPage * PAGE_SIZE - 1, totalRows - 1);

    let dataQuery = db.from('logbook').select('*');
    dataQuery = applySupabaseFilters(dataQuery);

    if (sortConfig.column && sortConfig.direction) {
      dataQuery = dataQuery.order(sortConfig.column, { ascending: sortConfig.direction === 'asc' });
    } else {
      dataQuery = dataQuery.order('no', { ascending: false });
    }

    dataQuery = dataQuery.range(fromIndex, toIndex);

    const { data, error } = await dataQuery;
    if (error) throw error;

    fetchedData = data || [];
    rawDataMap.clear();
    fetchedData.forEach(row => rawDataMap.set(String(row.no || row.id), row));

    renderTable();

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-500 font-medium">Gagal memuat data dari Supabase.<br><span class="text-xs text-[#5f6368] dark:text-[#9aa0a6] font-normal">Error: ${err.message}</span></td></tr>`;
  }
}

function renderTable() {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (fetchedData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Tidak ada data yang sesuai filter.</td></tr>`;
    updatePaginationUI();
    updateFilterButtonStyles();
    return;
  }

  const startIndex = (currentPage - 1) * PAGE_SIZE;

  fetchedData.forEach((row, index) => {
    const recordId = String(row.no || row.id);
    const tr = document.createElement('tr');
    tr.className = "hover:bg-[#f8f9fa] dark:hover:bg-[#252525] border-b border-[#f1f3f4] dark:border-[#2d2d2d] text-[#202124] dark:text-[#e8eaed] transition-colors";

    tr.innerHTML = `
      <td class="p-2.5 whitespace-nowrap text-center">
        <button onclick="editLogbook('${recordId}')" class="px-2 py-0.5 rounded font-bold text-[#1a73e8] dark:text-[#8ab4f8] hover:underline transition cursor-pointer" title="Edit Data">
          ${startIndex + index + 1}
        </button>
      </td>
      <td class="p-2.5 font-semibold text-[#202124] dark:text-[#f1f3f4] truncate" title="${escapeHtml(row.subject || '')}">${escapeHtml(row.subject || '-')}</td>
      <td class="p-2.5 font-medium truncate" title="${escapeHtml(row.item || '')}">${escapeHtml(row.item || '-')}</td>
      <td class="p-2.5 whitespace-nowrap">${formatDate(row.date)}</td>
      <td class="p-2.5 truncate" title="${escapeHtml(row.notes || '')}">${escapeHtml(row.notes || '-')}</td>
      <td class="p-2.5 text-center whitespace-nowrap">${renderDocumentationCell(row.before, row.after, row.subject || '')}</td>
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
      const { data, error } = await db.from('logbook').select(columnKey);
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
    const displayVal = activeFilterColumn === 'date' ? formatDate(val) : val;
    if (searchVal && !displayVal.toLowerCase().includes(searchVal)) return;

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
    span.innerText = displayVal;
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

function setupDropzone(zoneId, type) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    zone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    zone.addEventListener(eventName, () => zone.classList.add('border-blue-500', 'bg-blue-50/20'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    zone.addEventListener(eventName, () => zone.classList.remove('border-blue-500', 'bg-blue-50/20'), false);
  });

  zone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      processFile(files[0], type);
    }
  });
}

function handleFileSelect(e, type) {
  const file = e.target.files[0];
  if (file) processFile(file, type);
}

function processFile(file, type) {
  selectedFiles[type] = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    showImagePreview(type, e.target.result, file.name);
  };
  reader.readAsDataURL(file);
}

function showImagePreview(type, url, nameText = 'Foto Terpilih') {
  const previewImg = document.getElementById(type === 'before' ? 'imgPreviewBefore' : 'imgPreviewAfter');
  const fileName = document.getElementById(type === 'before' ? 'fileNameBefore' : 'fileNameAfter');
  const container = document.getElementById(type === 'before' ? 'previewContainerBefore' : 'previewContainerAfter');
  const placeholder = document.getElementById(type === 'before' ? 'placeholderBefore' : 'placeholderAfter');

  previewImg.src = url;
  fileName.innerText = nameText;
  container.classList.remove('hidden');
  placeholder.classList.add('hidden');
}

function removeSelectedFile(type) {
  selectedFiles[type] = null;
  document.getElementById(type === 'before' ? 'fileBefore' : 'fileAfter').value = '';
  document.getElementById(type === 'before' ? 'inputFotoBefore' : 'inputFotoAfter').value = '';
  document.getElementById(type === 'before' ? 'previewContainerBefore' : 'previewContainerAfter').classList.add('hidden');
  document.getElementById(type === 'before' ? 'placeholderBefore' : 'placeholderAfter').classList.remove('hidden');
}

function openFormModal(id = null) {
  const form = document.getElementById('logbookForm');
  const btnDelete = document.getElementById('btnDeleteModal');
  form.reset();
  removeSelectedFile('before');
  removeSelectedFile('after');

  if (id) {
    document.getElementById('formModalTitle').innerText = "Edit Logbook";
    if (btnDelete) btnDelete.classList.remove('hidden');

    const target = rawDataMap.get(String(id));
    if (target) {
      const beforeUrl = target.before || '';
      const afterUrl = target.after || '';

      document.getElementById('logbookId').value = target.no || target.id;
      document.getElementById('inputObjek').value = target.subject || '';
      document.getElementById('inputItem').value = target.item || '';
      document.getElementById('inputTanggal').value = target.date || '';
      document.getElementById('inputNotes').value = target.notes || '';
      document.getElementById('inputFotoBefore').value = beforeUrl;
      document.getElementById('inputFotoAfter').value = afterUrl;

      if (beforeUrl) showImagePreview('before', beforeUrl, 'Foto Tersimpan');
      if (afterUrl) showImagePreview('after', afterUrl, 'Foto Tersimpan');
    }
  } else {
    document.getElementById('formModalTitle').innerText = "Add Report";
    document.getElementById('logbookId').value = '';
    if (btnDelete) btnDelete.classList.add('hidden');
  }

  document.getElementById('crudModal').classList.remove('hidden');
}

function closeFormModal() {
  document.getElementById('crudModal').classList.add('hidden');
}

function editLogbook(id) {
  openFormModal(id);
}

async function handleDeleteFromModal() {
  const id = document.getElementById('logbookId').value;
  if (!id) return;
  
  if (confirm("Apakah Anda yakin ingin menghapus data logbook ini secara permanen?")) {
    closeFormModal();
    await deleteLogbook(id);
  }
}

async function uploadToGoogleDrive(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result.split(',')[1];
      const payload = {
        fileName: `logbook_${Date.now()}_${file.name}`,
        mimeType: file.type,
        base64Data: base64Data
      };

      try {
        const response = await fetch(GOOGLE_DRIVE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        const resData = await response.json();
        if (resData.status === 'success') {
          resolve(resData.url);
        } else {
          reject(resData.message || "Gagal mengunggah gambar ke Drive.");
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('btnSaveSubmit');
  submitBtn.disabled = true;

  const id = document.getElementById('logbookId').value;
  const subject = document.getElementById('inputObjek').value;
  const itemVal = document.getElementById('inputItem').value;
  const date = document.getElementById('inputTanggal').value;
  const notes = document.getElementById('inputNotes').value;
  let beforeUrl = document.getElementById('inputFotoBefore').value;
  let afterUrl = document.getElementById('inputFotoAfter').value;

  try {
    if (selectedFiles.before) {
      submitBtn.innerText = "Uploading Foto Before...";
      beforeUrl = await uploadToGoogleDrive(selectedFiles.before);
    }

    if (selectedFiles.after) {
      submitBtn.innerText = "Uploading Foto After...";
      afterUrl = await uploadToGoogleDrive(selectedFiles.after);
    }

    submitBtn.innerText = "Menyimpan ke Supabase...";

    const payload = { 
      subject: subject, 
      item: itemVal,
      date: date, 
      notes: notes,
      before: beforeUrl, 
      after: afterUrl 
    };

    if (id) {
      const { error } = await db.from('logbook').update(payload).eq('no', id);
      if (error) throw error;
    } else {
      const { error } = await db.from('logbook').insert([payload]);
      if (error) throw error;
    }

    closeFormModal();
    dbFilterOptions = {};
    await fetchTableData();

  } catch (err) {
    alert("Gagal memproses data: " + (err.message || err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "Simpan Data";
  }
}

async function deleteLogbook(id) {
  try {
    const { error } = await db
      .from('logbook')
      .delete()
      .eq('no', id);

    if (error) throw error;
    dbFilterOptions = {};
    await fetchTableData();
  } catch (err) {
    alert("Gagal menghapus data: " + err.message);
  }
}

const renderDocumentationCell = (beforeUrl, afterUrl, objectName) => {
  const hasBefore = beforeUrl && (beforeUrl.startsWith('http://') || beforeUrl.startsWith('https://'));
  const hasAfter = afterUrl && (afterUrl.startsWith('http://') || afterUrl.startsWith('https://'));

  if (!hasBefore && !hasAfter) {
    return `<span class="text-[#5f6368] dark:text-[#9aa0a6] italic text-xs">Tidak ada foto</span>`;
  }

  const escapedName = escapeHtml(objectName);
  const cleanBefore = hasBefore ? beforeUrl : "";
  const cleanAfter = hasAfter ? afterUrl : "";
  return `
    <button onclick="openPhotoModal('${cleanBefore}', '${cleanAfter}', '${escapedName}')" class="inline-flex items-center gap-1.5 bg-[#e8f0fe] dark:bg-[#2c384e] hover:bg-[#d2e3fc] dark:hover:bg-[#3a4963] text-[#1a73e8] dark:text-[#8ab4f8] px-2.5 py-1 rounded-full font-medium text-xs border border-[#1a73e8]/20 dark:border-[#8ab4f8]/20 transition cursor-pointer">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
      Foto
    </button>
  `;
};

function openPhotoModal(beforeUrl, afterUrl, objectName) {
  currentPhotos = { before: beforeUrl, after: afterUrl, objectName: objectName };
  if (beforeUrl) {
    changeSlide('before');
  } else if (afterUrl) {
    changeSlide('after');
  }
  document.getElementById('imageModal').classList.remove('hidden');
}

function changeSlide(type) {
  const modalImage = document.getElementById('modalImage');
  const modalTitle = document.getElementById('modalTitle');
  const badge = document.getElementById('modalStatusBadge');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  
  if (type === 'before') {
    modalImage.src = currentPhotos.before;
    modalTitle.innerText = `Before - ${currentPhotos.objectName}`;
    badge.innerText = "BEFORE";
    badge.className = "mt-1 inline-block bg-amber-600 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wider";
    prevBtn.disabled = true;
    nextBtn.disabled = !currentPhotos.after;
  } else if (type === 'after') {
    modalImage.src = currentPhotos.after;
    modalTitle.innerText = `After - ${currentPhotos.objectName}`;
    badge.innerText = "AFTER";
    badge.className = "mt-1 inline-block bg-emerald-600 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wider";
    prevBtn.disabled = !currentPhotos.before;
    nextBtn.disabled = true;
  }
}

function closeModal() {
  document.getElementById('imageModal').classList.add('hidden');
  document.getElementById('modalImage').src = '';
  currentPhotos = { before: "", after: "", objectName: "" };
}
