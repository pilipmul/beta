const SUPABASE_URL = "https://sfblelnbczlvykqemhtm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0";
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLE_NAME = "rkm";

const VALID_PICS = ["GA", "Head Ops.", "ME", "TRO", "FA", "Head FA", "Security", "All", "CS", "Kasir", "MKT"];
let selectedPicsArray = [];

const PAGE_SIZE = 200;
let currentPage = 1;
let totalRows = 0;

// DATA CACHE UTAMA
let allMasterData = [];    // Menyimpan seluruh data asli dari Supabase
let filteredData = [];     // Menyimpan data hasil filter & pencarian frontend
let rawDataMap = new Map();

// INSTANCE TABLE FILTER MANAGER
let tableFilter;

// PEMBACAAN DATA USER DARI LOCALSTORAGE
let usernameFromStorage = "Tamu";
try {
  const userSession = JSON.parse(localStorage.getItem("user"));
  if (userSession) {
    const uData = userSession.data || userSession;
    if (uData && uData.nama) {
      usernameFromStorage = uData.nama;
    }
  }
} catch (err) {
  console.error("Gagal membaca session:", err);
}

const CURRENT_USER = usernameFromStorage;
const ALLOWED_EDITORS = ["Dede Hidayat", "Sutriono", "Herliana Oktavianti"];
const isEditor = ALLOWED_EDITORS.includes(CURRENT_USER);

let globalSearchQuery = sessionStorage.getItem('rkm_globalSearchQuery') || '';
let sortConfig = JSON.parse(sessionStorage.getItem('rkm_sortConfig')) || { column: null, direction: null };

