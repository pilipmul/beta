/**
 * Modul Analisa Data - Tampilan Tanpa Double Container & Filter Identik Casual View
 * Tanpa Garis Vertikal Antar Kolom (Clean Table Layout)
 */

let fullAnalisaTableData = [];
let columnFilterState = {};
let activeAnalisaFilterColumn = null;
let draftAnalisaFilterSelections = new Set();
let dbAnalisaColumnOptions = {};

// Constant SVG Icons
const SVG_PROJECT = `<svg class="w-3.5 h-3.5 inline-block align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`;

// Sigma + Panah Bawah (Total In / Barang Masuk)
const SVG_SUM_IN = `<svg class="w-4 h-4 inline-block align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H7l5 6.5L7 17h9"/><path d="M19 13v6m0 0l-2-2m2 2l2-2"/></svg>`;

// Sigma + Panah Atas (Total Out / Barang Keluar)
const SVG_SUM_OUT = `<svg class="w-4 h-4 inline-block align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H7l5 6.5L7 17h9"/><path d="M19 20v-6m0 0l-2 2m2-2l2 2"/></svg>`;

const SVG_BUFFER = `<svg class="w-3.5 h-3.5 inline-block align-middle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`;

function getAnalisaViewHtml() {
  return `
    <div class="bg-white dark:bg-[#1e1e1e] rounded-xl sm:rounded-2xl shadow-sm border border-[#dadce0] dark:border-[#3c4043] overflow-hidden relative">
      
      <!-- Loading State -->
      <div id="analisaLoading" class="py-16 text-center text-[#5f6368] dark:text-[#9aa0a6]">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-2"></div>
        <p class="text-xs font-medium">Mengkalkulasi parameter analisa operasional & movement stock...</p>
      </div>

      <!-- Content State -->
      <div id="analisaContent" class="hidden">
        <div class="overflow-x-auto custom-scroll w-full">
          <table class="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead class="bg-[#f8f9fa] dark:bg-[#252525] text-[#5f6368] dark:text-[#bdc1c6] uppercase font-semibold tracking-wider border-b border-[#dadce0] dark:border-[#3c4043] select-none">
              <tr>
                <th scope="col" class="p-2.5 text-center w-8">No</th>
                
                <!-- 1. Project (Icon Briefcase) -->
                <th scope="col" class="p-2.5 text-center relative" title="Project / Unit Kerja">
                  <div class="flex items-center justify-center gap-1 cursor-help">
                    <span class="inline-flex items-center justify-center">${SVG_PROJECT}</span>
                    <button id="btn-filter-analisa-project" onclick="toggleAnalisaFilterMenu('project', event)"></button>
                  </div>
                </th>

                <!-- 2. Item -->
                <th scope="col" class="p-2.5 relative">
                  <div class="flex items-center justify-between gap-1">
                    <span class="truncate">Item</span>
                    <button id="btn-filter-analisa-item" onclick="toggleAnalisaFilterMenu('item', event)"></button>
                  </div>
                </th>

                <!-- 3. Qty -->
                <th scope="col" class="p-2.5 text-right relative">
                  <div class="flex items-center justify-end gap-1">
                    <span class="truncate">Qty</span>
                    <button id="btn-filter-analisa-qty" onclick="toggleAnalisaFilterMenu('qty', event)"></button>
                  </div>
                </th>

                <!-- 4. Freq -->
                <th scope="col" class="p-2.5 text-center relative" title="Frekuensi Keluar">
                  <div class="flex items-center justify-center gap-1 cursor-help">
                    <span class="truncate">Freq</span>
                    <button id="btn-filter-analisa-frekKeluar" onclick="toggleAnalisaFilterMenu('frekKeluar', event)"></button>
                  </div>
                </th>

                <!-- 5. Total In (Icon Sigma + Panah Bawah) -->
                <th scope="col" class="p-2.5 text-right relative" title="Total Qty In (Barang Masuk)">
                  <div class="flex items-center justify-end gap-1 cursor-help">
                    <span class="inline-flex items-center justify-center text-emerald-600 dark:text-emerald-400">${SVG_SUM_IN}</span>
                    <button id="btn-filter-analisa-totalIn" onclick="toggleAnalisaFilterMenu('totalIn', event)"></button>
                  </div>
                </th>

                <!-- 6. Total Out (Icon Sigma + Panah Atas) -->
                <th scope="col" class="p-2.5 text-right relative" title="Total Qty Out (Barang Keluar)">
                  <div class="flex items-center justify-end gap-1 cursor-help">
                    <span class="inline-flex items-center justify-center text-red-600 dark:text-red-400">${SVG_SUM_OUT}</span>
                    <button id="btn-filter-analisa-totalOut" onclick="toggleAnalisaFilterMenu('totalOut', event)"></button>
                  </div>
                </th>

                <!-- 7. Buffer (Icon Layers) -->
                <th scope="col" class="p-2.5 text-right relative" title="Buffer / Safety Stock">
                  <div class="flex items-center justify-end gap-1 cursor-help">
                    <span class="inline-flex items-center justify-center">${SVG_BUFFER}</span>
                    <button id="btn-filter-analisa-buffer" onclick="toggleAnalisaFilterMenu('buffer', event)"></button>
                  </div>
                </th>

                <!-- 8. DOH -->
                <th scope="col" class="p-2.5 text-center relative" title="Days of Inventory (Hari Ketahanan Stok)">
                  <div class="flex items-center justify-center gap-1 cursor-help">
                    <span class="truncate">DOH</span>
                    <button id="btn-filter-analisa-doh" onclick="toggleAnalisaFilterMenu('doh', event)"></button>
                  </div>
                </th>

                <!-- 9. Status -->
                <th scope="col" class="p-2.5 text-center relative" title="Status Movement Stock">
                  <div class="flex items-center justify-center gap-1 cursor-help">
                    <span class="truncate">Status</span>
                    <button id="btn-filter-analisa-statusMovement" onclick="toggleAnalisaFilterMenu('statusMovement', event)"></button>
                  </div>
                </th>

                <!-- 10. Last In -->
                <th scope="col" class="p-2.5 relative" title="Transaksi Masuk Terakhir (Qty & Tanggal)">
                  <div class="flex items-center justify-between gap-1 cursor-help">
                    <span class="truncate">Last In</span>
                    <button id="btn-filter-analisa-lastIn" onclick="toggleAnalisaFilterMenu('lastIn', event)"></button>
                  </div>
                </th>

                <!-- 11. Last Out -->
                <th scope="col" class="p-2.5 relative" title="Transaksi Keluar Terakhir (Qty & Tanggal)">
                  <div class="flex items-center justify-between gap-1 cursor-help">
                    <span class="truncate">Last Out</span>
                    <button id="btn-filter-analisa-lastOut" onclick="toggleAnalisaFilterMenu('lastOut', event)"></button>
                  </div>
                </th>

                <!-- 12. AMU -->
                <th scope="col" class="p-2.5 text-right relative" title="Average Monthly Usage (Rata-Rata Keluar Per Bulan)">
                  <div class="flex items-center justify-end gap-1 cursor-help">
                    <span class="truncate">AMU</span>
                    <button id="btn-filter-analisa-rerataKeluarBulan" onclick="toggleAnalisaFilterMenu('rerataKeluarBulan', event)"></button>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody id="analisaTableBody" class="divide-y divide-[#f1f3f4] dark:divide-[#2d2d2d] font-medium text-[#202124] dark:text-[#e8eaed]">
              <tr>
                <td colspan="13" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Memuat data analisa...</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Filter Popover Identik dengan Casual View -->
        <div id="analisaFilterPopover" class="fixed hidden z-[10005] w-56 sm:w-60 bg-white dark:bg-[#252525] border border-[#dadce0] dark:border-[#3c4043] rounded-2xl shadow-xl p-3 text-xs lowercase">
          <div class="grid grid-cols-2 gap-2 mb-3 border-b border-[#f1f3f4] dark:border-[#3c4043] pb-3 normal-case">
            <button onclick="applyAnalisaSort('asc')" class="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#f1f3f4] dark:bg-[#2d2d2d] hover:bg-[#e8f0fe] dark:hover:bg-[#2c384e] text-[#202124] dark:text-[#e8eaed] rounded-xl transition font-medium text-xs cursor-pointer">
              <span>↑</span> A-Z
            </button>
            <button onclick="applyAnalisaSort('desc')" class="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#f1f3f4] dark:bg-[#2d2d2d] hover:bg-[#e8f0fe] dark:hover:bg-[#2c384e] text-[#202124] dark:text-[#e8eaed] rounded-xl transition font-medium text-xs cursor-pointer">
              <span>↓</span> Z-A
            </button>
          </div>

          <div class="space-y-2 normal-case">
            <input type="text" id="analisaFilterSearchInput" oninput="renderAnalisaFilterCheckboxes()" placeholder="Cari item..." 
                   class="w-full bg-[#f1f3f4] dark:bg-[#2d2d2d] border border-[#dadce0] dark:border-[#3c4043] rounded-xl px-2.5 py-1.5 text-[#202124] dark:text-[#e8eaed] focus:outline-none text-xs" />
            
            <div class="flex justify-between items-center text-[11px] text-[#5f6368] dark:text-[#9aa0a6] px-1">
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" id="analisaSelectAllCheckbox" onchange="toggleSelectAllAnalisaFilters(this.checked)" />
                Pilih Semua
              </label>
              <button onclick="clearAnalisaFilterColumn()" class="text-[#1a73e8] dark:text-[#8ab4f8] font-medium cursor-pointer">Reset</button>
            </div>

            <div id="analisaFilterItemsList" class="max-h-36 overflow-y-auto space-y-1 pr-1 border border-[#f1f3f4] dark:border-[#3c4043] rounded-xl p-1.5 bg-[#f8f9fa] dark:bg-[#1e1e1e] custom-scroll">
            </div>

            <div class="flex gap-2 pt-2 border-t border-[#f1f3f4] dark:border-[#3c4043]">
              <button onclick="closeAnalisaFilterPopover()" class="w-1/2 py-1.5 bg-[#f1f3f4] dark:bg-[#2d2d2d] text-[#5f6368] dark:text-[#bdc1c6] rounded-xl font-medium cursor-pointer">Batal</button>
              <button onclick="applyAnalisaFilter()" class="w-1/2 py-1.5 bg-[#1a73e8] dark:bg-[#8ab4f8] text-white dark:text-[#202124] rounded-xl font-medium shadow-sm cursor-pointer">Terapkan</button>
            </div>
          </div>
        </div>

        <div class="p-3 bg-[#f8f9fa] dark:bg-[#252525] border-t border-[#dadce0] dark:border-[#3c4043] text-[11px] text-[#70757a] dark:text-[#9aa0a6] italic">
          * Klik tombol filter pada header kolom untuk penyaringan dan pengurutan data mendalam.
        </div>
      </div>

    </div>
  `;
}

