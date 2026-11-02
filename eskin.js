// --- KONFIGURASI SUPABASE & LOGO ---
const SUPABASE_URL = "https://sfblelnbczlvykqemhtm.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_9k7sUNqlqhRqjkUtSNpFPQ_VAspSZT0"; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const LOGO_SUPABASE_URL = "https://sotpbc.vercel.app/Logon%20PCN.jpg";
let logoBase64 = null;

let itemMap = {}; 
let itemOptions = [];
const userList = ["Dede H.", "Edo S.", "Sutriono", "(....................)"];
let rowCount = 0;
let isEditMode = false; // Flag untuk penanda mode Edit / Baru

// Utility Convert Gambar ke Base64
function fetchImageAsBase64(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            } catch (e) {
                console.error("Gagal konversi logo:", e);
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

function formatRupiah(val) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);
}

// FUNGSI PAKSA SEMBUNYIKAN/TAMPILKAN TOMBOL ADD ITEM
function updateBtnAddVisibility() {
    const btnAdd = document.getElementById("btnAddRow");
    const tbody = document.getElementById("itemRows");
    if (!btnAdd) return;

    const actualRows = tbody ? tbody.children.length : rowCount;
    rowCount = actualRows;

    if (rowCount >= 13) {
        btnAdd.style.display = "none";
        btnAdd.classList.add("hidden");
    } else {
        btnAdd.style.display = "inline-flex";
        btnAdd.classList.remove("hidden");
    }
}

// FUNGSI RESET FORM & DRAFT ITEM
function resetFormEskalasi() {
    const form = document.getElementById("formEskin");
    if (form) form.reset();

    const tbody = document.getElementById("itemRows");
    if (tbody) tbody.innerHTML = "";
    
    rowCount = 0;
    isEditMode = false; // Reset mode kembali ke buat baru

    tambahBaris();

    // Hanya panggil nomor eskalasi baru jika bukan mode edit
    fetchNextNomor();
}

// Fungsi Buka & Tutup Modal Pop-up
function openModalEskalasi() {
    const modal = document.getElementById("modalEskalasiBaru");
    if (modal) {
        requestAnimationFrame(() => {
            modal.classList.add("active");
        });
    }
}

function closeModalEskalasi() {
    const modal = document.getElementById("modalEskalasiBaru");
    if (modal) {
        modal.classList.remove("active");
        resetFormEskalasi();
    }
}

// FUNGSI AMBIL DATA ESKALASI DARI SUPABASE UNTUK DIEDIT
async function loadAndEditEskalasi(kodeEskalasi) {
    try {
        const { data, error } = await supabaseClient
            .from('eskalasi')
            .select('*')
            .eq('kode', kodeEskalasi)
            .single();

        if (error) throw error;

        if (data) {
            isEditMode = true; // Set mode ke Edit
            
            // 1. Isi input utama
            document.getElementById("displayKode").value = data.kode || "";
            document.getElementById("subject").value = data.subject || "";
            document.getElementById("nilai").value = data.nilai || 0;

            // 2. Isi penanggung jawab dari kolom JSONB 'pic'
            if (data.pic) {
                document.getElementById("diajukan").value = data.pic.diajukan || "";
                document.getElementById("diketahui").value = data.pic.diketahui || "";
                document.getElementById("disetujui").value = data.pic.disetujui || "";
            }

            // 3. Reset tabel item & isi dari kolom JSONB 'item'
            const tbody = document.getElementById("itemRows");
            if (tbody) tbody.innerHTML = "";
            rowCount = 0;

            const itemsArray = data.item || [];
            if (Array.isArray(itemsArray) && itemsArray.length > 0) {
                itemsArray.forEach(itm => {
                    tambahBaris();
                    const rows = tbody.querySelectorAll("tr");
                    const currentRow = rows[rows.length - 1];

                    if (currentRow) {
                        currentRow.querySelector(".item-name").value = itm.name || "";
                        currentRow.querySelector(".item-qty").value = itm.qty || 0;
                        currentRow.querySelector(".item-cost").value = itm.cost || 0;
                    }
                });
            } else {
                tambahBaris();
            }

            hitungTotal();
            openModalEskalasi();
        }
    } catch (err) {
        console.error("Gagal memuat data eskalasi:", err);
        alert("Gagal mengambil data dari database!");
    }
}