function initTableFilter() {
  tableFilter = new TableFilterManager({
    tableName: TABLE_NAME,
    supabaseClient: _supabase,
    columns: ['Tanggal', 'Sumber', 'Case', 'PIC', 'Update', 'Target', 'Status'],
    dateColumns: ['Tanggal', 'tanggal'],
    globalSearchQuery: globalSearchQuery,
    onFilterChange: () => {
      currentPage = 1;
      saveStateToSession();
      processAndRenderData();
    }
  });

  // Restore saved filter selections
  try {
    const savedFilters = JSON.parse(sessionStorage.getItem('rkm_filterSelections'));
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
}

function saveStateToSession() {
  sessionStorage.setItem('rkm_globalSearchQuery', globalSearchQuery);
  sessionStorage.setItem('rkm_sortConfig', JSON.stringify(sortConfig));

  if (tableFilter) {
    const serializableFilters = {};
    Object.keys(tableFilter.filterSelections).forEach(key => {
      if (tableFilter.filterSelections[key] && tableFilter.filterSelections[key].size > 0) {
        serializableFilters[key] = Array.from(tableFilter.filterSelections[key]);
      }
    });
    sessionStorage.setItem('rkm_filterSelections', JSON.stringify(serializableFilters));
  }
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

  const items = [];
  if (isEditor) {
    items.push(`
      <button onclick="openModal(); toggleHamburgerMenu();" class="w-full text-left px-3 py-2 text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] flex items-center gap-2.5 transition cursor-pointer">
        <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        <span>New Agenda</span>
      </button>
    `);
  }

  items.push(`
    <button onclick="exportToPDF(); toggleHamburgerMenu();" class="w-full text-left px-3 py-2 text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#2d2d2d] flex items-center gap-2.5 transition cursor-pointer border-t border-[#dadce0] dark:border-[#3c4043]">
      <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
      <span>Export PDF</span>
    </button>
  `);

  container.innerHTML = items.join('');
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

document.addEventListener("DOMContentLoaded", () => {
  initTableFilter();

  const hamburgerMenuOptions = [];
  if (isEditor) {
    hamburgerMenuOptions.push({
      label: "New Agenda",
      icon: `<svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`,
      onClick: "openModal()"
    });
  }

  hamburgerMenuOptions.push({
    label: "Export PDF",
    icon: `<svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`,
    onClick: "exportToPDF()"
  });

  if (typeof renderHeader === 'function') {
    renderHeader({
      subtitle: "Rapat Kerja Mingguan",
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
    .channel('public:rkm')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLE_NAME }, (payload) => {
      updateSingleRowInDOM(payload.new);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE_NAME }, () => {
      fetchTableData();
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: TABLE_NAME }, () => {
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

function focusPicInput() {
  document.getElementById("inpPicSearch").focus();
}

function handlePicSelect(input) {
  const val = input.value.trim();
  const match = VALID_PICS.find(p => p.toLowerCase() === val.toLowerCase());

  if (match) {
    if (!selectedPicsArray.includes(match)) {
      selectedPicsArray.push(match);
      renderPicTags();
    }
    input.value = "";
  }
}

function removePic(picName) {
  selectedPicsArray = selectedPicsArray.filter(p => p !== picName);
  renderPicTags();
}

function renderPicTags() {
  const container = document.getElementById("picTagContainer");
  const inputSearch = document.getElementById("inpPicSearch");

  container.querySelectorAll(".pic-tag").forEach(el => el.remove());

  selectedPicsArray.forEach(pic => {
    const tag = document.createElement("span");
    tag.className = "pic-tag dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800";
    tag.innerHTML = `${pic} <span class="btn-remove" onclick="removePic('${pic}')">&times;</span>`;
    container.insertBefore(tag, inputSearch);
  });
}

function handleSearchInput(input) {
  const val = input.value;
  const btnClear = document.getElementById('btnClearSearch');
  if (btnClear) {
    btnClear.classList.toggle('hidden', val.trim() === '');
  }
}

function triggerGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  globalSearchQuery = input ? input.value.trim() : '';
  if (tableFilter) tableFilter.globalSearchQuery = globalSearchQuery;
  currentPage = 1;
  saveStateToSession();
  processAndRenderData();
}

function clearGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  if (input) input.value = '';
  document.getElementById('btnClearSearch')?.classList.add('hidden');
  globalSearchQuery = '';
  if (tableFilter) tableFilter.globalSearchQuery = '';
  currentPage = 1;
  saveStateToSession();
  processAndRenderData();
}

function processAndRenderData() {
  let result = [...allMasterData];

  // Global search filtering
  if (globalSearchQuery !== '') {
    const q = globalSearchQuery.toLowerCase();
    result = result.filter(item => {
      const tanggal = String(item.Tanggal || item.tanggal || '').toLowerCase();
      const sumber = String(item.Sumber || item.sumber || '').toLowerCase();
      const caseTxt = String(item.Case || item.case || '').toLowerCase();
      const pic = String(item.PIC || item.pic || '').toLowerCase();
      const update = String(item.Update || item.update || '').toLowerCase();
      const target = String(item.Target || item.target || '').toLowerCase();
      const status = String(item.Status || item.status || '').toLowerCase();

      return tanggal.includes(q) || sumber.includes(q) || caseTxt.includes(q) || 
             pic.includes(q) || update.includes(q) || target.includes(q) || status.includes(q);
    });
  }

  // Column filter selections using TableFilterManager state
  if (tableFilter) {
    const filters = tableFilter.filterSelections;
    for (const colKey in filters) {
      const selectedSet = filters[colKey];
      if (selectedSet && selectedSet.size > 0) {
        result = result.filter(item => {
          const val = item[colKey] !== null && item[colKey] !== undefined && item[colKey] !== '' ? String(item[colKey]) : '-';
          if (colKey === 'PIC') {
            return Array.from(selectedSet).some(selectedPic => {
              if (selectedPic === '-') return !item.PIC;
              return val.toLowerCase().includes(selectedPic.toLowerCase());
            });
          }
          return selectedSet.has(val);
        });
      }
    }
  }

  // Sorting
  if (sortConfig.column && sortConfig.direction) {
    const col = sortConfig.column;
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      const valA = String(a[col] || '').toLowerCase();
      const valB = String(b[col] || '').toLowerCase();
      return valA.localeCompare(valB) * dir;
    });
  } else {
    result.sort((a, b) => String(b.Tanggal || '').localeCompare(String(a.Tanggal || '')));
  }

  filteredData = result;
  totalRows = filteredData.length;
  document.getElementById("totalDataCount").innerText = totalRows;

  renderTablePage();
}

async function fetchTableData() {
  const tbody = document.getElementById("rkmTableBody");
  tbody.innerHTML = '<tr><td colspan="7" class="text-center text-[#5f6368] dark:text-[#9aa0a6] py-8">Memuat data RKM...</td></tr>';

  try {
    const { data, error } = await _supabase.from(TABLE_NAME).select('*');
    if (error) throw error;

    allMasterData = data || [];
    rawDataMap.clear();
    allMasterData.forEach(row => rawDataMap.set(String(row.id), row));

    processAndRenderData();

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-8">Gagal memuat data: ${err.message}</td></tr>`;
  }
}

function renderTablePage() {
  const tbody = document.getElementById("rkmTableBody");
  tbody.innerHTML = "";

  if (filteredData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-[#5f6368] dark:text-[#9aa0a6] py-6">Tidak ada data yang sesuai pencarian/filter.</td></tr>`;
    updatePaginationUI();
    updateFilterButtonStyles();
    return;
  }

  const totalPages = Math.ceil(totalRows / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageData = filteredData.slice(startIndex, startIndex + PAGE_SIZE);

  pageData.forEach((item) => {
    const tr = createRowElement(item);
    tbody.appendChild(tr);
  });

  updatePaginationUI();
  updateFilterButtonStyles();
}

function createRowElement(item) {
  const id = item.id;
  const tanggal = escapeHtml(item.Tanggal || item.tanggal || "-");
  const sumber = escapeHtml(item.Sumber || item.sumber || "-");
  const caseText = item.Case || item.case || "-";
  const picText = item.PIC || item.pic || "";
  const updateText = item.Update || item.update || "-";
  const targetText = escapeHtml(item.Target || item.target || "-");
  const status = item.Status || item.status || "Open";

  const tr = document.createElement("tr");
  tr.setAttribute("data-id", id);
  tr.className = "hover:bg-[#f8f9fa] dark:hover:bg-[#252525] border-b border-[#f1f3f4] dark:border-[#2d2d2d] text-[#202124] dark:text-[#e8eaed] transition-colors duration-300";

  const picBadges = picText 
    ? `<div class="flex flex-col gap-1 items-start font-medium">${picText.split(",").map(p => `<span class="inline-block bg-[#f1f3f4] dark:bg-[#2d2d2d] text-[#202124] dark:text-[#e8eaed] border border-[#dadce0] dark:border-[#3c4043] rounded-md px-1.5 py-0.5 text-[10px] whitespace-nowrap">${escapeHtml(p.trim())}</span>`).join("")}</div>`
    : '-';

  let statusBadgeStyle = "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700";
  if (status === "Done") {
    statusBadgeStyle = "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-bold";
  } else if (status === "Close") {
    statusBadgeStyle = "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 font-bold";
  }

  const clickAttr = isEditor ? `onclick="openModal('${id}')"` : '';
  const cursorClass = isEditor ? 'cursor-pointer hover:scale-105 transition' : 'cursor-default';
  const titleAttr = isEditor ? 'Click to edit' : 'Read only';

  const formattedCase = escapeHtml(String(caseText));
  const formattedUpdate = escapeHtml(String(updateText));

  tr.innerHTML = `
    <td class="cell-tanggal p-2.5 whitespace-nowrap font-medium">${tanggal}</td>
    <td class="cell-sumber p-2.5 truncate" title="${sumber}">${sumber}</td>
    <td class="cell-case p-2.5 truncate" title="${formattedCase}">${formattedCase}</td>
    <td class="cell-pic p-2.5">${picBadges}</td>
    <td class="cell-update p-2.5 truncate" title="${formattedUpdate}">${formattedUpdate}</td>
    <td class="cell-target p-2.5 whitespace-nowrap truncate" title="${targetText}">${targetText}</td>
    <td class="cell-status p-2.5 text-center whitespace-nowrap">
      <span class="inline-block rounded-full border px-2.5 py-0.5 text-xs shadow-xs ${statusBadgeStyle} ${cursorClass}" ${clickAttr} title="${titleAttr}">
        ${escapeHtml(status)}
      </span>
    </td>
  `;
  return tr;
}

function updateSingleRowInDOM(updatedItem) {
  if (!updatedItem || !updatedItem.id) return;

  const idStr = String(updatedItem.id);
  rawDataMap.set(idStr, updatedItem);

  const idxMaster = allMasterData.findIndex(r => String(r.id) === idStr);
  if (idxMaster !== -1) allMasterData[idxMaster] = updatedItem;

  processAndRenderData();

  const tr = document.querySelector(`tr[data-id="${idStr}"]`);
  if (tr) {
    tr.classList.add('bg-emerald-100/60', 'dark:bg-emerald-900/40');
    setTimeout(() => {
      tr.classList.remove('bg-emerald-100/60', 'dark:bg-emerald-900/40');
    }, 1200);
  }
}

// INTEGRASI DELEGASI FILTER TERUSAN KE TABLE FILTER MANAGER
function toggleFilterMenu(columnKey, event) {
  if (tableFilter) {
    tableFilter.toggleMenu(columnKey, event, allMasterData);
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
    processAndRenderData();
  }
}

function updateFilterButtonStyles() {
  const allColumns = ['Tanggal', 'Sumber', 'Case', 'PIC', 'Update', 'Target', 'Status'];

  allColumns.forEach(col => {
    const btn = document.getElementById(`btn-filter-${col}`);
    if (!btn) return;

    const isActive = tableFilter && tableFilter.filterSelections[col] && tableFilter.filterSelections[col].size > 0;

    if (isActive) {
      btn.className = "p-0.5 text-[#1a73e8] dark:text-[#8ab4f8] cursor-pointer transition-transform duration-150 scale-140 inline-block";
      btn.innerHTML = `<svg class="w-2 h-2" viewBox="0 0 10 6"><polygon points="1,1 9,1 5,5" fill="currentColor" stroke="none"/></svg>`;
    } else {
      btn.className = "p-0.5 text-[#5f6368] dark:text-[#bdc1c6] hover:text-[#202124] dark:hover:text-white cursor-pointer transition-transform duration-150 scale-100 inline-block";
      btn.innerHTML = `<svg class="w-2 h-2" viewBox="0 0 10 6"><polygon points="1,1 9,1 5,5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
    }
  });
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
    renderTablePage();
  }
}

function goToEnd() {
  const totalPages = Math.ceil(totalRows / PAGE_SIZE) || 1;
  if (currentPage !== totalPages) {
    currentPage = totalPages;
    renderTablePage();
  }
}

function changePage(delta) {
  const totalPages = Math.ceil(totalRows / PAGE_SIZE) || 1;
  const newPage = currentPage + delta;

  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    renderTablePage();
  }
}

function jumpToPage() {
  const totalPages = Math.ceil(totalRows / PAGE_SIZE) || 1;
  const input = document.getElementById('jumpPageInput');
  let val = parseInt(input.value, 10);

  if (isNaN(val) || val < 1) val = 1;
  if (val > totalPages) val = totalPages;

  currentPage = val;
  renderTablePage();
}

function openModal(id = null) {
  if (!isEditor) {
    alert("Akses Terbatas: Anda hanya memiliki hak akses membaca (Read-Only).");
    return;
  }

  const form = document.getElementById("rkmForm");
  form.reset();
  document.getElementById("inpId").value = "";
  document.getElementById("inpStatus").value = "Open";

  selectedPicsArray = [];
  renderPicTags();

  const btnDelete = document.getElementById("btnDeleteModal");

  if (id !== null) {
    document.getElementById("modalTitle").innerText = "Edit Agenda RKM";
    const item = rawDataMap.get(String(id));
    
    if (item) {
      document.getElementById("inpId").value = item.id;
      document.getElementById("inpTanggal").value = item.Tanggal || item.tanggal || "";
      document.getElementById("inpSumber").value = item.Sumber || item.sumber || "";
      document.getElementById("inpCase").value = item.Case || item.case || "";
      document.getElementById("inpTarget").value = item.Target || item.target || "";
      document.getElementById("inpUpdate").value = item.Update || item.update || "";
      document.getElementById("inpStatus").value = item.Status || item.status || "Open";

      const picVal = item.PIC || item.pic;
      if (picVal) {
        selectedPicsArray = picVal.split(",").map(p => p.trim()).filter(p => p !== "");
        renderPicTags();
      }
    }

    btnDelete.classList.remove("hidden");
  } else {
    document.getElementById("modalTitle").innerText = "Add New Agenda";
    btnDelete.classList.add("hidden");
  }
  document.getElementById("rkmModal").classList.remove("hidden");
}

function closeModalForm() {
  document.getElementById("rkmModal").classList.add("hidden");
}

async function submitForm() {
  if (!isEditor) {
    alert("Akses Ditolak: Anda tidak memiliki izin untuk menyimpan data.");
    return;
  }

  const form = document.getElementById("rkmForm");
  if(!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  if (selectedPicsArray.length === 0) {
    alert("Pilih minimal satu PIC.");
    return;
  }

  const id = document.getElementById("inpId").value;
  
  const payload = {
    Tanggal: document.getElementById("inpTanggal").value,
    Sumber: document.getElementById("inpSumber").value,
    Case: document.getElementById("inpCase").value,
    PIC: selectedPicsArray.join(", "),
    Target: document.getElementById("inpTarget").value,
    Update: document.getElementById("inpUpdate").value,
    Status: document.getElementById("inpStatus").value
  };

  if (id) {
    const { data, error } = await _supabase
      .from(TABLE_NAME)
      .update(payload)
      .eq('id', id)
      .select();

    if (error) {
      alert("Gagal menyimpan ke Supabase: " + error.message);
    } else {
      closeModalForm();
      const updatedObj = (data && data[0]) ? data[0] : { ...payload, id: Number(id) };
      updateSingleRowInDOM(updatedObj);
    }
  } else {
    const { error } = await _supabase
      .from(TABLE_NAME)
      .insert([payload]);

    if (error) {
      alert("Gagal menyimpan ke Supabase: " + error.message);
    } else {
      closeModalForm();
      await fetchTableData();
    }
  }
}

async function deleteFromModal() {
  if (!isEditor) {
    alert("Akses Ditolak: Anda tidak memiliki izin untuk menghapus data.");
    return;
  }

  const id = document.getElementById("inpId").value;
  if (!id) return;

  if (!confirm("⚠️ PERINGATAN:\nApakah Anda yakin ingin menghapus agenda kerja ini secara permanen?")) {
    return;
  }

  const { error } = await _supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id);

  if (error) {
    alert("Gagal menghapus data: " + error.message);
  } else {
    closeModalForm();
    await fetchTableData();
  }
}

async function exportToPDF() {
  try {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("Library jsPDF belum siap. Silakan coba beberapa saat lagi.");
      return;
    }

    const data = filteredData;

    if (!data || data.length === 0) {
      alert("Tidak ada data yang dapat diexport.");
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const headers = [["Tanggal", "Sumber", "Case", "PIC", "Update", "Target", "Status"]];
    const bodyData = data.map(item => [
      item.Tanggal || item.tanggal || "-",
      item.Sumber || item.sumber || "-",
      item.Case || item.case || "-",
      item.PIC || item.pic || "-",
      item.Update || item.update || "-",
      item.Target || item.target || "-",
      item.Status || item.status || "Open"
    ]);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Laporan RKM PBC", 14, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100);
    const todayStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    doc.text(`Tanggal Cetak: ${todayStr}`, 14, 20);

    doc.autoTable({
      head: headers,
      body: bodyData,
      startY: 24,
      margin: { top: 24, bottom: 15, left: 14, right: 14 },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        valign: 'top',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [26, 115, 232],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 22 },
        2: { cellWidth: 44 },
        3: { cellWidth: 20 },
        4: { cellWidth: 44 },
        5: { cellWidth: 18 },
        6: { cellWidth: 14, halign: 'center' }
      },
      didDrawPage: function (data) {
        const pageCount = doc.internal.getNumberOfPages();
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(130, 130, 130);
        
        const footerText = `Exported by ${CURRENT_USER}`;
        doc.text(footerText, pageWidth - 14, pageHeight - 8, { align: 'right' });
        doc.text(`Halaman ${pageCount}`, 14, pageHeight - 8);
      }
    });

    const fileDate = new Date().toISOString().slice(0, 10);
    doc.save(`Laporan_RKM_${fileDate}.pdf`);

  } catch (err) {
    console.error("Gagal export PDF:", err);
    alert("Terjadi kesalahan saat mengeksport PDF: " + err.message);
  }
}