async function runSpecificAnalysis() {
  const loading = document.getElementById('analisaLoading');
  const content = document.getElementById('analisaContent');

  if (loading) loading.classList.remove('hidden');
  if (content) content.classList.add('hidden');

  try {
    const [historyRes, itemMasterRes] = await Promise.all([
      _supabase.from('inventory').select('in, out, date, item, project, no').order('no', { ascending: true }).limit(10000),
      _supabase.from('item').select('item, balance')
    ]);

    if (historyRes.error) throw historyRes.error;

    const rawData = historyRes.data || [];
    
    const balanceMap = {};
    if (itemMasterRes.data) {
      itemMasterRes.data.forEach(m => {
        balanceMap[m.item] = Number(m.balance) || 0;
      });
    }

    const itemAggregator = {};

    rawData.forEach(row => {
      const itemName = row.item;
      if (!itemName) return;

      const projName = row.project || 'Unassigned';
      const key = `${itemName}_${projName}`;

      const valIn = Number(row.in) || 0;
      const valOut = Number(row.out) || 0;

      if (!itemAggregator[key]) {
        itemAggregator[key] = {
          item: itemName,
          project: projName,
          totalIn: 0,
          totalOut: 0,
          frekKeluar: 0,
          uniqueMonths: new Set(),
          lastIn: null,
          lastOut: null
        };
      }

      const itemObj = itemAggregator[key];

      itemObj.totalIn += valIn;
      itemObj.totalOut += valOut;

      if (row.date) {
        itemObj.uniqueMonths.add(String(row.date).slice(0, 7));
      }

      if (valOut > 0) {
        itemObj.frekKeluar += 1;
        itemObj.lastOut = { qty: valOut, date: row.date || '-' };
      }

      if (valIn > 0) {
        itemObj.lastIn = { qty: valIn, date: row.date || '-' };
      }
    });

    fullAnalisaTableData = Object.keys(itemAggregator).map(key => {
      const obj = itemAggregator[key];
      const monthsCount = obj.uniqueMonths.size || 1;
      const rerataKeluarBulan = (obj.totalOut / monthsCount).toFixed(1);
      const rerataKeluarHari = Number(rerataKeluarBulan) / 30;

      const buffer = Math.ceil(rerataKeluarHari * 7);
      const currentBalance = balanceMap[obj.item] || 0;
      const doh = rerataKeluarHari > 0 ? Math.round(currentBalance / rerataKeluarHari) : 0;

      let statusMovement = "DEAD STOCK";
      let badgeClass = "bg-red-600 text-white";

      if (obj.totalOut > 50) {
        statusMovement = "FAST";
        badgeClass = "bg-emerald-600 text-white";
      } else if (obj.totalOut >= 10) {
        statusMovement = "MEDIUM";
        badgeClass = "bg-blue-600 text-white";
      } else if (obj.totalOut > 0) {
        statusMovement = "SLOW";
        badgeClass = "bg-amber-500 text-white";
      }

      const lastInText = obj.lastIn ? `${obj.lastIn.qty} (${obj.lastIn.date})` : '-';
      const lastOutText = obj.lastOut ? `${obj.lastOut.qty} (${obj.lastOut.date})` : '-';

      return {
        project: obj.project,
        item: obj.item,
        qty: currentBalance,
        frekKeluar: obj.frekKeluar,
        totalIn: obj.totalIn,
        totalOut: obj.totalOut,
        buffer: buffer,
        doh: doh,
        statusMovement: statusMovement,
        badgeClass: badgeClass,
        lastIn: lastInText,
        lastOut: lastOutText,
        rerataKeluarBulan: Number(rerataKeluarBulan)
      };
    });

    fullAnalisaTableData.sort((a, b) => b.frekKeluar - a.frekKeluar || b.totalOut - a.totalOut);

    applyAndRenderAnalisaTable();

    if (loading) loading.classList.add('hidden');
    if (content) content.classList.remove('hidden');
  } catch (err) {
    alert('Gagal memuat tabel analisa: ' + err.message);
  }
}

