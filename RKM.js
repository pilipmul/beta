const SUPABASE_URL = "https://sfblelnbczlvykqemhtm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0";
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TABLE_NAME = "rkm";

const VALID_PICS = ["GA", "Head Ops.", "ME", "TRO", "FA", "Head FA", "Security", "All", "CS", "Kasir", "MKT"];
let selectedPicsArray = [];

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

let rkmDataCache = [];
let fullData = []; 
let filteredData = []; 

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

  renderTable(filteredData);
}

function clearGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  if (input) input.value = '';
  triggerGlobalSearch();
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
  fetchRKMData();
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

async function fetchRKMData() {
  const tbody = document.getElementById("rkmTableBody");
  tbody.innerHTML = '<tr><td colspan="7" class="text-center text-[#5f6368] dark:text-[#9aa0a6] py-8">Loading RKM data...</td></tr>';

  const { data, error } = await _supabase
    .from(TABLE_NAME)
    .select('*')
    .order('Tanggal', { ascending: false });

  if (error) {
    console.error("Detail Error:", error);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 py-8">Gagal memuat data: ${error.message}</td></tr>`;
    return;
  }

  rkmDataCache = data || [];
  
  fullData = rkmDataCache.map(item => [
    item.Tanggal || item.tanggal || "-",
    item.Sumber || item.sumber || "-",
    item.Case || item.case || "-",
    item.PIC || item.pic || "",
    item.Update || item.update || "-",
    item.Target || item.target || "-",
    item.Status || item.status || "Open",
    item.id
  ]);

  reapplyFilter();
}

function renderTable(dataArray) {
  const tbody = document.getElementById("rkmTableBody");
  tbody.innerHTML = "";

  const counterEl = document.getElementById("totalDataCount");
  if (counterEl) counterEl.innerText = dataArray.length;

  if (dataArray.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-[#5f6368] dark:text-[#9aa0a6] py-6">Tidak ada agenda kerja yang sesuai.</td></tr>`;
    return;
  }

  dataArray.forEach((row) => {
    const [tanggal, sumber, caseText, picText, updateText, targetText, status, id] = row;
    const originalIndex = rkmDataCache.findIndex(d => d.id === id);
    
    const tr = document.createElement("tr");
    tr.setAttribute("data-id", id);
    tr.className = "hover:bg-[#f8f9fa] dark:hover:bg-[#252525] border-b border-[#f1f3f4] dark:border-[#2d2d2d] text-[#202124] dark:text-[#e8eaed] transition-colors";

    const picBadges = picText 
      ? `<div class="flex flex-col gap-1 items-start font-medium">${picText.split(",").map(p => `<span class="inline-block bg-[#f1f3f4] dark:bg-[#2d2d2d] text-[#202124] dark:text-[#e8eaed] border border-[#dadce0] dark:border-[#3c4043] rounded-md px-1.5 py-0.5 text-[10px] whitespace-nowrap">${p.trim()}</span>`).join("")}</div>`
      : '-';

    let statusBadgeStyle = "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700";
    if (status === "Done") {
      statusBadgeStyle = "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-bold";
    } else if (status === "Close") {
      statusBadgeStyle = "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 font-bold";
    }

    const clickAttr = isEditor ? `onclick="openModal(${originalIndex})"` : '';
    const cursorClass = isEditor ? 'cursor-pointer hover:scale-105 transition' : 'cursor-default';
    const titleAttr = isEditor ? 'Click to edit' : 'Read only';

    // Format karakter escaped '\n' menjadi newline asli
    const formattedCase = caseText ? String(caseText).replace(/\\n/g, '\n') : '-';
    const formattedUpdate = updateText ? String(updateText).replace(/\\n/g, '\n') : '-';

    tr.innerHTML = `
      <td class="p-2.5 whitespace-nowrap font-medium">${tanggal}</td>
      <td class="p-2.5">${sumber}</td>
      <td class="p-2.5 whitespace-pre-line">${formattedCase}</td>
      <td class="p-2.5">${picBadges}</td>
      <td class="p-2.5 whitespace-pre-line">${formattedUpdate}</td>
      <td class="p-2.5 whitespace-nowrap">${targetText}</td>
      <td class="p-2.5 text-center whitespace-nowrap">
        <span class="inline-block rounded-full border px-2.5 py-0.5 text-xs shadow-xs ${statusBadgeStyle} ${cursorClass}" ${clickAttr} title="${titleAttr}">
          ${status}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
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
      return dir === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
  });
  renderTable(filteredData);
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

if (menu) menu.onclick = (e) => e.stopPropagation();

function openModal(index = null) {
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

  if (index !== null) {
    document.getElementById("modalTitle").innerText = "Edit Agenda RKM";
    const item = rkmDataCache[index];
    
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
      
      const updatedItem = data && data[0] ? data[0] : { ...payload, id: parseInt(id) };
      const cacheIndex = rkmDataCache.findIndex(item => String(item.id) === String(id));
      
      if (cacheIndex !== -1) {
        rkmDataCache[cacheIndex] = updatedItem;
      }

      const newRowArray = [
        updatedItem.Tanggal || updatedItem.tanggal || "-",
        updatedItem.Sumber || updatedItem.sumber || "-",
        updatedItem.Case || updatedItem.case || "-",
        updatedItem.PIC || updatedItem.pic || "",
        updatedItem.Update || updatedItem.update || "-",
        updatedItem.Target || updatedItem.target || "-",
        updatedItem.Status || updatedItem.status || "Open",
        updatedItem.id
      ];

      const fullIndex = fullData.findIndex(row => String(row[7]) === String(id));
      if (fullIndex !== -1) {
        fullData[fullIndex] = newRowArray;
      }

      reapplyFilter();
    }
  } else {
    const { data, error } = await _supabase
      .from(TABLE_NAME)
      .insert([payload])
      .select();

    if (error) {
      alert("Gagal menyimpan ke Supabase: " + error.message);
    } else {
      closeModalForm();
      
      const newItem = data && data[0] ? data[0] : { ...payload, id: Date.now() };
      rkmDataCache.unshift(newItem);

      const newRowArray = [
        newItem.Tanggal || newItem.tanggal || "-",
        newItem.Sumber || newItem.sumber || "-",
        newItem.Case || newItem.case || "-",
        newItem.PIC || newItem.pic || "",
        newItem.Update || newItem.update || "-",
        newItem.Target || newItem.target || "-",
        newItem.Status || newItem.status || "Open",
        newItem.id
      ];

      fullData.unshift(newRowArray);
      reapplyFilter();
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
    
    rkmDataCache = rkmDataCache.filter(item => String(item.id) !== String(id));
    fullData = fullData.filter(row => String(row[7]) !== String(id));
    
    reapplyFilter();
  }
}