// Logic Auto-fill & Suggestion
function cekAutofill() {
    const diajukanVal = document.getElementById("diajukan").value.trim();
    if (diajukanVal === "Dede H.") {
        document.getElementById("diketahui").value = "Edo S.";
        document.getElementById("disetujui").value = "Sutriono";
    } else if (diajukanVal === "Edo S.") {
        document.getElementById("diketahui").value = "Sutriono";
        document.getElementById("disetujui").value = "(....................)";
    }
}

function showUserSuggestions(input) {
    const listContainer = input.nextElementSibling;
    const val = input.value.toLowerCase();
    listContainer.innerHTML = "";
    const filtered = val === "" ? userList : userList.filter(x => x.toLowerCase().includes(val));
    if(filtered.length) listContainer.classList.remove("hidden");

    filtered.forEach(name => {
        const div = document.createElement("div");
        div.className = "px-4 py-2.5 text-xs text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] hover:text-[#1a73e8] dark:hover:text-[#8ab4f8] cursor-pointer transition";
        div.innerHTML = name;
        div.onclick = () => { 
            input.value = name; 
            listContainer.innerHTML = ""; 
            listContainer.classList.add("hidden");
            if (input.id === "diajukan") cekAutofill();
        };
        listContainer.appendChild(div);
    });
    if (input.id === "diajukan") cekAutofill();
}

function showItemSuggestions(input) {
    const listContainer = input.nextElementSibling;
    const val = input.value.trim().toLowerCase();
    listContainer.innerHTML = "";
    
    if (!val) {
        listContainer.classList.add("hidden");
        return;
    }

    const filtered = itemOptions.filter(x => x && x.toLowerCase().includes(val));
    if (filtered.length === 0) {
        listContainer.classList.add("hidden");
        return;
    }

    listContainer.classList.remove("hidden");
    filtered.forEach(item => {
        const div = document.createElement("div");
        div.className = "px-4 py-2.5 text-xs text-[#202124] dark:text-[#e8eaed] hover:bg-[#f1f3f4] dark:hover:bg-[#3c4043] hover:text-[#1a73e8] dark:hover:text-[#8ab4f8] cursor-pointer transition";
        div.innerHTML = item;
        div.onclick = () => { 
            input.value = item; 
            listContainer.innerHTML = ""; 
            listContainer.classList.add("hidden");
        };
        listContainer.appendChild(div);
    });
}

// Tambah Baris Item
function tambahBaris() {
    const tbody = document.getElementById("itemRows");
    if (!tbody) return;

    if (tbody.children.length >= 13) {
        updateBtnAddVisibility();
        return;
    }

    const isFirstRow = tbody.children.length === 0;

    const tr = document.createElement("tr");
    tr.className = "hover:bg-[#f8f9fa] dark:hover:bg-[#252525] transition-colors group relative";
    
    const deleteBtnHtml = !isFirstRow ? `
        <button type="button" onclick="hapusBaris(this)" class="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 inline-flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10" title="Hapus Baris">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
        </button>
    ` : '';

    tr.innerHTML = `
        <td class="p-2">
            <div class="relative w-full">
                <input type="text" class="item-name w-full !bg-[#f1f3f4] dark:!bg-[#2d2d2d] !text-[#202124] dark:!text-[#e8eaed] border border-transparent dark:border-[#3c4043] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#1a73e8] dark:focus:border-[#8ab4f8] transition" placeholder="Ketik nama item..." oninput="showItemSuggestions(this)">
                <div class="autocomplete-list absolute left-0 right-0 mt-1 bg-white dark:bg-[#252525] border border-[#dadce0] dark:border-[#3c4043] rounded-xl max-h-40 overflow-y-auto z-50 shadow-lg hidden divide-y divide-[#f1f3f4] dark:divide-[#3c4043]"></div>
            </div>
        </td>
        <td class="p-2">
            <input type="text" inputmode="numeric" class="item-qty w-full !bg-[#f1f3f4] dark:!bg-[#2d2d2d] !text-[#202124] dark:!text-[#e8eaed] border border-transparent dark:border-[#3c4043] rounded-xl px-3 py-1.5 text-xs text-center outline-none focus:border-[#1a73e8] dark:focus:border-[#8ab4f8] transition" placeholder="0" oninput="this.value = this.value.replace(/[^0-9]/g, ''); hitungTotal()">
        </td>
        <td class="p-2 relative">
            <input type="text" inputmode="numeric" class="item-cost w-full !bg-[#f1f3f4] dark:!bg-[#2d2d2d] !text-[#202124] dark:!text-[#e8eaed] border border-transparent dark:border-[#3c4043] rounded-xl pl-3 pr-8 py-1.5 text-xs text-center outline-none focus:border-[#1a73e8] dark:focus:border-[#8ab4f8] transition" placeholder="0" oninput="this.value = this.value.replace(/[^0-9]/g, ''); hitungTotal()">
            ${deleteBtnHtml}
        </td>
    `;
    tbody.appendChild(tr);

    updateBtnAddVisibility();
}