function updateAnalisaFilterButtonStyles() {
  const allColumns = ['project', 'item', 'qty', 'frekKeluar', 'totalIn', 'totalOut', 'buffer', 'doh', 'statusMovement', 'lastIn', 'lastOut', 'rerataKeluarBulan'];

  allColumns.forEach(col => {
    const btn = document.getElementById(`btn-filter-analisa-${col}`);
    if (!btn) return;

    const isActive = columnFilterState[col] && columnFilterState[col].size > 0;

    if (isActive) {
      btn.className = "p-0.5 text-[#1a73e8] dark:text-[#8ab4f8] cursor-pointer transition-transform duration-150 scale-140 inline-block";
      btn.innerHTML = `<svg class="w-2 h-2" viewBox="0 0 10 6"><polygon points="1,1 9,1 5,5" fill="currentColor" stroke="none"/></svg>`;
    } else {
      btn.className = "p-0.5 text-[#5f6368] dark:text-[#bdc1c6] hover:text-[#202124] dark:hover:text-white cursor-pointer transition-transform duration-150 scale-100 inline-block";
      btn.innerHTML = `<svg class="w-2 h-2" viewBox="0 0 10 6"><polygon points="1,1 9,1 5,5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
    }
  });
}

function toggleAnalisaFilterMenu(columnKey, event) {
  event.stopPropagation();
  activeAnalisaFilterColumn = columnKey;

  const popover = document.getElementById('analisaFilterPopover');
  const rect = event.currentTarget.getBoundingClientRect();
  
  let leftPos = Math.max(10, Math.min(rect.left + window.scrollX - 100, window.innerWidth - 250));

  popover.style.top = `${rect.bottom + window.scrollY + 4}px`;
  popover.style.left = `${leftPos}px`;
  document.getElementById('analisaFilterSearchInput').value = '';

  const allVals = Array.from(new Set(fullAnalisaTableData.map(r => (r[columnKey] !== null && r[columnKey] !== undefined && r[columnKey] !== '') ? String(r[columnKey]) : '-'))).sort();
  dbAnalisaColumnOptions[columnKey] = allVals;

  const activeSaved = columnFilterState[activeAnalisaFilterColumn];
  draftAnalisaFilterSelections = (activeSaved && activeSaved.size > 0) ? new Set(activeSaved) : new Set(allVals);

  renderAnalisaFilterCheckboxes();
  popover.classList.remove('hidden');
}

function closeAnalisaFilterPopover() {
  const popover = document.getElementById('analisaFilterPopover');
  if (popover) popover.classList.add('hidden');
}

function renderAnalisaFilterCheckboxes() {
  const container = document.getElementById('analisaFilterItemsList');
  if (!container) return;

  const searchVal = document.getElementById('analisaFilterSearchInput').value.trim().toLowerCase();
  const uniqueValues = dbAnalisaColumnOptions[activeAnalisaFilterColumn] || [];

  container.innerHTML = '';
  let visibleCount = 0, visibleCheckedCount = 0;

  uniqueValues.forEach(val => {
    if (searchVal && !val.toLowerCase().includes(searchVal)) return;

    visibleCount++;
    const isChecked = draftAnalisaFilterSelections.has(val);
    if (isChecked) visibleCheckedCount++;

    const label = document.createElement('label');
    label.className = 'flex items-center gap-2 text-[11px] text-[#202124] dark:text-[#e8eaed] hover:bg-[#e8eaed] dark:hover:bg-[#2d2d2d] p-1 rounded cursor-pointer truncate';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = val;
    checkbox.checked = isChecked;
    checkbox.className = 'analisa-filter-cb';
    
    checkbox.onchange = (e) => {
      if (e.target.checked) draftAnalisaFilterSelections.add(val);
      else draftAnalisaFilterSelections.delete(val);
      updateAnalisaSelectAllState();
    };

    label.appendChild(checkbox);
    const span = document.createElement('span');
    span.className = 'truncate';
    span.innerText = val;
    label.appendChild(span);

    container.appendChild(label);
  });

  const selectAllCb = document.getElementById('analisaSelectAllCheckbox');
  if (selectAllCb) selectAllCb.checked = visibleCount > 0 && visibleCheckedCount === visibleCount;
}

function updateAnalisaSelectAllState() {
  const cbs = document.querySelectorAll('#analisaFilterItemsList .analisa-filter-cb');
  const allChecked = cbs.length > 0 && Array.from(cbs).every(cb => cb.checked);
  const selectAllCb = document.getElementById('analisaSelectAllCheckbox');
  if (selectAllCb) selectAllCb.checked = allChecked;
}

function toggleSelectAllAnalisaFilters(checked) {
  document.querySelectorAll('#analisaFilterItemsList .analisa-filter-cb').forEach(cb => {
    cb.checked = checked;
    if (checked) draftAnalisaFilterSelections.add(cb.value);
    else draftAnalisaFilterSelections.delete(cb.value);
  });
}

function clearAnalisaFilterColumn() {
  delete columnFilterState[activeAnalisaFilterColumn];
  draftAnalisaFilterSelections = new Set(dbAnalisaColumnOptions[activeAnalisaFilterColumn] || []);
  document.getElementById('analisaFilterSearchInput').value = '';
  renderAnalisaFilterCheckboxes();
  applyAndRenderAnalisaTable();
}

function applyAnalisaFilter() {
  const allOpts = dbAnalisaColumnOptions[activeAnalisaFilterColumn] || [];
  if (draftAnalisaFilterSelections.size === 0 || draftAnalisaFilterSelections.size === allOpts.length) {
    delete columnFilterState[activeAnalisaFilterColumn];
  } else {
    columnFilterState[activeAnalisaFilterColumn] = new Set(draftAnalisaFilterSelections);
  }
  closeAnalisaFilterPopover();
  applyAndRenderAnalisaTable();
}

function applyAnalisaSort(direction) {
  const colKey = activeAnalisaFilterColumn;
  fullAnalisaTableData.sort((a, b) => {
    let valA = a[colKey] ?? '';
    let valB = b[colKey] ?? '';

    if (typeof valA === 'number' && typeof valB === 'number') {
      return direction === 'asc' ? valA - valB : valB - valA;
    }
    return direction === 'asc' 
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  closeAnalisaFilterPopover();
  applyAndRenderAnalisaTable();
}

function applyAndRenderAnalisaTable() {
  let filteredData = [...fullAnalisaTableData];

  if (window.globalSearchQuery && window.globalSearchQuery !== '') {
    const q = window.globalSearchQuery.toLowerCase();
    filteredData = filteredData.filter(item => 
      String(item.item || '').toLowerCase().includes(q) ||
      String(item.project || '').toLowerCase().includes(q)
    );
  }

  Object.keys(columnFilterState).forEach(colKey => {
    const allowedSet = columnFilterState[colKey];
    if (allowedSet && allowedSet.size > 0) {
      filteredData = filteredData.filter(item => allowedSet.has(String(item[colKey])));
    }
  });

  renderAnalisaTable(filteredData);
  updateAnalisaFilterButtonStyles();
}

function renderAnalisaTable(list) {
  const tbody = document.getElementById('analisaTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const totalCountEl = document.getElementById('totalDataCount');
  if (totalCountEl) totalCountEl.innerText = list.length;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-[#5f6368] dark:text-[#9aa0a6]">Tidak ada data transaksi yang cocok dengan filter.</td></tr>`;
    return;
  }

  list.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-[#f8f9fa] dark:hover:bg-[#252525] border-b border-[#f1f3f4] dark:border-[#2d2d2d] transition-colors';

    tr.innerHTML = `
      <td class="p-2.5 text-center font-mono text-[#5f6368] dark:text-[#9aa0a6]">${idx + 1}</td>
      <td class="p-2.5 font-medium text-indigo-600 dark:text-indigo-400">${escapeHtml(row.project)}</td>
      <td class="p-2.5 font-semibold text-[#202124] dark:text-[#e8eaed]">${escapeHtml(row.item)}</td>
      <td class="p-2.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">${row.qty.toLocaleString('id-ID')}</td>
      <td class="p-2.5 text-center">${row.frekKeluar.toLocaleString('id-ID')}</td>
      <td class="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">${row.totalIn.toLocaleString('id-ID')}</td>
      <td class="p-2.5 text-right font-mono font-bold text-red-600 dark:text-red-400">${row.totalOut.toLocaleString('id-ID')}</td>
      <td class="p-2.5 text-right font-mono text-amber-600 dark:text-amber-400">${row.buffer.toLocaleString('id-ID')}</td>
      <td class="p-2.5 text-center font-semibold">${row.doh} Hari</td>
      <td class="p-2.5 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${row.badgeClass}">${row.statusMovement}</span>
      </td>
      <td class="p-2.5 text-[#5f6368] dark:text-[#bdc1c6]">${escapeHtml(row.lastIn)}</td>
      <td class="p-2.5 text-[#5f6368] dark:text-[#bdc1c6]">${escapeHtml(row.lastOut)}</td>
      <td class="p-2.5 text-right font-mono font-semibold" title="Average Monthly Usage">${row.rerataKeluarBulan.toLocaleString('id-ID')}</td>
    `;
    tbody.appendChild(tr);
  });
}

function exportAnalisaCSV() {
  try {
    let exportData = [...fullAnalisaTableData];

    if (window.globalSearchQuery && window.globalSearchQuery !== '') {
      const q = window.globalSearchQuery.toLowerCase();
      exportData = exportData.filter(item => 
        String(item.item || '').toLowerCase().includes(q) ||
        String(item.project || '').toLowerCase().includes(q)
      );
    }

    Object.keys(columnFilterState).forEach(colKey => {
      const allowedSet = columnFilterState[colKey];
      if (allowedSet && allowedSet.size > 0) {
        exportData = exportData.filter(item => allowedSet.has(String(item[colKey])));
      }
    });

    if (!exportData || exportData.length === 0) {
      alert('Tidak ada data analisa untuk diexport.');
      return;
    }

    const headers = [
      'No', 'Project', 'Item', 'Qty', 'Freq', 
      'Total In', 'Total Out', 'Buffer', 'DOH', 
      'Status', 'Last In', 'Last Out', 'AMU'
    ];

    const csvRows = [headers.join(',')];

    exportData.forEach((row, idx) => {
      const values = [
        `"${idx + 1}"`,
        `"${String(row.project ?? '').replace(/"/g, '""')}"`,
        `"${String(row.item ?? '').replace(/"/g, '""')}"`,
        `"${row.qty}"`,
        `"${row.frekKeluar}"`,
        `"${row.totalIn}"`,
        `"${row.totalOut}"`,
        `"${row.buffer}"`,
        `"${row.doh}"`,
        `"${row.statusMovement}"`,
        `"${String(row.lastIn ?? '').replace(/"/g, '""')}"`,
        `"${String(row.lastOut ?? '').replace(/"/g, '""')}"`,
        `"${row.rerataKeluarBulan}"`
      ];
      csvRows.push(values.join(','));
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventory_analisa_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    alert('Gagal mengunduh CSV Analisa: ' + err.message);
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

document.addEventListener('click', function(e) {
  const popover = document.getElementById('analisaFilterPopover');
  if (popover && !popover.classList.contains('hidden') && !popover.contains(e.target) && !e.target.closest('button[onclick*="toggleAnalisaFilterMenu"]')) {
    closeAnalisaFilterPopover();
  }
});

window.getAnalisaViewHtml = getAnalisaViewHtml;
window.runSpecificAnalysis = runSpecificAnalysis;
window.toggleAnalisaFilterMenu = toggleAnalisaFilterMenu;
window.closeAnalisaFilterPopover = closeAnalisaFilterPopover;
window.renderAnalisaFilterCheckboxes = renderAnalisaFilterCheckboxes;
window.toggleSelectAllAnalisaFilters = toggleSelectAllAnalisaFilters;
window.clearAnalisaFilterColumn = clearAnalisaFilterColumn;
window.applyAnalisaFilter = applyAnalisaFilter;
window.applyAnalisaSort = applyAnalisaSort;
window.applyAndRenderAnalisaTable = applyAndRenderAnalisaTable;
window.exportAnalisaCSV = exportAnalisaCSV;