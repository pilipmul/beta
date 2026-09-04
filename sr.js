const SUPABASE_URL = "https://sfblelnbczlvykqemhtm.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0"; 
const GOOGLE_DRIVE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz1hEe3lHhkLKX_lM0JiG1YB0_3sFsTXzjsT3-wUfwVFdHFbMUSFiOBGZ2sSAKUVBLO/exec";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// State Global
let rawLogbookList = []; 
let fullData = [];       
let filteredData = [];   
let currentPhotos = { before: "", after: "", objectName: "" };
let selectedFiles = { before: null, after: null };

// Paginasi & Filter
let currentPage = 1;
const rowsPerPage = 100;
let activeColIndex = -1;
let currentAppliedFilters = {};

const menu = document.getElementById('filterMenu');
const searchBox = document.getElementById('menuSearch');
const masterCheckbox = document.getElementById('masterCheckbox');

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

function toggleConnDropdown(e) {
  toggleHamburgerMenu(e);
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

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function triggerGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  const query = input ? input.value.trim().toLowerCase() : '';
  const btnClear = document.getElementById('btnClearSearch');

  if (query !== '') {
    if (btnClear) btnClear.classList.remove('hidden');
  } else {
    if (btnClear) btnClear.classList.add('hidden');
  }

  filteredData = fullData.filter(row => {
    const matchesSearch = query === '' || row.some(cell => String(cell).toLowerCase().includes(query));
    let matchesFilters = true;
    for (let colIdx in currentAppliedFilters) {
      if (!currentAppliedFilters[colIdx].includes(String(row[colIdx]))) {
        matchesFilters = false;
        break;
      }
    }
    return matchesSearch && matchesFilters;
  });

  currentPage = 1;
  renderTable();
}

function clearGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  if (input) input.value = '';
  triggerGlobalSearch();
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
  fetchSupabaseData();
});