// Hapus Baris Item Spesifik
function hapusBaris(btn) {
    const tr = btn.closest("tr");
    if (!tr) return;
    
    tr.remove();
    updateBtnAddVisibility();
    hitungTotal();
}

function hitungTotal() {
    let total = 0;
    document.querySelectorAll("#itemRows tr").forEach(row => {
        const qtyEl = row.querySelector(".item-qty");
        const costEl = row.querySelector(".item-cost");
        if (qtyEl && costEl) {
            total += (Number(qtyEl.value) || 0) * (Number(costEl.value) || 0);
        }
    });
    const nilaiEl = document.getElementById("nilai");
    if (nilaiEl) nilaiEl.value = total;
}

async function fetchNextNomor() {
    if (isEditMode) return; // Jangan generate jika mode edit

    try {
        const { data, error } = await supabaseClient
            .from('eskalasi')
            .select('kode, no')
            .order('no', { ascending: false })
            .limit(1);

        if (error) throw error;

        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();

        if (data && data.length > 0 && data[0].kode) {
            const lastKode = data[0].kode; 
            const parts = lastKode.split(/[\/\.]/); 
            const lastNum = parseInt(parts[0], 10) || 0;
            const nextNum = String(lastNum + 1).padStart(2, '0');
            document.getElementById("displayKode").value = `${nextNum}/PTPCN/PBC/${mm}/${yyyy}`;
        } else {
            document.getElementById("displayKode").value = `01/PTPCN/PBC/${mm}/${yyyy}`;
        }
    } catch (e) {
        console.error("Gagal generate kode:", e);
        document.getElementById("displayKode").value = "ERR/PTPCN/PBC/2026";
    }
}

