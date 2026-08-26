/**
 * Global Navigation Controller - App Shell Hydration Mode
 * Memuat Header Terpusat dengan Navigasi RBAC & Custom Hamburger Menu
 */
function renderHeader({ subtitle, hamburgerItems = [] } = {}) {
    // 1. Pemetaan Otomatis Nama File URL ke Nama Modul Dashboard
    const moduleMap = {
        "eskalasi": "Eskalasi",
        "rkm": "RKM",
        "sr": "Dok. Perbaikan",
        "tasks": "Tasks",
        "syncflow": "Syncflow",
        "inventory": "Inventory",
        "logistics": "Logistics",
        "access": "Access Control"
    };

    // 2. Deteksi otomatis lokasi URL jika subtitle tidak diisi manual
    const path = window.location.pathname.toLowerCase();
    let autoSubtitle = subtitle;

    if (!autoSubtitle) {
        if (path.includes("dashboard.html") || path === "/" || path.endsWith("/")) {
            // Khusus Dashboard: Membiarkan template bawaan/profil user
            autoSubtitle = null; 
        } else {
            // Cari modul berdasarkan keyword URL
            for (const [key, name] of Object.entries(moduleMap)) {
                if (path.includes(key)) {
                    autoSubtitle = name;
                    break;
                }
            }
        }
    }

    // Update Subtitle Modul Aktif secara instan (jika ditentukan/ditemukan)
    const subtitleEl = document.getElementById('header-subtitle-text');
    if (subtitleEl && autoSubtitle !== null) {
        subtitleEl.textContent = autoSubtitle;
    }

    // 3. Render Isi Navigasi Utama (Hanya jika belum dirender)
    const navMenu = document.getElementById('navDropdownMenu');
    if (navMenu && !navMenu.hasChildNodes()) {
        navMenu.innerHTML = `
            <div class="px-4 py-2 border-b border-slate-800 flex items-center gap-2.5 mb-1">
                <div id="dropdown-user-avatar" class="w-7 h-7 min-w-[28px] min-h-[28px] rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs leading-none">U</div>
                <div class="truncate">
                    <span id="dropdown-user-name" class="font-semibold text-white block truncate text-xs leading-tight">User Profile</span>
                    <span class="text-[10px] text-slate-400 block leading-tight">Pengguna Aktif</span>
                </div>
            </div>

            <a href="dashboard.html" class="px-4 py-2 hover:bg-slate-800 hover:text-white flex items-center gap-2.5 transition text-xs no-underline text-slate-300">
                <svg class="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 00-1 1m-6 0h6"/></svg> Dashboard
            </a>
            <div class="my-1 border-t border-slate-800"></div>

            <a id="nav-eskalasi" href="eskalasi.html" class="hidden px-4 py-2 hover:bg-slate-800 hover:text-white flex items-center gap-2.5 transition text-xs no-underline text-slate-300">
                <svg class="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Eskalasi
            </a>
            <a id="nav-rkm" href="RKM.html" class="hidden px-4 py-2 hover:bg-slate-800 hover:text-white flex items-center gap-2.5 transition text-xs no-underline text-slate-300">
                <svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> RKM
            </a>
            <a id="nav-dokPerbaikan" href="sr.html" class="hidden px-4 py-2 hover:bg-slate-800 hover:text-white flex items-center gap-2.5 transition text-xs no-underline text-slate-300">
                <svg class="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Dok. Perbaikan
            </a>
            <a id="nav-tasks" href="tasks.html" class="hidden px-4 py-2 hover:bg-slate-800 hover:text-white flex items-center gap-2.5 transition text-xs no-underline text-slate-300">
                <svg class="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg> Tasks
            </a>
            <a id="nav-syncflow" href="syncflow.html" class="hidden px-4 py-2 hover:bg-slate-800 hover:text-white flex items-center gap-2.5 transition text-xs no-underline text-slate-300">
                <svg class="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Syncflow
            </a>
            <div class="my-1 border-t border-slate-800"></div>

            <a id="nav-inventory" href="inventory.html" class="hidden px-4 py-2 hover:bg-slate-800 hover:text-white flex items-center gap-2.5 transition text-xs no-underline text-slate-300">
                <svg class="w-4 h-4 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg> Inventory
            </a>
            <a id="nav-logistics" href="logistics.html" class="hidden px-4 py-2 hover:bg-slate-800 hover:text-white flex items-center gap-2.5 transition text-xs no-underline text-slate-300">
                <svg class="w-4 h-4 text-teal-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg> Logistics
            </a>
            <a id="nav-access" href="access.html" class="hidden px-4 py-2 hover:bg-slate-800 hover:text-white flex items-center gap-2.5 transition text-xs no-underline text-slate-300">
                <svg class="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg> Access Control
            </a>
            <div class="my-1 border-t border-slate-800"></div>

            <!-- Tombol Keluar (Logout) Terperbaiki -->
            <button type="button" onclick="handleLogout()" class="w-full px-4 py-2.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 flex items-center gap-2.5 transition text-xs font-medium border-0 bg-transparent cursor-pointer text-left m-0 rounded-none">
                <svg class="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Keluar</span>
            </button>`;
    }

    // 4. Render isi menu hamburger kustom modul
    renderHamburgerContent(hamburgerItems);
    
    // 5. Jalankan pengecekan hak akses RBAC
    initNavbarAccess();
}