async function fetchSupabaseData() {
  const tableBody = document.getElementById('tableBody');
  try {
    const { data, error } = await db
      .from('logbook')
      .select('*')
      .order('no', { ascending: false });

    if (error) throw error;

    rawLogbookList = data || [];
    
    fullData = rawLogbookList.map((item) => {
      const recordId = item.no || item.id || '';
      const objekNama = item.subject || item.objek || '';
      const itemNama = item.item || '';
      const tanggalVal = item.date || item.tanggal || '';
      const notesVal = item.notes || item.catatan || '';
      const fotoBefore = item.before || item.foto_before || '';
      const fotoAfter = item.after || item.foto_after || '';

      return [
        String(recordId), // index 0
        objekNama,        // index 1
        itemNama,         // index 2
        tanggalVal ? formatDate(tanggalVal) : '', // index 3
        notesVal,         // index 4
        fotoBefore,       // index 5
        fotoAfter,        // index 6
        tanggalVal        // index 7
      ];
    });

    reapplyFilter();

  } catch (error) {
    console.error("Supabase Error:", error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-red-500 font-medium">
          Gagal memuat data logbook dari Supabase.<br>
          <span class="text-xs text-[#5f6368] dark:text-[#9aa0a6] font-normal">Error: ${error.message || 'Periksa koneksi/kebijakan RLS'}</span>
        </td>
      </tr>`;
  }
}

function renderTable() {
  const tableBody = document.getElementById('tableBody');
  const counterEl = document.getElementById('totalDataCount');
  const totalRecords = document.getElementById('totalRecords');
  const showingRecords = document.getElementById('showingRecords');
  const currentPageNum = document.getElementById('currentPageNum');
  const totalPageNum = document.getElementById('totalPageNum');
  
  tableBody.innerHTML = '';

  const totalRows = filteredData.length;
  if (counterEl) counterEl.innerText = totalRows;

  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
  
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows);

  if (totalRows === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Data perbaikan tidak ditemukan.</td></tr>`;
    totalRecords.innerText = 0;
    showingRecords.innerText = "0 - 0";
    currentPageNum.innerText = 1;
    totalPageNum.innerText = 1;
    document.getElementById('btnPrevPage').disabled = true;
    document.getElementById('btnNextPage').disabled = true;
    return;
  }

  const pageData = filteredData.slice(startIndex, endIndex);

  pageData.forEach((row, index) => {
    const recordId = row[0];
    const tr = document.createElement('tr');
    tr.className = "hover:bg-[#f8f9fa] dark:hover:bg-[#252525] border-b border-[#f1f3f4] dark:border-[#2d2d2d] text-[#202124] dark:text-[#e8eaed] transition-colors";
    
    tr.innerHTML = `
      <td class="p-2.5 whitespace-nowrap text-center">
        <button onclick="editLogbook('${recordId}')" class="px-2 py-0.5 rounded font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition cursor-pointer" title="Edit Data">
          ${startIndex + index + 1}
        </button>
      </td>
      <td class="p-2.5 font-semibold">${row[1] || '-'}</td>
      <td class="p-2.5 font-medium">${row[2] || '-'}</td>
      <td class="p-2.5 whitespace-nowrap">${row[3] || '-'}</td>
      <td class="p-2.5 truncate">${row[4] || '-'}</td>
      <td class="p-2.5 text-center whitespace-nowrap">${renderDocumentationCell(row[5], row[6], row[1])}</td>
    `;
    tableBody.appendChild(tr);
  });

  totalRecords.innerText = totalRows;
  showingRecords.innerText = `${startIndex + 1} - ${endIndex}`;
  currentPageNum.innerText = currentPage;
  totalPageNum.innerText = totalPages;

  document.getElementById('btnPrevPage').disabled = (currentPage === 1);
  document.getElementById('btnNextPage').disabled = (currentPage === totalPages);
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

    const target = rawLogbookList.find(item => String(item.no || item.id) === String(id));
    if (target) {
      const beforeUrl = target.before || target.foto_before || '';
      const afterUrl = target.after || target.foto_after || '';

      document.getElementById('logbookId').value = target.no || target.id;
      document.getElementById('inputObjek').value = target.subject || target.objek || '';
      document.getElementById('inputItem').value = target.item || '';
      document.getElementById('inputTanggal').value = target.date || target.tanggal || '';
      document.getElementById('inputNotes').value = target.notes || target.catatan || '';
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
    await fetchSupabaseData();

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
    await fetchSupabaseData();
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

  const escapedName = objectName.replace(/'/g, "\\'");
  const cleanBefore = hasBefore ? beforeUrl : "";
  const cleanAfter = hasAfter ? afterUrl : "";
  return `
    <button onclick="openPhotoModal('${cleanBefore}', '${cleanAfter}', '${escapedName}')" class="inline-flex items-center gap-1.5 bg-[#f1f3f4] dark:bg-[#2d2d2d] hover:bg-[#e8eaed] dark:hover:bg-[#3c4043] text-[#202124] dark:text-[#e8eaed] px-2.5 py-1 rounded-md font-medium text-xs border border-[#dadce0] dark:border-[#3c4043] transition cursor-pointer">
      <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
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

function reapplyFilter() {
  triggerGlobalSearch();
}

function toggleFilterMenu(e, element) {
  activeColIndex = parseInt(element.getAttribute('data-col'));
  const btnRect = element.getBoundingClientRect();
  
  menu.style.display = 'block';
  menu.style.top = (btnRect.bottom + 4) + 'px';
  menu.style.left = Math.min(btnRect.left, window.innerWidth - 270) + 'px';
  
  searchBox.value = '';
  const dataFilteredByOthers = fullData.filter(r => {
    for (let colIdx in currentAppliedFilters) {
      if (parseInt(colIdx) === activeColIndex) continue; 
      if (!currentAppliedFilters[colIdx].includes(String(r[colIdx]))) return false;
    }
    return true;
  });

  const availableVals = [...new Set(dataFilteredByOthers.map(r => String(r[activeColIndex])))].sort();
  const currentlyChecked = currentAppliedFilters[activeColIndex] || availableVals;

  const list = document.getElementById('checkboxList');
  list.innerHTML = '';
  availableVals.forEach(v => {
    const isChecked = currentlyChecked.includes(v);
    list.innerHTML += `<label class="checkbox-item"><input type="checkbox" ${isChecked ? 'checked' : ''} value="${v}" onclick="updateMasterCheckbox()" class="rounded text-blue-600 focus:ring-0"> <span>${v ? v : '-'}</span></label>`;
  });
  updateMasterCheckbox();
  e.stopPropagation();
}

function searchInMenu() {
  const filter = searchBox.value.toLowerCase();
  document.querySelectorAll('#checkboxList .checkbox-item').forEach(item => {
    item.style.display = item.innerText.toLowerCase().includes(filter) ? "flex" : "none";
  });
}

function toggleAllCheckboxes(state) {
  document.querySelectorAll('#checkboxList input[type="checkbox"]').forEach(cb => {
    if (cb.parentElement.style.display !== 'none') cb.checked = state;
  });
}

function updateMasterCheckbox() {
  const cbs = Array.from(document.querySelectorAll('#checkboxList input[type="checkbox"]'));
  masterCheckbox.checked = cbs.length > 0 && cbs.every(cb => cb.checked);
}

function resetCurrentFilter() {
  searchBox.value = '';
  masterCheckbox.checked = true;
  toggleAllCheckboxes(true);
  searchInMenu();
}

function closeFilterMenu() {
  menu.style.display = 'none';
}

function execSort(dir) {
  filteredData.sort((a, b) => {
    let valA = a[activeColIndex], valB = b[activeColIndex];
    if(activeColIndex === 3) { 
      valA = a[7] || ''; 
      valB = b[7] || '';
    }
    return dir === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
  });
  currentPage = 1;
  renderTable();
  closeFilterMenu();
}

function applyCheckboxFilter() {
  const cbs = Array.from(document.querySelectorAll('#checkboxList input[type="checkbox"]'));
  const checkedVals = cbs.filter(i => i.checked).map(i => i.value);
  const isAllChecked = cbs.every(cb => cb.checked);
  const targetTh = document.querySelector(`.filter-icon-btn[data-col="${activeColIndex}"]`).closest('th');
  
  if (!isAllChecked) {
    targetTh.classList.add('filter-active');
    currentAppliedFilters[activeColIndex] = checkedVals;
  } else {
    targetTh.classList.remove('filter-active');
    delete currentAppliedFilters[activeColIndex];
  }

  reapplyFilter();
  closeFilterMenu();
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderTable();
  }
}

function nextPage() {
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderTable();
  }
}

document.addEventListener('click', (e) => {
  if (menu && !menu.contains(e.target) && !e.target.closest('.filter-icon-btn')) {
    closeFilterMenu();
  }
  const dropdown = document.getElementById('customDropdownMenu');
  const btn = document.getElementById('hamburgerBtn');
  if (dropdown && !dropdown.classList.contains('hidden')) {
    if (!dropdown.contains(e.target) && !btn?.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  }
});

document.getElementById('imageModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

if (menu) menu.onclick = (e) => e.stopPropagation();