// Generate File PDF via jsPDF & AutoTable
function generateLocalPDF(payload) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });

    const kode = payload.kode;
    const subject = payload.subject;
    const totalFormatted = formatRupiah(payload.nilai);
    const diajukan = payload.diajukan || "Sutriono";
    const diketahui = payload.diketahui || "(....................)";
    const disetujui = payload.disetujui || "(....................)";
    const dept = payload.departemen || "TCBU PBC";

    function drawLogo() {
        if (logoBase64) {
            try { doc.addImage(logoBase64, 'JPEG', 10, 6, 18, 18); } catch (e) {}
        }
    }

    const coaUniqueSet = [];
    payload.items.forEach(itm => {
        const master = itemMap[itm.name.trim()];
        if (master && master.coa && !coaUniqueSet.includes(master.coa)) {
            coaUniqueSet.push(master.coa);
        }
    });
    const ketCOA = coaUniqueSet.length > 0 ? `Penambahan ke COA ${coaUniqueSet.join(", ")}` : "-";

    // Halaman 1
    drawLogo();
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("FORMULIR PENGAJUAN TAMBAHAN BUDGET", 115, 12, { align: "center" });
    doc.setFontSize(14);
    doc.text("ESKALASI BUDGET", 115, 18, { align: "center" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`No. : ${kode}`, 115, 23, { align: "center" });
    doc.setLineWidth(0.5); doc.line(10, 26, 200, 26);

    doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(`DEPARTEMEN / PROYEK : ${dept}`, 10, 32);

    doc.autoTable({
        startY: 36,
        head: [['JENIS BIAYA', 'BUDGET AWAL', 'ACTUAL', 'VARIANCE', 'TAMBAHAN BUDGET', 'KETERANGAN']],
        body: [
            [subject, "Rp. -", totalFormatted, "100%", totalFormatted, ketCOA],
            [{ content: 'Total', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, { content: totalFormatted, styles: { fontStyle: 'bold' } }, '']
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' }
    });

    let finalY1 = doc.lastAutoTable.finalY + 5;
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("Catatan :", 10, finalY1);
    doc.setFont("helvetica", "normal");
    doc.text("1. Pengajuan Eskalasi Budget dapat dilakukan apabila budget awal vs Actual sudah melewati dari standard Variance yang ditetapkan", 10, finalY1 + 4);
    doc.text("2. Form Ini tidak berlaku untuk pengajuan Non Budget (Pengajuan Non Budget harus menggunakan Memo internal yang disetujui Direksi)", 10, finalY1 + 8);

    const sigY1 = finalY1 + 18;
    doc.text("Diajukan,", 35, sigY1, { align: "center" }); doc.text(diajukan, 35, sigY1 + 12, { align: "center" });
    doc.text("Diketahui,", 105, sigY1, { align: "center" }); doc.text(diketahui, 105, sigY1 + 12, { align: "center" });
    doc.text("Disetujui,", 175, sigY1, { align: "center" }); doc.text(disetujui, 175, sigY1 + 12, { align: "center" });

    // Halaman 2 - Memo Internal
    doc.addPage();
    drawLogo();
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("MEMO INTERNAL", 115, 14, { align: "center" });
    doc.setFontSize(10);
    doc.text("PENGAJUAN DANA NON BUDGET", 115, 19, { align: "center" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`NO : ${kode}`, 115, 24, { align: "center" });
    doc.line(10, 27, 200, 27);
    doc.text("Kepada Divisi Budget Citanusa Group, Dengan ini kami mengajukan dana eskalasi non-budget, dengan rincian sebagai berikut :", 10, 33);

    doc.autoTable({
        startY: 37,
        body: [
            ["DEPARTEMEN", ":", dept],
            ["PROJECT", ":", subject],
            ["BIAYA YANG DIAJUKAN", ":", totalFormatted],
            ["NOMINAL PENGAJUAN", ":", totalFormatted],
            ["ALASAN PENGAJUAN", ":", "Belum masuk dalam budget yang telah diajukan, karena dana tidak masuk dalam pemakaian rutin."]
        ],
        theme: 'plain',
        styles: { fontSize: 8.5, cellPadding: 1.5 }
    });

    const sigY2 = doc.lastAutoTable.finalY + 15;
    doc.setFont("helvetica", "bold");
    doc.text("Diajukan,", 50, sigY2, { align: "center" }); doc.text(diketahui, 50, sigY2 + 12, { align: "center" });
    doc.text("Disetujui,", 160, sigY2, { align: "center" }); doc.text(disetujui, 160, sigY2 + 12, { align: "center" });
    doc.setFontSize(7.5); doc.setFont("helvetica", "italic");
    doc.text("*Memo Internal ini harus diajukan bersamaan dengan Formulir Pengajuan Tambahan Budget (Eskalasi budget)", 10, sigY2 + 20);

    // Halaman 3 - Detail Rincian Item
    doc.addPage();
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(subject, 115, 12, { align: "center" });

    const tableRows = [];
    for(let i = 0; i < 13; i++) {
        const itm = payload.items[i] || {};
        const name = itm.name ? itm.name.trim() : "";
        const master = itemMap[name] || {};
        
        tableRows.push([
            i + 1,
            name ? (master.code || "") : "",
            name,
            name ? (itm.qty || "") : "",
            name ? (master.satuan || "") : "",
            name ? formatRupiah(itm.cost) : "",
            name ? formatRupiah((itm.qty || 0) * (itm.cost || 0)) : "",
            name ? (master.coa ? `Penambahan ke COA ${master.coa}` : "") : ""
        ]);
    }

    doc.autoTable({
        startY: 16,
        head: [['No', 'Kode Item', 'Item', 'Qty', 'Satuan', 'Biaya', 'Jumlah', 'Keterangan']],
        body: [
            ...tableRows,
            [{ content: 'TOTAL (inc. Ppn & Pph)', colSpan: 6, styles: { halign: 'center', fontStyle: 'bold' } }, { content: totalFormatted, styles: { fontStyle: 'bold' } }, '']
        ],
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 1.5 },
        headStyles: { fillColor: [228, 236, 245], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' }
    });

    const sigY3 = doc.lastAutoTable.finalY + 12;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text("Diajukan,", 35, sigY3, { align: "center" }); doc.text("Dede H.", 35, sigY3 + 12, { align: "center" });
    doc.text("Diketahui,", 105, sigY3, { align: "center" }); doc.text("Edo S.", 105, sigY3 + 12, { align: "center" });
    doc.text("Disetujui,", 175, sigY3, { align: "center" }); doc.text("Sutriono", 175, sigY3 + 12, { align: "center" });

    doc.save(`${kode.replace(/[\/\.]/g, ".")}_${subject}.pdf`);
}

// Inisialisasi Modul Eskalasi
async function initEskin() {
    try {
        logoBase64 = await fetchImageAsBase64(LOGO_SUPABASE_URL);
        await fetchNextNomor();

        const { data: itemsData, error: itemsError } = await supabaseClient.from('item').select('*');
        if (itemsError) throw itemsError;

        if (itemsData) {
            itemsData.forEach(i => {
                const name = i.item || i.goods || i.goods_description || i.nama_item;
                if(name) {
                    itemOptions.push(name);
                    itemMap[name.trim()] = {
                        code: i.code || i.kode_item || "",
                        satuan: i.satuan || "",
                        coa: i.coa || ""
                    };
                }
            });
            const tbody = document.getElementById("itemRows");
            if (tbody && tbody.children.length === 0) tambahBaris();
        }
        
        updateBtnAddVisibility();
        
        const btnSubmit = document.getElementById("btnSubmit");
        if (btnSubmit) btnSubmit.disabled = false;
    } catch (e) { 
        console.error("Init Error Eskalasi:", e);
    }
}

// Global Event Listeners & Submit Handler
document.addEventListener("click", (e) => {
    if (!e.target.matches('.user-search, .item-name')) {
        document.querySelectorAll(".autocomplete-list").forEach(l => {
            l.innerHTML = "";
            l.classList.add("hidden");
        });
    }
});

document.addEventListener("DOMContentLoaded", () => {
    initEskin();

    const form = document.getElementById("formEskin");
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById("btnSubmit");
            btn.innerHTML = `<div class="animate-spin h-4 w-4 border-2 border-slate-300 border-t-white rounded-full"></div> Memproses...`;
            btn.disabled = true;
        
            try {
                const kode = document.getElementById("displayKode").value;
                const subject = document.getElementById("subject").value;
                const nilai = Number(document.getElementById("nilai").value) || 0;
                const diajukan = document.getElementById("diajukan").value;
                const diketahui = document.getElementById("diketahui").value;
                const disetujui = document.getElementById("disetujui").value;

                // 1. Ambil daftar items
                const itemsList = [];
                document.querySelectorAll("#itemRows tr").forEach(row => {
                    const nameEl = row.querySelector(".item-name");
                    const qtyEl = row.querySelector(".item-qty");
                    const costEl = row.querySelector(".item-cost");
                    
                    if (nameEl && nameEl.value.trim()) {
                        itemsList.push({ 
                            name: nameEl.value.trim(), 
                            qty: Number(qtyEl.value) || 0, 
                            cost: Number(costEl.value) || 0 
                        });
                    }
                });

                // 2. Format objek PIC
                const picData = { diajukan, diketahui, disetujui };

                // 3. Simpan / Edit ke Supabase Database
                let dbError = null;
                if (isEditMode) {
                    // Update data berdasarkan kode eskalasi
                    const { error } = await supabaseClient
                        .from('eskalasi')
                        .update({ subject, nilai, pic: picData, item: itemsList })
                        .eq('kode', kode);
                    dbError = error;
                } else {
                    // Insert data baru
                    const { error } = await supabaseClient
                        .from('eskalasi')
                        .insert([{ kode, subject, nilai, pic: picData, item: itemsList }]);
                    dbError = error;
                }

                if (dbError) throw new Error("Gagal simpan ke database: " + dbError.message);

                generateLocalPDF({ kode, subject, nilai, diajukan, diketahui, disetujui, items: itemsList });

                alert(isEditMode ? "Data Eskalasi Berhasil Diperbarui & PDF Diunduh!" : "Data Eskalasi Berhasil Disimpan & PDF Diunduh!"); 
                closeModalEskalasi();
                if (typeof loadData === 'function') loadData(); 
            } catch (err) { 
                console.error(err);
                alert("Proses Gagal: " + err.message);
            } finally { 
                btn.disabled = false;
                btn.innerText = "Submit & Download PDF";
            }
        };
    }
});