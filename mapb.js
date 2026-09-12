// ==========================================
// MAPB.JS - POP UP DETAIL INFORMASI TENANT
// ==========================================

/**
 * Mengambil detail lengkap tenant dari Supabase dan menampilkan pop-up
 * @param {number|string} noTenant - ID/No tenant yang diklik
 */
async function showTenantDetailPopup(noTenant) {
  if (!noTenant) return;

  // Tampilkan indikator loading sementara pada card
  const floatingCard = document.getElementById('floating-detail-card');
  const contentContainer = document.getElementById('floating-detail-content');

  if (!floatingCard || !contentContainer) return;

  contentContainer.innerHTML = `
    <div class="p-4 text-center text-slate-500 dark:text-slate-400">
      <i class="fa-solid fa-circle-notch fa-spin text-lg text-blue-500 mb-1"></i>
      <p class="text-xs">Memuat detail lokasi...</p>
    </div>
  `;

  floatingCard.classList.remove('translate-x-[120%]', 'opacity-0', 'pointer-events-none');
  floatingCard.classList.add('translate-x-0', 'opacity-100', 'pointer-events-auto');

  try {
    // Query data lengkap dari database Supabase tabel "tenant"
    const { data, error } = await supabaseClient
      .from('tenant')
      .select('lokasi, lantai, luas, tipe, penyewa, status, komoditi, cp, validasi')
      .eq('no', noTenant)
      .single();

    if (error) throw error;

    if (!data) {
      contentContainer.innerHTML = `
        <div class="p-2 text-xs text-red-500">Data detail tidak ditemukan.</div>
      `;
      return;
    }

    // Format tampilan status
    const statusColor = data.status === 'Terisi' || data.status === 'Aktif' 
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';

    // Render HTML detail lokasi (tanpa kolom koordinat)
    contentContainer.innerHTML = `
      <!-- Header Popup -->
      <div class="flex items-start justify-between border-b border-slate-200 dark:border-zinc-800 pb-2 mb-3">
        <div class="pr-2 min-w-0">
          <span class="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
            Lantai ${escapeHtml(data.lantai || '-')}
          </span>
          <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug mt-0.5 truncate">
            ${escapeHtml(data.lokasi || 'Tanpa Nama')}
          </h3>
        </div>
        <button onclick="closeFloatingCard()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full text-xs transition cursor-pointer">
          ✕
        </button>
      </div>

      <!-- Detail Informasi Tabel Tenant -->
      <div class="space-y-2 text-xs text-slate-700 dark:text-slate-300 max-h-[70vh] overflow-y-auto custom-scroll pr-1">
        
        <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
          <span class="text-slate-400 font-medium">Status</span>
          <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusColor}">
            ${escapeHtml(data.status || '-')}
          </span>
        </div>

        <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
          <span class="text-slate-400 font-medium">Penyewa</span>
          <span class="font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(data.penyewa || '-')}</span>
        </div>

        <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
          <span class="text-slate-400 font-medium">Tipe</span>
          <span class="font-medium">${escapeHtml(data.tipe || '-')}</span>
        </div>

        <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
          <span class="text-slate-400 font-medium">Luas Area</span>
          <span class="font-medium">${escapeHtml(data.luas ? data.luas + ' m²' : '-')}</span>
        </div>

        <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
          <span class="text-slate-400 font-medium">Komoditi</span>
          <span class="font-medium">${escapeHtml(data.komoditi || '-')}</span>
        </div>

        <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
          <span class="text-slate-400 font-medium">Contact Person (CP)</span>
          <span class="font-medium">${escapeHtml(data.cp || '-')}</span>
        </div>

        <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-zinc-800">
          <span class="text-slate-400 font-medium">Validasi</span>
          <span class="font-medium">${escapeHtml(data.validasi || '-')}</span>
        </div>

      </div>
    `;

  } catch (err) {
    console.error("Gagal mengambil detail tenant:", err);
    contentContainer.innerHTML = `
      <div class="p-2 text-xs text-red-500">Gagal memuat informasi tenant.</div>
    `;
  }
}