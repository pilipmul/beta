/**
 * Modul Analisa Data Spesifik Per Item & Kategori Project
 */

let dbAnalisaItemsList = [];

function initAnalisaModal() {
  if (document.getElementById('analisaModal')) return;

  const modalHtml = `
    <div id="analisaModal" class="analisa-modal-backdrop hidden">
      <div class="analisa-modal-card">
        <!-- Header Modal -->
        <div class="bg-[#f8f9fa] dark:bg-[#252525] px-4 sm:px-6 py-3.5 border-b border-[#f1f3f4] dark:border-[#3c4043] flex justify-between items-center shrink-0">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
            </svg>
            <h3 class="font-bold text-sm sm:text-base text-[#202124] dark:text-[#e8eaed]">Analisa Operasional & Movement Stock</h3>
          </div>
          <!-- Tombol Tutup Atas dengan event.stopPropagation() -->
          <button onclick="closeAnalisaModal(event)" class="text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-white text-xl font-bold cursor-pointer px-2 py-0.5 rounded transition">&times;</button>
        </div>

        <!-- Body Modal -->
        <div class="p-4 sm:p-6 overflow-y-auto custom-scroll space-y-4 flex-1 text-xs">
          
          <!-- Area Filter ganda: Project & Item -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-[#f1f3f4] dark:bg-[#252525] p-3 rounded-xl border border-[#dadce0] dark:border-[#3c4043]">
            <div>
              <label for="analisaSelectProject" class="block font-semibold text-[#5f6368] dark:text-[#bdc1c6] mb-1">Filter Project:</label>
              <select id="analisaSelectProject" onchange="onAnalisaFilterChange()" class="w-full bg-white dark:bg-[#1e1e1e] text-[#202124] dark:text-[#e8eaed] border border-[#dadce0] dark:border-[#3c4043] rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-indigo-500 cursor-pointer">
                <option value="ALL">-- SEMUA PROJECT --</option>
                <option value="ATK">ATK</option>
                <option value="CS">CS</option>
                <option value="ME">ME</option>
                <option value="Sipil">Sipil</option>
              </select>
            </div>

            <div>
              <label for="analisaSelectMasterItem" class="block font-semibold text-[#5f6368] dark:text-[#bdc1c6] mb-1">Filter Spesifik Item:</label>
              <select id="analisaSelectMasterItem" onchange="onAnalisaFilterChange()" class="w-full bg-white dark:bg-[#1e1e1e] text-[#202124] dark:text-[#e8eaed] border border-[#dadce0] dark:border-[#3c4043] rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-indigo-500 cursor-pointer">
                <option value="ALL">-- SEMUA ITEM --</option>
              </select>
            </div>
          </div>

          <!-- Loading State -->
          <div id="analisaLoading" class="py-8 text-center text-[#5f6368] dark:text-[#9aa0a6]">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent mb-2"></div>
            <p class="text-xs">Mengkalkulasi parameter analisa...</p>
          </div>

          <!-- Content State -->
          <div id="analisaContent" class="hidden space-y-4">
            
            <!-- Indicator Movement Status Bar -->
            <div class="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/30 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
              <span class="text-[#5f6368] dark:text-[#bdc1c6] font-medium">Kategori Movement Stock:</span>
              <span id="statMovementBadge" class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-600 text-white">Calculating...</span>
            </div>

            <!-- Grid Card Statistik -->
            <div class="analisa-grid">
              
              <div class="analisa-stat-box">
                <span class="analisa-stat-label">Total Barang Keluar</span>
                <span id="statTotalOut" class="analisa-stat-value text-red-600 dark:text-red-400">0</span>
                <span class="analisa-stat-subtext">Akumulasi unit keluar</span>
              </div>

              <div class="analisa-stat-box">
                <span class="analisa-stat-label">Total Barang Masuk</span>
                <span id="statTotalIn" class="analisa-stat-value text-emerald-600 dark:text-emerald-400">0</span>
                <span class="analisa-stat-subtext">Akumulasi unit masuk</span>
              </div>

              <div class="analisa-stat-box">
                <span class="analisa-stat-label">Rerata Keluar / Bulan</span>
                <span id="statAvgOutMonthly" class="analisa-stat-value">0</span>
                <span class="analisa-stat-subtext">Konsumsi rata-rata bulanan</span>
              </div>

              <div class="analisa-stat-box">
                <span class="analisa-stat-label">Frekuensi Transaksi</span>
                <span id="statTotalTrx" class="analisa-stat-value">0</span>
                <span class="analisa-stat-subtext">Total entri aktivitas</span>
              </div>

            </div>

            <!-- TABEL TOP 10 BARANG PALING SERING KELUAR -->
            <div class="bg-[#f8f9fa] dark:bg-[#252525] p-3.5 rounded-xl border border-[#dadce0] dark:border-[#3c4043] space-y-2">
              <div class="flex justify-between items-center border-b border-[#dadce0] dark:border-[#3c4043] pb-2">
                <h4 class="font-bold text-[#202124] dark:text-[#e8eaed] flex items-center gap-1.5">
                  <span>🔥</span> Top 10 Barang Paling Sering Keluar (Fast Moving)
                </h4>
                <span id="statProjectLabel" class="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">Project: ALL</span>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr class="text-[#5f6368] dark:text-[#bdc1c6] border-b border-[#dadce0] dark:border-[#3c4043]">
                      <th class="py-1 px-1.5 w-[8%] text-center">Rank</th>
                      <th class="py-1 px-1.5 w-[52%]">Nama Barang</th>
                      <th class="py-1 px-1.5 w-[20%] text-center">Frek. Keluar</th>
                      <th class="py-1 px-1.5 w-[20%] text-right">Total Qty Out</th>
                    </tr>
                  </thead>
                  <tbody id="topItemsTableBody" class="divide-y divide-[#f1f3f4] dark:divide-[#3c4043] font-medium">
                    <tr>
                      <td colspan="4" class="py-2 text-center text-[#5f6368] dark:text-[#9aa0a6]">Memuat top 10 item...</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Detail Timeline & Reorder Alert -->
            <div class="bg-[#f8f9fa] dark:bg-[#252525] p-3.5 rounded-xl border border-[#dadce0] dark:border-[#3c4043] space-y-2 text-xs">
              <div class="flex justify-between items-center border-b border-[#dadce0] dark:border-[#3c4043] pb-2">
                <span class="text-[#5f6368] dark:text-[#9aa0a6] flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Transaksi Masuk Terakhir:
                </span>
                <span id="statLastIn" class="font-bold text-[#202124] dark:text-[#e8eaed] text-right truncate max-w-[220px]">-</span>
              </div>

              <div class="flex justify-between items-center border-b border-[#dadce0] dark:border-[#3c4043] pb-2">
                <span class="text-[#5f6368] dark:text-[#9aa0a6] flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-red-500"></span> Transaksi Keluar Terakhir:
                </span>
                <span id="statLastOut" class="font-bold text-[#202124] dark:text-[#e8eaed] text-right truncate max-w-[220px]">-</span>
              </div>

              <div class="flex justify-between items-center pt-0.5">
                <span class="text-[#5f6368] dark:text-[#9aa0a6] font-medium">Saran Batas Minimum Reorder:</span>
                <span id="statReorderAlert" class="font-bold text-[#202124] dark:text-[#e8eaed] text-right">-</span>
              </div>
            </div>

            <!-- Footnote Standard -->
            <p class="text-[11px] text-[#70757a] dark:text-[#9aa0a6] italic">
              * Dihitung secara objektif dari rekaman log transaksi pada database <span class="font-semibold">inventory</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Pasang penutup backdrop saat area luar modal diklik
  const backdrop = document.getElementById('analisaModal');
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAnalisaModal(e);
    });
  }
}

async function openAnalisaModal() {
  initAnalisaModal();

  const modal = document.getElementById('analisaModal');
  modal.classList.remove('hidden');

  await populateItemDropdown();
  await runSpecificAnalysis();
}

async function populateItemDropdown() {
  const selectEl = document.getElementById('analisaSelectMasterItem');
  if (!selectEl) return;

  if (dbAnalisaItemsList.length === 0) {
    try {
      const { data, error } = await _supabase.from('item').select('item').order('item', { ascending: true });
      if (!error && data) {
        dbAnalisaItemsList = Array.from(new Set(data.map(i => i.item).filter(Boolean)));
      }
    } catch (err) {
      console.error('Gagal memuat list barang:', err);
    }
  }

  let optionsHtml = `<option value="ALL">-- SEMUA ITEM --</option>`;
  dbAnalisaItemsList.forEach(itemName => {
    optionsHtml += `<option value="${escapeHtml(itemName)}">${escapeHtml(itemName)}</option>`;
  });
  selectEl.innerHTML = optionsHtml;
}

function onAnalisaFilterChange() {
  runSpecificAnalysis();
}

async function runSpecificAnalysis() {
  const loading = document.getElementById('analisaLoading');
  const content = document.getElementById('analisaContent');

  const selectedProject = document.getElementById('analisaSelectProject')?.value || 'ALL';
  const selectedItem = document.getElementById('analisaSelectMasterItem')?.value || 'ALL';

  loading.classList.remove('hidden');
  content.classList.add('hidden');

  try {
    let historyQuery = _supabase.from('inventory').select('in, out, date, item, project');
    let lastInQuery = _supabase.from('inventory').select('item, in, date, project').gt('in', 0).order('date', { ascending: false }).limit(1);
    let lastOutQuery = _supabase.from('inventory').select('item, out, date, project').gt('out', 0).order('date', { ascending: false }).limit(1);

    if (selectedProject !== 'ALL') {
      historyQuery = historyQuery.ilike('project', `%${selectedProject}%`);
      lastInQuery = lastInQuery.ilike('project', `%${selectedProject}%`);
      lastOutQuery = lastOutQuery.ilike('project', `%${selectedProject}%`);
    }

    if (selectedItem !== 'ALL') {
      historyQuery = historyQuery.eq('item', selectedItem);
      lastInQuery = lastInQuery.eq('item', selectedItem);
      lastOutQuery = lastOutQuery.eq('item', selectedItem);
    }

    const [historyRes, lastInRes, lastOutRes] = await Promise.all([
      historyQuery,
      lastInQuery,
      lastOutQuery
    ]);

    if (historyRes.error) throw historyRes.error;

    const data = historyRes.data || [];
    const totalTrx = data.length;

    let totalIn = 0;
    let totalOut = 0;
    const uniqueMonths = new Set();
    const itemOutAggregator = {};

    data.forEach(row => {
      const valIn = Number(row.in) || 0;
      const valOut = Number(row.out) || 0;

      totalIn += valIn;
      totalOut += valOut;

      if (row.date) uniqueMonths.add(String(row.date).slice(0, 7));

      if (row.item && valOut > 0) {
        if (!itemOutAggregator[row.item]) {
          itemOutAggregator[row.item] = { totalQty: 0, frequency: 0 };
        }
        itemOutAggregator[row.item].totalQty += valOut;
        itemOutAggregator[row.item].frequency += 1;
      }
    });

    const monthsCount = uniqueMonths.size || 1;
    const avgOutMonthly = (totalOut / monthsCount).toFixed(1);

    const lastInTrx = lastInRes.data && lastInRes.data[0] ? lastInRes.data[0] : null;
    const lastOutTrx = lastOutRes.data && lastOutRes.data[0] ? lastOutRes.data[0] : null;

    const badgeEl = document.getElementById('statMovementBadge');
    if (totalOut > 50) {
      badgeEl.className = "px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white";
      badgeEl.innerText = "FAST MOVING";
    } else if (totalOut >= 10) {
      badgeEl.className = "px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-600 text-white";
      badgeEl.innerText = "MEDIUM MOVING";
    } else if (totalOut > 0) {
      badgeEl.className = "px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-white";
      badgeEl.innerText = "SLOW MOVING";
    } else {
      badgeEl.className = "px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-600 text-white";
      badgeEl.innerText = "DEAD STOCK";
    }

    document.getElementById('statTotalOut').innerText = totalOut.toLocaleString('id-ID');
    document.getElementById('statTotalIn').innerText = totalIn.toLocaleString('id-ID');
    document.getElementById('statAvgOutMonthly').innerText = avgOutMonthly.toLocaleString('id-ID');
    document.getElementById('statTotalTrx').innerText = totalTrx.toLocaleString('id-ID');

    document.getElementById('statLastIn').innerText = lastInTrx 
      ? `${lastInTrx.item || '-'} (${lastInTrx.in}) - ${lastInTrx.date || '-'}` 
      : '-';

    document.getElementById('statLastOut').innerText = lastOutTrx 
      ? `${lastOutTrx.item || '-'} (${lastOutTrx.out}) - ${lastOutTrx.date || '-'}` 
      : '-';

    const recommendedMinStock = Math.ceil(avgOutMonthly * 0.5);
    document.getElementById('statReorderAlert').innerText = selectedItem !== 'ALL' 
      ? `Reorder stok jika ketersediaan < ${recommendedMinStock} unit`
      : 'Pilih item spesifik untuk rekomendasi reorder';

    renderTop10ItemsTable(itemOutAggregator);
    document.getElementById('statProjectLabel').innerText = `Project: ${selectedProject}`;

    loading.classList.add('hidden');
    content.classList.remove('hidden');
  } catch (err) {
    alert('Gagal memuat analisa: ' + err.message);
    closeAnalisaModal();
  }
}

function renderTop10ItemsTable(aggregator) {
  const tbody = document.getElementById('topItemsTableBody');
  tbody.innerHTML = '';

  const sortedItems = Object.keys(aggregator)
    .map(key => ({
      item: key,
      totalQty: aggregator[key].totalQty,
      frequency: aggregator[key].frequency
    }))
    .sort((a, b) => b.frequency - a.frequency || b.totalQty - a.totalQty)
    .slice(0, 10);

  if (sortedItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-2 text-center text-[#5f6368] dark:text-[#9aa0a6]">Tidak ada data barang keluar untuk kategori ini.</td></tr>`;
    return;
  }

  sortedItems.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-[#f1f3f4] dark:hover:bg-[#1e1e1e] transition-colors';
    
    tr.innerHTML = `
      <td class="py-1.5 px-1.5 text-center font-bold text-indigo-600 dark:text-indigo-400">#${idx + 1}</td>
      <td class="py-1.5 px-1.5 font-semibold text-[#202124] dark:text-[#e8eaed] truncate max-w-[180px]">${escapeHtml(row.item)}</td>
      <td class="py-1.5 px-1.5 text-center text-[#5f6368] dark:text-[#bdc1c6]">${row.frequency} kali</td>
      <td class="py-1.5 px-1.5 text-right font-mono font-bold text-red-600 dark:text-red-400">${row.totalQty.toLocaleString('id-ID')}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Fungsi closeAnalisaModal yang sudah menangani propagation event
function closeAnalisaModal(e) {
  if (e) e.stopPropagation();
  const modal = document.getElementById('analisaModal');
  if (modal) modal.classList.add('hidden');
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