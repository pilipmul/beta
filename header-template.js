/**
 * Global Navigation Controller - Expandable Sidebar Mode
 */
function renderHeader({ subtitle } = {}) {
    const path = window.location.pathname.toLowerCase();
    
    const moduleMap = {
        "eskalasi": "Eskalasi",
        "rkm": "RKM",
        "sr": "Dok. Perbaikan",
        "tasks": "Tasks",
        "syncflow": "Syncflow",
        "inventory": "Inventory",
        "logistics": "Logistics",
        "access": "Access Control",
        "assets": "Assets"
    };

    let autoSubtitle = subtitle;
    if (!autoSubtitle) {
        for (const [key, name] of Object.entries(moduleMap)) {
            if (path.includes(key)) {
                autoSubtitle = name;
                break;
            }
        }
    }

    const globalHeaderWrapper = document.getElementById('global-header');
    if (globalHeaderWrapper) {
        globalHeaderWrapper.innerHTML = `
          <aside id="sidebar" class="sidebar-expanded min-h-screen flex flex-col fixed left-0 top-0 z-50">
            <div class="p-4 border-b border-slate-800 flex items-center justify-between h-16">
              <div class="flex items-center gap-3 overflow-hidden">
                <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                  <span id="nav-header-avatar">U</span>
                </div>
                <div class="sidebar-text truncate">
                  <h1 class="text-xs font-bold leading-tight truncate">SOT Portal</h1>
                  <p id="header-subtitle-text" class="text-[10px] text-slate-400 truncate">${autoSubtitle || 'System Integrated'}</p>
                </div>
              </div>
              <button type="button" onclick="toggleSidebar()" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0 cursor-pointer border-0">
                <svg id="toggleIcon" class="w-5 h-5 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>

            <nav class="flex-1 px-2 py-4 space-y-1 overflow-y-auto custom-scroll text-xs">
              <a href="dashboard.html" class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition no-underline">
                <svg class="w-5 h-5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 00-1 1m-6 0h6"/></svg>
                <span class="sidebar-text truncate">Dashboard</span>
              </a>
              
              <a id="nav-eskalasi" href="eskalasi.html" class="hidden flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition no-underline">
                <svg class="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                <span class="sidebar-text truncate">Eskalasi</span>
              </a>
              
              <a id="nav-rkm" href="RKM.html" class="hidden flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition no-underline">
                <svg class="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                <span class="sidebar-text truncate">RKM</span>
              </a>

              <a id="nav-dokPerbaikan" href="sr.html" class="hidden flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition no-underline">
                <svg class="w-5 h-5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                <span class="sidebar-text truncate">Dok. Perbaikan</span>
              </a>

              <a id="nav-tasks" href="tasks.html" class="hidden flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition no-underline">
                <svg class="w-5 h-5 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012 2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                <span class="sidebar-text truncate">Tasks</span>
              </a>

              <a id="nav-syncflow" href="syncflow.html" class="hidden flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition no-underline">
                <svg class="w-5 h-5 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                <span class="sidebar-text truncate">Syncflow</span>
              </a>

              <a id="nav-inventory" href="inventory.html" class="hidden flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition no-underline">
                <svg class="w-5 h-5 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                <span class="sidebar-text truncate">Inventory</span>
              </a>

              <!-- MENU LOGISTICS TERPASANG DI SINI -->
              <a id="nav-logistics" href="logistics.html" class="hidden flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition no-underline">
                <svg class="w-5 h-5 text-teal-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                <span class="sidebar-text truncate">Logistics</span>
              </a>

              <a id="nav-assets" href="assets.html" class="hidden flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition no-underline">
                <svg class="w-5 h-5 text-sky-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                <span class="sidebar-text truncate">Assets</span>
              </a>

              <a id="nav-access" href="access.html" class="hidden flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition no-underline">
                <svg class="w-5 h-5 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                <span class="sidebar-text truncate">Access Control</span>
              </a>
            </nav>

            <div class="p-3 border-t border-slate-800 text-xs">
              <button type="button" onclick="handleLogout()" class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-rose-400 hover:bg-slate-800 transition cursor-pointer border-0 bg-transparent">
                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                <span class="sidebar-text truncate font-medium">Keluar</span>
              </button>
            </div>
          </aside>
        `;
    }

    initNavbarAccess();
    highlightActiveMenu(path);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const toggleIcon = document.getElementById('toggleIcon');

    if (!sidebar) return;

    if (sidebar.classList.contains('sidebar-expanded')) {
        sidebar.classList.remove('sidebar-expanded');
        sidebar.classList.add('sidebar-collapsed');
        if (mainContent) {
            mainContent.classList.remove('main-offset-expanded');
            mainContent.classList.add('main-offset-collapsed');
        }
        if (toggleIcon) toggleIcon.classList.add('rotate-180');
    } else {
        sidebar.classList.remove('sidebar-collapsed');
        sidebar.classList.add('sidebar-expanded');
        if (mainContent) {
            mainContent.classList.remove('main-offset-collapsed');
            mainContent.classList.add('main-offset-expanded');
        }
        if (toggleIcon) toggleIcon.classList.remove('rotate-180');
    }
}

function highlightActiveMenu(path) {
    const navLinks = document.querySelectorAll('#sidebar nav a');
    navLinks.forEach(link => {
        const href = link.getAttribute('href').toLowerCase();
        if (path.includes(href) && href !== 'dashboard.html') {
            link.classList.add('bg-slate-800', 'text-white', 'font-bold');
            link.classList.remove('text-slate-300');
        }
    });
}

function handleLogout() {
    if (confirm("Apakah Anda yakin ingin keluar dari sistem?")) {
        localStorage.removeItem("user");
        sessionStorage.clear();
        window.location.replace("login.html");
    }
}

function initNavbarAccess() {
    const session = localStorage.getItem("user");
    if (!session) return;
    const user = JSON.parse(session);

    const displayName = user.nama || user.username || "User Profile";
    const firstLetter = displayName.charAt(0).toUpperCase();

    const headerAvatarEl = document.getElementById("nav-header-avatar");
    if (headerAvatarEl) headerAvatarEl.textContent = firstLetter;

    const isSuperAdmin = (user.nama || user.username || "").toLowerCase() === "dede hidayat";

    const modules = [
        { id: "nav-eskalasi", key: "eskalasi" },
        { id: "nav-rkm", key: "rkm" },
        { id: "nav-dokPerbaikan", key: "dokPerbaikan" },
        { id: "nav-tasks", key: "tasks" },
        { id: "nav-syncflow", key: "syncflow" },
        { id: "nav-inventory", key: "inventory" },
        { id: "nav-logistics", key: "logistics" },
        { id: "nav-assets", key: "assets" },
        { id: "nav-access", key: "access" }
    ];

    modules.forEach(mod => {
        const el = document.getElementById(mod.id);
        if (!el) return;

        let allowed = false;
        if (isSuperAdmin) {
            allowed = true;
        } else if (user.akses && user.akses[mod.key] !== undefined) {
            const val = String(user.akses[mod.key]).toUpperCase();
            allowed = (val === "Y" || val === "TRUE" || val === "1");
        } else if (user[mod.key] !== undefined) {
            const val = String(user[mod.key]).toUpperCase();
            allowed = (val === "Y" || val === "TRUE" || val === "1");
        }

        if (allowed) {
            el.classList.remove("hidden");
        } else {
            el.classList.add("hidden");
        }
    });
}
