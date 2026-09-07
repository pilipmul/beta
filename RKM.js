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
let rawDataMap = new Map();
let fetchedData = [];
let dbFilterOptions = {};

let usernameFromStorage = "Tamu";
try {
  const userData = JSON.parse(localStorage.getItem("user"));
  if (userData && userData.nama) {
    usernameFromStorage = userData.nama;
  }
} catch (err) {
  console.error("Gagal membaca session:", err);
}

const CURRENT_USER = usernameFromStorage;
const ALLOWED_EDITORS = ["Dede Hidayat", "Sutriono", "Herliana Oktavianti"];
const isEditor = ALLOWED_EDITORS.includes(CURRENT_USER);

let activeFilterColumn = null;
let draftFilterSelections = new Set();

let globalSearchQuery = sessionStorage.getItem('rkm_globalSearchQuery') || '';
let sortConfig = JSON.parse(sessionStorage.getItem('rkm_sortConfig')) || { column: null, direction: null };

let filterSelections = {};
try {
  const savedFilters = JSON.parse(sessionStorage.getItem('rkm_filterSelections'));
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
  sessionStorage.setItem('rkm_globalSearchQuery', globalSearchQuery);
  sessionStorage.setItem('rkm_sortConfig', JSON.stringify(sortConfig));

  const serializableFilters = {};
  Object.keys(filterSelections).forEach(key => {
    if (filterSelections[key] && filterSelections[key].size > 0) {
      serializableFilters[key] = Array.from(filterSelections[key]);
    }
  });
  sessionStorage.setItem('rkm_filterSelections', JSON.stringify(serializableFilters));
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
  } else {
    items.push(`
      <div class="px-3 py-2 text-[#5f6368] dark:text-[#9aa0a6] text-center">Read Only</div>
    `);
  }

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
  const hamburgerMenuOptions = [];
  if (isEditor) {
    hamburgerMenuOptions.push({
      label: "New Agenda",
      icon: `<svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`,
      onClick: "openModal()"
    });
  }

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
  const allColumns = ['Tanggal', 'Sumber', 'Case', 'PIC', 'Update', 'Target', 'Status'];

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
      `Tanggal.ilike.%${globalSearchQuery}%,` +
      `Sumber.ilike.%${globalSearchQuery}%,` +
      `Case.ilike.%${globalSearchQuery}%,` +
      `PIC.ilike.%${globalSearchQuery}%,` +
      `Update.ilike.%${globalSearchQuery}%,` +
      `Target.ilike.%${globalSearchQuery}%,` +
      `Status.ilike.%${globalSearchQuery}%`
    );
  }

  for (const colKey in filterSelections) {
    const selectedSet = filterSelections[colKey];
    if (selectedSet && selectedSet.size > 0) {
      const selectedArray = Array.from(selectedSet);

      if (colKey === 'PIC') {
        const picOrConditions = selectedArray.map(pic => {
          if (pic === '-') return `PIC.is.null,PIC.eq.`;
          return `PIC.ilike.%${pic}%`;
        });
        query = query.or(picOrConditions.join(','));
      } else {
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
  }
  return query;
}

async function fetchTableData() {
  const tbody = document.getElementById("rkmTableBody");
  tbody.innerHTML = '<tr><td colspan="7" class="text-center text-[#5f6368] dark:text-[#9aa0a6] py-8">Memuat data RKM...</td></tr>';

  try {
    let countQuery = _supabase.from(TABLE_NAME).select('*', { count: 'exact', head: true });
    countQuery = applySupabaseFilters(countQuery);

    const { count, error: countErr } = await countQuery;
    if (countErr) throw countErr;

    totalRows = count || 0;
    document.getElementById("totalDataCount").innerText = totalRows;

    if (totalRows === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-[#5f6368] dark:text-[#9aa0a6] py-6">Tidak ada agenda kerja yang sesuai.</td></tr>`;
      updatePaginationUI();
      updateFilterButtonStyles();
      return;
    }

    const totalPages = Math.ceil(totalRows / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;

    const fromIndex = (currentPage - 1) * PAGE_SIZE;
    const toIndex = Math.min(currentPage * PAGE_SIZE - 1, totalRows - 1);

    let dataQuery = _supabase.from(TABLE_NAME).select('*');
    dataQuery = applySupabaseFilters(dataQuery);

    if (sortConfig.column && sortConfig.direction) {
      dataQuery = dataQuery.order(sortConfig.column, { ascending: sortConfig.direction === 'asc' });
    } else {
      dataQuery = dataQuery.order('Tanggal', { ascending: false });
    }

    dataQuery = dataQuery.range(fromIndex, toIndex);

    const { data, error } = await dataQuery;
    if (error) throw error;

    fetchedData = data || [];
    rawDataMap.clear();
    fetchedData.forEach(row => rawDataMap.set(String(row.id), row));

    renderTable();

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-8">Gagal memuat data: ${err.message}</td></tr>`;
  }
}

function renderTable() {
  const tbody = document.getElementById("rkmTableBody");
  tbody.innerHTML = "";

  if (fetchedData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-[#5f6368] dark:text-[#9aa0a6] py-6">Tidak ada data yang sesuai filter.</td></tr>`;
    updatePaginationUI();
    updateFilterButtonStyles();
    return;
  }

  fetchedData.forEach((item) => {
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

  const formattedCase = escapeHtml(String(caseText).replace(/\\n/g, '\n'));
  const formattedUpdate = escapeHtml(String(updateText).replace(/\\n/g, '\n'));

  tr.innerHTML = `
    <td class="cell-tanggal p-2.5 whitespace-nowrap font-medium">${tanggal}</td>
    <td class="cell-sumber p-2.5">${sumber}</td>
    <td class="cell-case p-2.5 whitespace-pre-line">${formattedCase}</td>
    <td class="cell-pic p-2.5">${picBadges}</td>
    <td class="cell-update p-2.5 whitespace-pre-line">${formattedUpdate}</td>
    <td class="cell-target p-2.5 whitespace-nowrap">${targetText}</td>
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

  const idx = fetchedData.findIndex(r => String(r.id) === idStr);
  if (idx !== -1) {
    fetchedData[idx] = updatedItem;
  }

  const tr = document.querySelector(`tr[data-id="${idStr}"]`);
  if (!tr) return;

  const newTr = createRowElement(updatedItem);
  tr.innerHTML = newTr.innerHTML;

  tr.classList.add('bg-emerald-100/60', 'dark:bg-emerald-900/40');
  setTimeout(() => {
    tr.classList.remove('bg-emerald-100/60', 'dark:bg-emerald-900/40');
  }, 1200);
}

async function toggleFilterMenu(columnKey, event) {
  event.stopPropagation();
  activeFilterColumn = columnKey;

  const popover = document.getElementById('filterPopover');
  const rect = event.currentTarget.getBoundingClientRect();
  
  let leftPos = Math.max(8, Math.min(rect.left + window.scrollX - 100, window.innerWidth - 250));

  popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
  popover.style.left = `${leftPos}px`;
  document.getElementById('filterSearchInput').value = '';
  
  if (!dbFilterOptions[columnKey]) {
    try {
      const { data, error } = await _supabase.from(TABLE_NAME).select(columnKey);
      if (!error && data) {
        let rawVals = [];
        data.forEach(r => {
          const val = r[columnKey];
          if (val !== null && val !== undefined && val !== '') {
            if (columnKey === 'PIC') {
              String(val).split(',').forEach(p => rawVals.push(p.trim()));
            } else {
              rawVals.push(String(val));
            }
          } else {
            rawVals.push('-');
          }
        });
        dbFilterOptions[columnKey] = Array.from(new Set(rawVals)).sort();
      } else {
        extractFilterOptionsFromFetched(columnKey);
      }
    } catch {
      extractFilterOptionsFromFetched(columnKey);
    }
  }

  const activeSaved = filterSelections[activeFilterColumn];
  const allOpts = dbFilterOptions[activeFilterColumn] || [];

  draftFilterSelections = (activeSaved && activeSaved.size > 0) ? new Set(activeSaved) : new Set(allOpts);

  renderFilterCheckboxes();
  popover.classList.remove('hidden');
}

function extractFilterOptionsFromFetched(columnKey) {
  let rawVals = [];
  fetchedData.forEach(r => {
    const val = r[columnKey];
    if (val !== null && val !== undefined && val !== '') {
      if (columnKey === 'PIC') {
        String(val).split(',').forEach(p => rawVals.push(p.trim()));
      } else {
        rawVals.push(String(val));
      }
    } else {
      rawVals.push('-');
    }
  });
  dbFilterOptions[columnKey] = Array.from(new Set(rawVals)).sort();
}

function closeFilterPopover() {
  document.getElementById('filterPopover').classList.add('hidden');
}

function renderFilterCheckboxes() {
  const container = document.getElementById('filterItemsList');
  const searchVal = document.getElementById('filterSearchInput').value.trim().toLowerCase();
  
  if (!dbFilterOptions[activeFilterColumn]) {
    extractFilterOptionsFromFetched(activeFilterColumn);
  }

  const uniqueValues = dbFilterOptions[activeFilterColumn] || [];

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
      dbFilterOptions = {};
      
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
      dbFilterOptions = {};
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
    dbFilterOptions = {};
    await fetchTableData();
  }
}