function renderHamburgerContent(items) {
    const container = document.getElementById('custom-hamburger-content');
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = `<span class="block px-4 py-2 text-xs text-slate-400 italic">Tidak ada menu</span>`;
        return;
    }

    container.innerHTML = items.map(item => `
        <button type="button" onclick="${item.onClick}; closeConnDropdown();" class="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition flex items-center gap-2 cursor-pointer border-0 bg-transparent m-0">
            ${item.icon || ''}
            <span>${item.label}</span>
        </button>
    `).join('');
}

function handleLogout() {
    if (confirm("Apakah Anda yakin ingin keluar dari sistem?")) {
        localStorage.removeItem("user");
        sessionStorage.clear();
        window.location.replace("login.html");
    }
}

document.addEventListener('click', () => {
    closeConnDropdown();
    closeNavDropdown();
});

function toggleNavDropdown(e) {
    e.stopPropagation();
    closeConnDropdown();
    const navMenu = document.getElementById('navDropdownMenu');
    if (navMenu) navMenu.classList.toggle('hidden');
}

function closeNavDropdown() {
    const navMenu = document.getElementById('navDropdownMenu');
    if (navMenu) navMenu.classList.add('hidden');
}

function toggleConnDropdown(e) {
    e.stopPropagation();
    closeNavDropdown();
    const dropdown = document.getElementById('connDropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

function closeConnDropdown() {
    const dropdown = document.getElementById('connDropdown');
    if (dropdown) dropdown.classList.add('hidden');
}

function initNavbarAccess() {
    const session = localStorage.getItem("user");
    if (!session) return;
    const user = JSON.parse(session);

    const displayName = user.nama || user.username || "User Profile";
    const firstLetter = displayName.charAt(0).toUpperCase();

    const headerAvatarEl = document.getElementById("nav-header-avatar");
    const userNameEl = document.getElementById("dropdown-user-name");
    const avatarEl = document.getElementById("dropdown-user-avatar");

    if (headerAvatarEl) headerAvatarEl.textContent = firstLetter;
    if (userNameEl) userNameEl.textContent = displayName;
    if (avatarEl) avatarEl.textContent = firstLetter;

    const isSuperAdmin = (user.nama || user.username || "").toLowerCase() === "dede hidayat";

    const modules = [
        { id: "nav-eskalasi", key: "eskalasi" },
        { id: "nav-rkm", key: "rkm" },
        { id: "nav-dokPerbaikan", key: "dokPerbaikan" },
        { id: "nav-tasks", key: "tasks" },
        { id: "nav-syncflow", key: "syncflow" },
        { id: "nav-inventory", key: "inventory" },
        { id: "nav-logistics", key: "logistics" },
        { id: "nav-access", key: "access" }
    ];

    modules.forEach(mod => {
        const el = document.getElementById(mod.id);
        if (!el) return;

        let allowed = false;
        if (isSuperAdmin) {
            allowed = true;
        } else if (user.akses && user.akses[mod.key]) {
            const val = String(user.akses[mod.key]).toUpperCase();
            allowed = (val === "Y" || val === "TRUE" || val === "1");
        }

        if (allowed) {
            el.classList.remove("hidden");
        } else {
            el.classList.add("hidden");
        }
    });
}
